import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('React public-site diagnostics', () => {
  test('surfaces install clipboard failures without raw console output', () => {
    const source = readFileSync('frontend/apps/site/src/install-page.tsx', 'utf8');

    expect(source).toContain("type CopyState = 'idle' | 'copied' | 'error';");
    expect(source).toContain("setCopyState('error')");
    expect(source).toContain('<p role="alert">Clipboard access failed. Select the command manually.</p>');
    expect(source).not.toContain('console.error');
    expect(source).not.toContain('console.warn');
  });

  test('surfaces public market feed failures with retry actions', () => {
    const page = readFileSync('frontend/apps/site/src/market-cap-page.tsx', 'utf8');
    const board = readFileSync('frontend/apps/site/src/market-cap-board.tsx', 'utf8');

    expect(page).toContain("setState({ data: null, loading: false, error: cause instanceof Error ? cause.message : String(cause) })");
    expect(page).toContain('role="alert"');
    expect(board).toContain('role="alert"');
    expect(board).toContain('onClick={onReload}>Try again</button>');
    expect(`${page}\n${board}`).not.toContain('console.error');
    expect(`${page}\n${board}`).not.toContain('console.warn');
  });
});
