import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const repoRoot = process.cwd();

describe('frontend check output', () => {
  test('frontend checks expose the React aggregate and filter the npm preview hint only', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'frontend/package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const checkScript = packageJson.scripts['check'];
    const reactCheckScript = packageJson.scripts['check:react'];
    const buildCheckScript = packageJson.scripts['check:build'];
    const reactConfig = readFileSync(join(repoRoot, 'frontend/config/create-react-app-config.ts'), 'utf8');
    const copyStatic = readFileSync(join(repoRoot, 'frontend/copy-static-files.js'), 'utf8');

    expect(checkScript).toBe('bun scripts/check.ts --all --level=frontend');
    expect(reactCheckScript).toBe('bun scripts/check.ts --all --level=local');
    expect(buildCheckScript).toBeUndefined();
    expect(checkScript).not.toContain('node copy-static-files.js');
    expect(checkScript).not.toContain('vite build');
    expect(reactConfig).toContain("appType: 'spa'");
    expect(reactConfig).toContain("input: resolve(rootDirectory, 'index.html')");
    expect(copyStatic).toContain("process.env.XLN_STATIC_VERBOSE === '1'");
    expect(copyStatic).toContain("stdio: llmsVerbose ? 'inherit' : 'pipe'");
    expect(copyStatic).toContain('llms static context regenerated');
  });

  test('clean checkouts regenerate ignored LLM context and validate bundled contracts', () => {
    const copyStatic = readFileSync(join(repoRoot, 'frontend/copy-static-files.js'), 'utf8');
    const workflow = readFileSync(join(repoRoot, '.github/workflows/build-and-test.yml'), 'utf8');
    expect(copyStatic).not.toContain('LLMS_CONTEXT_STATIC_MISSING');
    expect(copyStatic).toContain('if (!rebuildRequested && llmsContextPresent)');
    expect(copyStatic).toContain('CONTRACT_STATIC_MISSING');
    expect(copyStatic).toContain('CONTRACT_SOURCE_REQUIRED');
    expect(copyStatic).toContain("process.argv.includes('--contracts-only')");
    expect(copyStatic).toContain("process.argv.includes('--require-all-contract-sources')");
    expect(workflow).toContain('bun frontend/copy-static-files.js --contracts-only --require-all-contract-sources');
    expect(workflow).toContain('git diff --exit-code -- frontend/static/contracts');
    expect(workflow).toContain("hashFiles('bun.lock', 'package.json', 'frontend/bun.lock', 'frontend/package.json')");
    expect(workflow).toContain('bun install --frozen-lockfile');
    expect(workflow).toContain('path: ~/.bun/install/cache');
  });

  test('require-all-contract-sources rejects stale bundled artifacts', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'xln-contract-static-'));
    const fixtureFrontend = join(fixture, 'frontend');
    try {
      mkdirSync(join(fixtureFrontend, 'static', 'contracts'), { recursive: true });
      mkdirSync(join(fixtureFrontend, 'scripts', 'docs'), { recursive: true });
      writeFileSync(join(fixtureFrontend, 'copy-static-files.js'), readFileSync(join(repoRoot, 'frontend/copy-static-files.js')));
      writeFileSync(
        join(fixtureFrontend, 'scripts', 'docs', 'docs-catalog.js'),
        readFileSync(join(repoRoot, 'frontend/scripts/docs/docs-catalog.js')),
      );
      for (const contract of [
        'Account',
        'Depository',
        'DepositoryBounds',
        'EntityProvider',
        'HankoVerifier',
        'HashLadderRegistry',
        'NftCustody',
        'DeltaTransformer',
        'ERC20Mock',
      ]) {
        writeFileSync(join(fixtureFrontend, 'static', 'contracts', `${contract}.json`), '{}\n');
      }

      const bundled = Bun.spawnSync([process.execPath, join(fixtureFrontend, 'copy-static-files.js'), '--contracts-only'], {
        cwd: fixture,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      expect(bundled.exitCode).toBe(0);

      const strict = Bun.spawnSync([
        process.execPath,
        join(fixtureFrontend, 'copy-static-files.js'),
        '--contracts-only',
        '--require-all-contract-sources',
      ], { cwd: fixture, stdout: 'pipe', stderr: 'pipe' });
      expect(strict.exitCode).not.toBe(0);
      expect(new TextDecoder().decode(strict.stderr)).toContain('CONTRACT_SOURCE_REQUIRED');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test('React command runner forwards build output and fails loud', () => {
    const runner = readFileSync(join(repoRoot, 'frontend/scripts/shared/command-runner.ts'), 'utf8');
    expect(runner).toContain("stdout: 'inherit'");
    expect(runner).toContain("stderr: 'inherit'");
    expect(runner).toContain('throw new Error(`FRONTEND_STEP_FAILED:${command.label}:${exitCode}`)');
  });
});
