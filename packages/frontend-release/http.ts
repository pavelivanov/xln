import type { CandidateReleaseManifest } from './manifest';
import { resolvePublicRoute } from './public-routes';
import { requestedReleasePath, serveCandidateReleaseFile } from './serve';
import { isEdgeRoute } from './surfaces';
import { verifyCandidateReleaseDirectory } from './verify';

export const serveVerifiedReleaseRequest = async (
  directory: string,
  manifest: CandidateReleaseManifest,
  request: Request,
): Promise<Response | null> => {
  const url = new URL(request.url);
  const route = resolvePublicRoute(url);
  if (route?.kind === 'redirect')
    return new Response(null, { status: route.status, headers: { location: route.location } });
  if (route?.kind === 'response') return new Response(route.body, { status: route.status, headers: route.headers });
  const path = requestedReleasePath(url.pathname, manifest);
  if (path === null) {
    return isEdgeRoute(url.pathname) && url.pathname !== '/runtime.js'
      ? null
      : new Response('Not found', { status: 404 });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  const response = await serveCandidateReleaseFile(directory, manifest, url.pathname);
  return request.method === 'HEAD'
    ? new Response(null, { status: response.status, headers: response.headers })
    : response;
};

export const prepareVerifiedRelease = async (directory: string) => {
  const manifest = await verifyCandidateReleaseDirectory(directory);
  return {
    manifest,
    serve: (request: Request) => serveVerifiedReleaseRequest(directory, manifest, request),
  };
};
