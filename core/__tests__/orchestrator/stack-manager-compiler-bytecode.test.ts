import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { readCompilerBytecodeEvidence } from '../../jurisdiction/adapter/stack-manager/compiler-bytecode';

describe('Stack Manager compiler bytecode evidence', () => {
  test('resolves Hardhat 3 split build-info source names', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xln-stack-build-info-'));
    try {
      await writeFile(join(directory, 'build.json'), JSON.stringify({
        userSourceNameMap: { 'contracts/Account.sol': 'project/contracts/Account.sol' },
      }));
      await writeFile(join(directory, 'build.output.json'), JSON.stringify({ output: {
        contracts: { 'project/contracts/Account.sol': { Account: { evm: { deployedBytecode: {
          immutableReferences: { 42: [{ start: 3, length: 32 }] },
        } } } } },
        sources: { 'project/contracts/Account.sol': { ast: {
          nodes: [{ id: 42, mutability: 'immutable', name: 'depository' }],
        } } },
      } }));
      const evidence = await readCompilerBytecodeEvidence(
        new URL('./', pathToFileURL(join(directory, 'placeholder'))),
        'contracts/Account.sol',
        'Account',
      );
      expect(evidence.immutableReferences).toEqual({ depository: [{ start: 3, length: 32 }] });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
