import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

test('EntityInput consumes projected profiles instead of global runtime env', () => {
  const entityInput = readFileSync('frontend/apps/wallet/src/entity/wallet-entity-input.tsx', 'utf8');
  const move = readFileSync('frontend/apps/wallet/src/move/wallet-move.tsx', 'utf8');
  const accountOpen = readFileSync('frontend/apps/wallet/src/account/controls/wallet-account-open.tsx', 'utf8');

  expect(entityInput).toContain('profiles: readonly EntityInputProfile[]');
  expect(entityInput).toContain('const names = new Map(profiles.map(');
  expect(entityInput).toContain('parseEntityInput(value, { entities, profiles })');
  expect(entityInput).not.toContain('xlnEnvironment');
  expect(entityInput).not.toContain('$xlnEnvironment');
  expect(entityInput).not.toContain('getProfilesFromSource');
  expect(entityInput).not.toContain('getGossipProfile(');
  expect(entityInput).not.toContain('scheduleGossipProfileFetch');

  expect(move).toContain('const profiles = [...context.names]');
  expect(move).toContain('profiles={profiles}');
  expect(accountOpen).toContain('profiles={snapshot.profiles}');
  expect(`${move}\n${accountOpen}`).not.toContain('xlnEnvironment');
});

test('entity naming helpers are projection-only and do not perform hidden runtime fetches', () => {
  const entityNaming = readFileSync('frontend/packages/ui/src/identity/entity-naming.ts', 'utf8');
  const entitySelect = readFileSync('frontend/apps/wallet/src/entity/wallet-entity-input.tsx', 'utf8');
  const entityDropdown = readFileSync('frontend/packages/ui/src/entity/entity-panel-options.ts', 'utf8');
  const accountDropdown = readFileSync('frontend/apps/wallet/src/account/wallet-account-rail.tsx', 'utf8');

  for (const source of [entityNaming, entitySelect, entityDropdown, accountDropdown]) {
    expect(source).not.toContain('scheduleGossipProfileFetch');
    expect(source).not.toContain('xlnEnvironment');
    expect(source).not.toContain('$xlnEnvironment');
  }
  expect(entityNaming).not.toContain('getXLN');
  expect(entityNaming).not.toContain('Date.now');
  expect(entityNaming).not.toContain('setTimeout');
  expect(entityNaming).not.toContain('catch');
});

test('entity factory auto-create uses injected runtime env and fails loud', () => {
  const entityFactory = readFileSync('frontend/bridges/wallet/entity/entity-factory.ts', 'utf8');
  const vaultStore = readFileSync('frontend/bridges/vault/vault-store.ts', 'utf8');

  expect(entityFactory).toContain('export async function autoCreateEntityForSigner');
  expect(entityFactory).toContain('env: RuntimeReplica,');
  expect(entityFactory).toContain('const runtimeEnv = unwrapLiveRuntimeEnv(env) ?? env;');
  expect(entityFactory).toContain("throw new Error('[EntityFactory] No runtime env available for auto-create');");
  expect(entityFactory).toContain('available=${formatJMachineNames(env)}');
  expect(entityFactory).toContain('Refusing to create signer entity in another jurisdiction');
  expect(entityFactory).not.toContain('console.error');
  expect(entityFactory).not.toContain('console.warn');
  expect(entityFactory).not.toContain('console.info');
  expect(entityFactory).not.toContain('xlnEnvironment');
  expect(entityFactory).not.toContain('activeEnv');
  expect(entityFactory).not.toContain('return null;\n    } catch (error)');

  expect(vaultStore).toContain('const runtimeEntry = get(runtimes).get(runtime.id);');
  expect(vaultStore).toContain('autoCreateEntityForSigner(address, runtimeEnv, jurisdiction)');
  expect(vaultStore).toContain('toasts.error(`Failed to create signer entity:');
  expect(vaultStore).toContain('throw err;');
});

test('entity factory rechecks bootstrap ownership and dispatches only to its injected runtime', () => {
  const source = readFileSync('frontend/bridges/wallet/entity/entity-factory.ts', 'utf8');
  const onboarding = readFileSync('frontend/apps/wallet/src/identity/identity-onboarding.tsx', 'utf8');
  const createStart = source.indexOf('export async function createEphemeralEntity(');
  const createEnd = source.indexOf('\nfunction findReplicaBySigner(', createStart);
  const createSource = source.slice(createStart, createEnd);
  const loadRuntime = createSource.indexOf('const xln = await getXLN();');
  const recheckReplica = createSource.indexOf(
    'const readyReplica = findReplicaBySigner(runtimeEnv, signerId, jurisdictionName);',
  );
  const dispatch = createSource.indexOf(
    'await dispatchRuntimeInputToRuntimeEnv(runtimeEnv, runtimeInput);',
  );

  expect(createStart).toBeGreaterThan(0);
  expect(createEnd).toBeGreaterThan(createStart);
  expect(recheckReplica).toBeGreaterThan(loadRuntime);
  expect(dispatch).toBeGreaterThan(recheckReplica);
  expect(createSource).not.toContain('submitRuntimeInput(runtimeInput)');
  expect(onboarding).not.toContain('createSelfEntity');
  expect(onboarding).not.toContain('ensureSelfEntities');
});

test('vault user token helpers use active RuntimeStore env and RuntimeInput command path', () => {
  const vaultStore = readFileSync('frontend/bridges/vault/vault-store.ts', 'utf8');
  const balanceStart = vaultStore.indexOf('async getEntityBalance');
  const clearStart = vaultStore.indexOf('// === MVP: Send tokens', balanceStart);
  const sendStart = vaultStore.indexOf('async sendTokens');
  const endStart = vaultStore.indexOf('// === MVP: Get XLN balance for active entity ===', sendStart + 1);
  expect(balanceStart).toBeGreaterThan(0);
  expect(sendStart).toBeGreaterThan(balanceStart);
  const helperSource = vaultStore.slice(balanceStart, endStart > sendStart ? endStart : vaultStore.length);

  expect(helperSource).toContain('const runtimeEntry = activeId ? get(runtimes).get(activeId) : null;');
  expect(helperSource).toContain('await submitXlnEntityInputs([');
  expect(helperSource).not.toContain('await submitXlnEntityInputs(env,');
	  expect(helperSource).toContain("type: 'r2r'");
	  expect(helperSource).not.toContain('xlnEnvironment');
	  expect(helperSource).not.toContain('queueEntityInput');
	  expect(vaultStore).not.toContain('async enqueueRuntimeInput');
	});

test('unmounted retired RuntimeReplica owner panels are removed instead of kept as dead code', () => {
  expect(existsSync('frontend/src/lib/components/Admin/AdminPanel.svelte')).toBe(false);
  expect(existsSync('frontend/src/lib/components/Network/ProfileForm.svelte')).toBe(false);
  expect(existsSync('frontend/src/lib/components/Network/ProfileCard.svelte')).toBe(false);
});
