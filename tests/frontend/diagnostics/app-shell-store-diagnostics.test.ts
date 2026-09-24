import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const visibleDiagnosticFiles = [
  {
    path: 'frontend/apps/wallet/src/app-shell.tsx',
    markers: ["const [recoveryError, setRecoveryError]", 'role="alert"', '{recoveryError ? <span role="alert">'],
  },
  {
    path: 'frontend/apps/ops/src/workspace/ops-workspace.tsx',
    markers: ["const [issue, setIssue]", 'role="alert"', 'onDiagnostic={diagnostic => setIssue'],
  },
] as const;

const persistentDiagnosticFiles = [
  {
    path: 'frontend/packages/browser/src/preferences/settings-store.ts',
    importLine: "import { errorLog } from '../logging/error-log-store';",
    logLine: "errorLog.log('Failed to load settings; clearing corrupted storage', 'Settings'",
  },
  {
    path: 'frontend/packages/browser/src/workspace/tab-store.ts',
    importLine: "import { errorLog } from '../logging/error-log-store';",
    logLine: "errorLog.log('Failed to load tabs; clearing corrupted storage', 'Tabs'",
  },
  {
    path: 'frontend/packages/browser/src/jurisdiction/jmachine-store.ts',
    importLine: "import { errorLog } from '../logging/error-log-store';",
    logLine: "errorLog.log('Failed to load J-Machine configs; clearing corrupted storage', 'J-Machine Store'",
  },
] as const;

const expectNoRawConsole = (source: string): void => {
  expect(source).not.toContain('console.error');
  expect(source).not.toContain('console.warn');
  expect(source).not.toContain('console.info');
};

test('React app shells surface actionable diagnostics without raw console output', () => {
  for (const file of visibleDiagnosticFiles) {
    const source = readFileSync(file.path, 'utf8');
    for (const marker of file.markers) expect(source).toContain(marker);
    expectNoRawConsole(source);
  }
});

test('retained browser stores persist diagnostics without raw console output', () => {
  for (const file of persistentDiagnosticFiles) {
    const source = readFileSync(file.path, 'utf8');
    expect(source).toContain(file.importLine);
    expect(source).toContain(file.logLine);
    expectNoRawConsole(source);
  }
});
