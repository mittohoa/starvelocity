export interface GqlRepo {
  databaseId: number | null;
  id: string;
  nameWithOwner: string;
  name: string;
  owner: { login: string; __typename: string } | null;
  description: string | null;
  homepageUrl: string | null;
  stargazerCount: number;
  forkCount: number;
  watchers: { totalCount: number } | null;
  issues: { totalCount: number } | null;
  pullRequests: { totalCount: number } | null;
  primaryLanguage: { name: string } | null;
  licenseInfo: { spdxId: string | null } | null;
  repositoryTopics: { nodes: ({ topic: { name: string } } | null)[] } | null;
  isFork: boolean;
  isArchived: boolean;
  isTemplate: boolean;
  createdAt: string;
  pushedAt: string | null;
}

const REPO_FRAGMENT = `
fragment RepoFields on Repository {
  databaseId
  id
  nameWithOwner
  name
  owner { login __typename }
  description
  homepageUrl
  stargazerCount
  forkCount
  watchers { totalCount }
  issues(states: OPEN) { totalCount }
  pullRequests(states: OPEN) { totalCount }
  primaryLanguage { name }
  licenseInfo { spdxId }
  repositoryTopics(first: 12) { nodes { topic { name } } }
  isFork
  isArchived
  isTemplate
  createdAt
  pushedAt
}`;

/**
 * Builds one GraphQL document that fetches N repositories under aliases
 * r0..rN-1. Batching is what keeps a 5000-repo snapshot inside a few hundred
 * rate-limit points instead of 5000 REST calls.
 *
 * Owner/name arrive as GraphQL variables rather than being interpolated, so a
 * repo named something adversarial cannot break the document.
 */
export function buildRepoBatchQuery(count: number): string {
  const varDecls: string[] = [];
  const selections: string[] = [];
  for (let i = 0; i < count; i++) {
    varDecls.push(`$o${i}: String!, $n${i}: String!`);
    selections.push(`  r${i}: repository(owner: $o${i}, name: $n${i}) { ...RepoFields }`);
  }
  return `query RepoBatch(${varDecls.join(', ')}) {
  rateLimit { cost remaining resetAt }
${selections.join('\n')}
}
${REPO_FRAGMENT}`;
}

export function buildRepoBatchVariables(
  pairs: readonly { owner: string; name: string }[],
): Record<string, string> {
  const vars: Record<string, string> = {};
  pairs.forEach((p, i) => {
    vars[`o${i}`] = p.owner;
    vars[`n${i}`] = p.name;
  });
  return vars;
}

export interface RepoBatchResult {
  rateLimit: { cost: number; remaining: number; resetAt: string };
  [alias: string]: GqlRepo | null | { cost: number; remaining: number; resetAt: string };
}
