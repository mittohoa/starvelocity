import { readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';

/**
 * Removes the React Server Component prefetch payloads from a static export.
 *
 * Next emits four extra files per page (`index.txt`, `__PAGE__.txt`,
 * `__next._full.txt`, `__next._tree.txt`) so the client router can navigate
 * without a full page load. This site navigates with plain <a href> anchors and
 * imports `next/link` nowhere, so every one of those requests is a full
 * document load and the payloads are never fetched.
 *
 * Measured on this project: 91.7 MB across 6,357 files, against 76 MB of actual
 * HTML. Deleting them roughly halves what has to be deployed.
 *
 * If this site ever adopts `next/link`, delete this script from the build —
 * client-side navigation genuinely needs these files.
 */

const OUT = resolve(process.argv[2] ?? 'out');

/** Real files that happen to end in .txt and must survive. */
const KEEP = new Set(['robots.txt']);

function isPayload(name) {
  if (KEEP.has(name)) return false;
  if (name.startsWith('__next.')) return true; // includes the extension-less segment markers
  return name === 'index.txt' || name === '__PAGE__.txt';
}

let removed = 0;
let bytes = 0;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else if (isPayload(basename(entry.name))) {
      bytes += (await stat(full)).size;
      await unlink(full);
      removed++;
    }
  }
}

await walk(OUT);
console.log(
  `[prune-rsc] removed ${removed} RSC payload file(s), ${(bytes / 1048576).toFixed(1)} MB. ` +
  'The site navigates with plain anchors, so these were never requested.',
);
