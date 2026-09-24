import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  formatAddress,
  isPlaceholderEntityName,
  shortHash,
} from '../../../../frontend/packages/ui/src/entity/settings/entity-workspace-display';

describe('entity panel display helpers', () => {
  test('detects placeholder names without hiding human labels', () => {
    expect(isPlaceholderEntityName('')).toBe(true);
    expect(isPlaceholderEntityName('Signer 12')).toBe(true);
    expect(isPlaceholderEntityName('Entity deadbeef')).toBe(true);
    expect(isPlaceholderEntityName('Grace Tron')).toBe(false);
  });

  test('formats long ids and empty hash values for compact UI slots', () => {
    expect(formatAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x12345678...345678');
    expect(formatAddress('short-id')).toBe('short-id');
    expect(shortHash('')).toBe('-');
    expect(shortHash('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x12345678...345678');
  });

  test('React Entity workspace consumes the shared display module directly', () => {
    const shared = readFileSync('frontend/packages/ui/src/entity/settings/entity-workspace-display.ts', 'utf8');
    const shell = readFileSync('frontend/packages/ui/src/entity/entity-workspace-shell.tsx', 'utf8');
    const accounts = readFileSync('frontend/packages/ui/src/entity/accounts/entity-workspace-accounts-panel.tsx', 'utf8');
    expect(shared).not.toContain('frontend/src');
    expect(shared).not.toContain('$lib');
    expect(shell).toContain("from './settings/entity-workspace-display'");
    expect(accounts).toContain("from '../settings/entity-workspace-display'");
  });
});
