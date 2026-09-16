import { resolve } from 'node:path';
import { DEVELOPMENT_EDGE_PORT, parseDevelopmentGatewayPort } from '../../config/development-gateway';

const edgeTarget = (value: string): string => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('RELEASE_PREVIEW_EDGE_TARGET_INVALID');
  }
  return url.href;
};

export const parseReleasePreviewOptions = (
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
) => {
  const directory = args[0];
  if (args.length !== 1 || !directory || directory.startsWith('-')) {
    throw new Error('RELEASE_PREVIEW_USAGE: bun run preview:react <release-directory>');
  }
  const target = edgeTarget(env['XLN_REACT_EDGE_TARGET'] ?? `http://127.0.0.1:${DEVELOPMENT_EDGE_PORT}`);
  return {
    directory: resolve(directory),
    port: parseDevelopmentGatewayPort(env['XLN_REACT_GATEWAY_PORT']),
    target,
    relayTarget: edgeTarget(env['XLN_REACT_EDGE_WEBSOCKET_TARGET'] ?? target),
  };
};
