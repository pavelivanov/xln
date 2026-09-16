import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { parseReleasePreviewOptions } from '../../../../frontend/scripts/release/preview-options';

describe('verified release preview input', () => {
  test('requires one explicit directory and never chooses a build or recent release', () => {
    for (const args of [[], ['--latest'], ['a', 'b']]) {
      expect(() => parseReleasePreviewOptions(args, {})).toThrow('RELEASE_PREVIEW_USAGE');
    }
    expect(parseReleasePreviewOptions(['release'], {})).toEqual({
      directory: resolve('release'),
      port: 8080,
      target: 'http://127.0.0.1:8082/',
      relayTarget: 'http://127.0.0.1:8082/',
    });
  });

  test('keeps API and relay destinations explicit and rejects invalid endpoints or ports', () => {
    expect(
      parseReleasePreviewOptions(['release'], {
        XLN_REACT_GATEWAY_PORT: '19180',
        XLN_REACT_EDGE_TARGET: 'http://localhost:19192',
        XLN_REACT_EDGE_WEBSOCKET_TARGET: 'https://localhost:19195',
      }),
    ).toEqual({
      directory: resolve('release'),
      port: 19180,
      target: 'http://localhost:19192/',
      relayTarget: 'https://localhost:19195/',
    });
    for (const port of ['NaN', '0', '65536']) {
      expect(() => parseReleasePreviewOptions(['release'], { XLN_REACT_GATEWAY_PORT: port })).toThrow();
    }
    for (const target of ['file:///tmp/app', 'http://localhost/api', 'http://localhost/?query=1']) {
      expect(() => parseReleasePreviewOptions(['release'], { XLN_REACT_EDGE_TARGET: target })).toThrow();
      expect(() => parseReleasePreviewOptions(['release'], { XLN_REACT_EDGE_WEBSOCKET_TARGET: target })).toThrow();
    }
  });
});
