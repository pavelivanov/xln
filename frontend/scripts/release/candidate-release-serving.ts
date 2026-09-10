import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { safeStringify } from '../../../core/protocol/serialization';
import { SURFACES, matchesRoute, resolveRouteOwner } from '../../config/surfaces';
import type { CandidateReleaseManifest } from './candidate-release';

const applicationEntry = (pathname: string): string | null => {
  const owner = resolveRouteOwner(pathname);
  if (owner === 'edge') return null;
  const surface = SURFACES.find(({ id }) => id === owner);
  return surface?.routes.some(rule => matchesRoute(pathname, rule)) ? `apps/${owner}/index.html` : null;
};

export const requestedReleasePath = (pathname: string, manifest: CandidateReleaseManifest): string | null => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, '');
  if (
    relative &&
    (relative.includes('\\') || relative.split('/').some(part => !part || part === '.' || part === '..'))
  ) {
    return null;
  }
  if (relative) {
    if (relative === 'release-manifest.json' || manifest.files.some(({ path }) => path === relative)) return relative;
  }
  return applicationEntry(decoded);
};

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.wasm', 'application/wasm'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

export const serveCandidateReleaseFile = async (
  directory: string,
  manifest: CandidateReleaseManifest,
  pathname: string,
): Promise<Response> => {
  const relativePath = requestedReleasePath(pathname, manifest);
  if (relativePath === null) return new Response('Not found', { status: 404 });
  const bytes = await readFile(join(directory, relativePath));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const expected =
    relativePath === 'release-manifest.json'
      ? createHash('sha256')
          .update(`${safeStringify(manifest, 2)}\n`)
          .digest('hex')
      : manifest.files.find(file => file.path === relativePath)?.sha256;
  if (sha256 !== expected) throw new Error(`CANDIDATE_RELEASE_FILE_MISMATCH:${relativePath}`);
  return new Response(bytes, {
    headers: {
      'cache-control': 'no-store',
      'content-type': mimeTypes.get(extname(relativePath)) ?? 'application/octet-stream',
      'x-xln-deployment-release': manifest.releaseId,
      'x-xln-content-sha256': sha256,
    },
  });
};
