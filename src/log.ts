type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = ORDER[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? ORDER.info;

function emit(level: Level, msg: string, extra?: unknown) {
  if (ORDER[level] < threshold) return;
  const ts = new Date().toISOString().slice(11, 19);
  const tag = level.toUpperCase().padEnd(5);
  const line = `${ts} ${tag} ${msg}`;
  const sink = level === 'error' || level === 'warn' ? console.error : console.log;
  if (extra === undefined) sink(line);
  else sink(line, typeof extra === 'string' ? extra : JSON.stringify(extra));
}

export const log = {
  debug: (m: string, e?: unknown) => emit('debug', m, e),
  info:  (m: string, e?: unknown) => emit('info', m, e),
  warn:  (m: string, e?: unknown) => emit('warn', m, e),
  error: (m: string, e?: unknown) => emit('error', m, e),
};

/** Single-line progress that overwrites itself when attached to a TTY. */
export function progress(msg: string) {
  if (process.stdout.isTTY) process.stdout.write(`\r\x1b[K  ${msg}`);
}
export function progressDone() {
  if (process.stdout.isTTY) process.stdout.write('\n');
}
