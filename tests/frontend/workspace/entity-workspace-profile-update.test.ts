import { describe, expect, test } from 'bun:test';

import {
  buildEntityWorkspaceProfileUpdateInput,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-profile-update';

describe('Entity workspace profile update command', () => {
  test('builds the canonical profile-update RuntimeInput from exact authority', () => {
    expect(buildEntityWorkspaceProfileUpdateInput(
      { entityId: ' 0xENTITY ', signerId: ' 0xSIGNER ' },
      { name: ' Treasury ', avatar: ' avatar://one ', bio: ' Operator ', website: ' https://xln.finance ' },
    )).toEqual({
      runtimeTxs: [],
      entityInputs: [{
        entityId: '0xentity',
        signerId: '0xsigner',
        entityTxs: [{
          type: 'profile-update',
          data: {
            profile: {
              entityId: '0xentity',
              name: 'Treasury',
              avatar: 'avatar://one',
              bio: 'Operator',
              website: 'https://xln.finance',
            },
          },
        }],
      }],
    });
  });

  test('rejects missing Entity, signer, or profile name before command ingress', () => {
    const draft = { name: 'Treasury', avatar: '', bio: '', website: '' };
    expect(() => buildEntityWorkspaceProfileUpdateInput({ entityId: '', signerId: '0xsigner' }, draft))
      .toThrow('ENTITY_WORKSPACE_PROFILE_ENTITY_REQUIRED');
    expect(() => buildEntityWorkspaceProfileUpdateInput({ entityId: '0xentity', signerId: '' }, draft))
      .toThrow('ENTITY_WORKSPACE_PROFILE_SIGNER_REQUIRED');
    expect(() => buildEntityWorkspaceProfileUpdateInput(
      { entityId: '0xentity', signerId: '0xsigner' },
      { ...draft, name: '   ' },
    )).toThrow('ENTITY_WORKSPACE_PROFILE_NAME_REQUIRED');
  });

  test('keeps Svelte and React on one command shape and the authenticated remote lane', async () => {
    const [legacy, command, editor, panel, owner, source, page] = await Promise.all([
      Bun.file('frontend/src/lib/components/Entity/workspace/shell/EntityPanelTabs.svelte').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace-profile-command.ts').text(),
      Bun.file('frontend/packages/ui/src/entity-workspace-profile-editor.tsx').text(),
      Bun.file('frontend/packages/ui/src/entity-workspace-profile-panel.tsx').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace-owner.ts').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace-source.ts').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace.tsx').text(),
    ]);
    expect(legacy).toContain('buildEntityWorkspaceProfileUpdateInput');
    expect(legacy).not.toMatch(/type: ["']profile-update["'] as const/);
    expect(editor).toContain('data-testid="settings-profile-editor"');
    expect(editor).toContain('Profile committed to the selected Entity.');
    expect(panel).toContain('disabledReason={disabledReason}');
    expect(owner).toContain('isRuntimeCommandJournalUnlocked(runtimeId)');
    expect(owner).toContain('signRuntimeAdapterOwnerBinding(runtimeId, challenge, capability)');
    expect(source).toContain('ownerBindingSigner: owner.signOpsEntityWorkspaceOwnerBinding');
    expect(command).toContain('await adapter.ensureOwnerCommandLane()');
    expect(command).toContain("adapter.commandLaneKind !== 'owner'");
    expect(command).toContain('commandId: createRuntimeCommandId()');
    expect(command).toContain('accepted.height + 1');
    expect(command).not.toContain('enqueueRuntimeInput');
    expect(source).toContain('this.profileCommand.save(draft)');
    expect(page).toContain('onSaveProfile={opsEntityWorkspaceSource.saveProfile}');
  });
});
