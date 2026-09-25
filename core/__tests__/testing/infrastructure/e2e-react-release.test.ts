import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { deriveE2EBuildArtifacts } from '../../../scripts/e2e/runners/run-e2e-parallel-isolated';

describe('E2E canonical React release', () => {
  test('shares one immutable verified release without shard-local frontend output', () => {
    const cacheRoot = resolve('/tmp/xln-e2e-react-release');
    const artifacts = deriveE2EBuildArtifacts(cacheRoot);

    expect(artifacts).toEqual({
      cacheRoot,
      releaseDirectory: join(cacheRoot, 'release'),
      previewServerPath: join(cacheRoot, 'preview-server.mjs'),
    });
  });

  test('serves the cached release through the explicit React edge proxy', () => {
    const runner = readFileSync('core/scripts/e2e/runners/run-e2e-parallel-isolated.ts', 'utf8');

    expect(runner).toContain('[buildArtifacts.previewServerPath, buildArtifacts.releaseDirectory]');
    expect(runner).toContain('XLN_REACT_GATEWAY_PORT: String(webPort)');
    expect(runner).toContain('XLN_REACT_EDGE_TARGET: apiUrl');
    expect(runner).toContain('XLN_REACT_EDGE_WEBSOCKET_TARGET: apiUrl');
    expect(runner).not.toContain('XLN_SVELTE');
  });
});
