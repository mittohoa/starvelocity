import { sleep } from '../util.ts';
import { log } from '../log.ts';

const API = 'https://api.github.com';
const UA = 'starvelocity-collector/0.1';

/**
 * Search has a much tighter budget than the rest of the REST API
 * (30 requests/minute vs 5000/hour), so it gets a dedicated minimum interval.
 */
const SEARCH_MIN_INTERVAL_MS = 2_100;

export interface RateSnapshot {
  limit: number;
  remaining: number;
  resetAt: number; // epoch seconds
  used: number;
}

export class GitHubError extends Error {
  status: number;
  body: string;
  constructor(status: number, message: string, body: string) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.body = body;
  }
}

type RateKind = 'core' | 'search' | 'graphql';

/**
 * GitHub refuses a GraphQL document that is individually too expensive, quite
 * separately from the points budget. Batched callers react by splitting the
 * batch, so this needs to be distinguishable from a real failure.
 */
export function isResourceLimitError(err: unknown): boolean {
  return err instanceof GitHubError && /resource limits? for this query/i.test(err.message);
}

export class GitHubClient {
  #token: string;
  #lastSearchAt = 0;

  /** Cumulative counters for the run ledger. */
  apiCalls = 0;
  graphqlPoints = 0;
  rate: Partial<Record<RateKind, RateSnapshot>> = {};

  constructor(token: string) {
    this.#token = token;
  }

  #headers(accept: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.#token}`,
      Accept: accept,
      'User-Agent': UA,
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  #recordRate(kind: RateKind, res: Response) {
    const limit = Number(res.headers.get('x-ratelimit-limit'));
    if (!Number.isFinite(limit) || limit === 0) return;
    this.rate[kind] = {
      limit,
      remaining: Number(res.headers.get('x-ratelimit-remaining')),
      resetAt: Number(res.headers.get('x-ratelimit-reset')),
      used: Number(res.headers.get('x-ratelimit-used')),
    };
  }

  /**
   * How long to wait before retrying, or null when the error is not retryable.
   * Covers primary limits, secondary (abuse) limits and 5xx.
   */
  async #waitForRetry(res: Response, body: string, attempt: number): Promise<number | null> {
    const retryAfter = Number(res.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.min(retryAfter, 900) * 1000;
    }

    const remaining = Number(res.headers.get('x-ratelimit-remaining'));
    if ((res.status === 403 || res.status === 429) && remaining === 0) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const waitMs = Math.max(reset - Date.now(), 0) + 2_000;
      log.warn(`primary rate limit hit; sleeping ${Math.round(waitMs / 1000)}s until reset`);
      return waitMs;
    }

    // Secondary rate limit: 403 without the remaining==0 signal.
    if ((res.status === 403 || res.status === 429) && /secondary rate limit|abuse/i.test(body)) {
      const waitMs = Math.min(60_000, 2 ** attempt * 1_000 + 1_000);
      log.warn(`secondary rate limit; backing off ${waitMs}ms`);
      return waitMs;
    }

    if (res.status >= 500 && res.status < 600) {
      return Math.min(30_000, 2 ** attempt * 500);
    }

    return null;
  }

  async #fetch(
    url: string,
    init: RequestInit,
    kind: RateKind,
    maxAttempts = 6,
  ): Promise<{ res: Response; body: string }> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (kind === 'search') {
        const since = Date.now() - this.#lastSearchAt;
        if (since < SEARCH_MIN_INTERVAL_MS) await sleep(SEARCH_MIN_INTERVAL_MS - since);
        this.#lastSearchAt = Date.now();
      }

      let res: Response;
      try {
        res = await fetch(url, init);
      } catch (err) {
        // Network-level failure: DNS, connection reset, etc.
        if (attempt === maxAttempts - 1) throw err;
        const waitMs = Math.min(30_000, 2 ** attempt * 500);
        log.warn(`network error, retrying in ${waitMs}ms`, String(err));
        await sleep(waitMs);
        continue;
      }

      this.apiCalls++;
      this.#recordRate(kind, res);

      if (res.ok) return { res, body: await res.text() };

      const body = await res.text();

      if (res.status === 401) {
        throw new GitHubError(401, 'GITHUB_TOKEN rejected (401). Check the token in .env.', body);
      }
      // A missing repo or a pagination ceiling is normal; let the caller decide.
      if (res.status === 404 || res.status === 422) return { res, body };

      const waitMs = await this.#waitForRetry(res, body, attempt);
      if (waitMs === null) {
        throw new GitHubError(res.status, `GitHub ${res.status} for ${url}`, body.slice(0, 500));
      }
      await sleep(waitMs);
    }
    throw new GitHubError(0, `gave up after ${maxAttempts} attempts: ${url}`, '');
  }

  // ------------------------------------------------------------- GraphQL

  async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const { res, body } = await this.#fetch(
      `${API}/graphql`,
      {
        method: 'POST',
        headers: { ...this.#headers('application/json'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      },
      'graphql',
    );

    if (!res.ok) throw new GitHubError(res.status, `graphql ${res.status}`, body.slice(0, 500));

    const json = JSON.parse(body) as {
      data?: T & { rateLimit?: { cost: number; remaining: number; resetAt: string } };
      errors?: { type?: string; message: string; path?: (string | number)[] }[];
    };

    const rl = json.data?.rateLimit;
    if (rl) {
      this.graphqlPoints += rl.cost;
      this.rate.graphql = {
        limit: 5000,
        remaining: rl.remaining,
        resetAt: Math.floor(Date.parse(rl.resetAt) / 1000),
        used: 5000 - rl.remaining,
      };
    }

    // A batched query returns nulls for missing repos alongside NOT_FOUND
    // errors. That is expected, not fatal — only fail on other error types.
    if (json.errors?.length) {
      const fatal = json.errors.filter(e => e.type !== 'NOT_FOUND');
      if (fatal.length) {
        throw new GitHubError(
          200,
          `graphql errors: ${fatal.map(e => e.message).join('; ')}`,
          body.slice(0, 500),
        );
      }
      log.debug(`graphql: ${json.errors.length} NOT_FOUND alias(es)`);
    }

    if (!json.data) throw new GitHubError(200, 'graphql returned no data', body.slice(0, 500));
    return json.data;
  }

  // ---------------------------------------------------------------- REST

  /** GET a REST path. Returns null on 404/422 instead of throwing. */
  async rest<T>(path: string, accept = 'application/vnd.github+json'): Promise<T | null> {
    const r = await this.restWithLink<T>(path, accept);
    return r.data;
  }

  /** Same as rest() but also surfaces the Link header and status for pagination. */
  async restWithLink<T>(
    path: string,
    accept = 'application/vnd.github+json',
  ): Promise<{ data: T | null; link: string | null; status: number }> {
    const kind: RateKind = path.startsWith('/search/') ? 'search' : 'core';
    const { res, body } = await this.#fetch(`${API}${path}`, { headers: this.#headers(accept) }, kind);
    if (res.status === 404 || res.status === 422) {
      return { data: null, link: null, status: res.status };
    }
    return { data: JSON.parse(body) as T, link: res.headers.get('link'), status: res.status };
  }

  rateSummary(): string {
    const parts: string[] = [];
    for (const kind of ['core', 'search', 'graphql'] as RateKind[]) {
      const v = this.rate[kind];
      if (v) parts.push(`${kind} ${v.remaining}/${v.limit}`);
    }
    return parts.join(' · ') || 'no rate data yet';
  }
}
