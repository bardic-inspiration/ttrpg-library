// Serves the built site (site/dist) under the site base (SPEC.md §3.1), so
// browser checks load pages at the same paths as GitHub Pages. Used by
// `npm run a11y` (§9.7).

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';
import { SITE_BASE } from '../../lib/site.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** The file under `root` for a request path, or `undefined` outside the base or the root. */
export function resolvePath(root: string, pathname: string): string | undefined {
  if (!pathname.startsWith(SITE_BASE)) return undefined;
  const relative = decodeURIComponent(pathname.slice(SITE_BASE.length));
  const file = normalize(join(root, relative, relative === '' || relative.endsWith('/') ? 'index.html' : ''));
  return file === root || file.startsWith(root + sep) ? file : undefined;
}

export interface SiteServer {
  /** The site's root URL, ending in the base, such as `http://127.0.0.1:4321/ttrpg-library/`. */
  url: string;
  close(): Promise<void>;
}

/** Starts a static server for `root` on a free local port. */
export async function serveSite(root: string): Promise<SiteServer> {
  const server: Server = createServer(async (req, res) => {
    const file = resolvePath(root, new URL(req.url ?? '/', 'http://localhost').pathname);
    const info = file ? await stat(file).catch(() => undefined) : undefined;
    if (!file || !info?.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}${SITE_BASE}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
