import { describe, expect, test } from 'bun:test';

import {
  emptyEntityWorkspaceContext,
  projectEntityWorkspaceContext,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-context';
import {
  emptyEntityWorkspaceProfile,
  projectEntityWorkspaceProfile,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-profile';
import {
  emptyEntityWorkspaceReserves,
  projectEntityWorkspaceReserves,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-reserves';
import {
  emptyEntityWorkspaceSettingsSummary,
  projectEntityWorkspaceSettingsSummary,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-settings-summary';
import {
  createEntityWorkspaceHistoryState,
  createEntityWorkspaceLiveState,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-time-machine';

const frame = (entityId: string) => ({
  height: 42,
  activeEntityId: entityId,
  activeEntity: {
    summary: { entityId, label: 'Treasury' },
    core: {
      entityId,
      signerId: '0xbbbb',
      config: { jurisdiction: { name: 'H1' } },
      profile: {
        entityId, name: 'Treasury', isHub: true, entityKind: 'hub', sectors: ['finance'],
        avatar: '', bio: 'Settlement hub', website: 'https://hub.example',
      },
      reserves: new Map([[1, 10n], [2, 20n]]),
    },
    accounts: { items: [], totalItems: 4 },
  },
});

const projections = (entityId: string) => {
  const value = frame(entityId);
  const context = projectEntityWorkspaceContext({ runtimeId: 'runtime-a', frame: value });
  return {
    context,
    profile: projectEntityWorkspaceProfile({ context, frame: value }),
    reserves: projectEntityWorkspaceReserves({ context, frame: value }),
  };
};

describe('React Entity Settings committed summary', () => {
  test('composes exact Runtime identity and committed projection counts', () => {
    expect(projectEntityWorkspaceSettingsSummary({
      ...projections('0xaaaa'),
      timeMachine: createEntityWorkspaceHistoryState({ latestHeight: 50, selectedHeight: 42 }),
    })).toEqual({
      status: 'selected', runtimeId: 'runtime-a', runtimeHeight: 42, entityId: '0xaaaa',
      signerId: '0xbbbb', jurisdictionName: 'H1', mode: 'history', isHub: true,
      accountCount: 4, visibleReserveCount: 2,
    });
  });

  test('keeps an empty committed context explicit', () => {
    expect(projectEntityWorkspaceSettingsSummary({
      context: emptyEntityWorkspaceContext('runtime-a'),
      profile: emptyEntityWorkspaceProfile(),
      reserves: emptyEntityWorkspaceReserves(),
      timeMachine: createEntityWorkspaceLiveState(0),
    })).toEqual(emptyEntityWorkspaceSettingsSummary());
  });

  test('labels an in-flight history selection without claiming the prior frame is historical', () => {
    const selected = projections('0xaaaa');
    expect(projectEntityWorkspaceSettingsSummary({
      ...selected,
      timeMachine: createEntityWorkspaceHistoryState({
        latestHeight: 50, loading: true, selectedHeight: 41,
      }),
    })).toMatchObject({ status: 'selected', mode: 'reading', runtimeHeight: 42 });
  });

  test('fails loudly on missing or cross-Entity projections', () => {
    const selected = projections('0xaaaa');
    expect(() => projectEntityWorkspaceSettingsSummary({
      ...selected,
      profile: emptyEntityWorkspaceProfile(),
      timeMachine: createEntityWorkspaceLiveState(42),
    })).toThrow('ENTITY_WORKSPACE_SETTINGS_SUMMARY_PROJECTION_MISSING');
    expect(() => projectEntityWorkspaceSettingsSummary({
      ...selected,
      profile: projections('0xcccc').profile,
      timeMachine: createEntityWorkspaceLiveState(42),
    })).toThrow('ENTITY_WORKSPACE_SETTINGS_SUMMARY_ENTITY_ID_MISMATCH');
  });

  test('keeps the summary presentation read-only', async () => {
    const [page, panel, shell] = await Promise.all([
      Bun.file('frontend/apps/ops/src/ops-entity-workspace.tsx').text(),
      Bun.file('frontend/packages/ui/src/entity-workspace-profile-panel.tsx').text(),
      Bun.file('frontend/packages/ui/src/entity-workspace-shell.tsx').text(),
    ]);
    expect(page).toContain('timeMachine={runtimeSnapshot.timeMachine}');
    expect(shell).toContain('timeMachine={timeMachine}');
    expect(panel).toContain('projectEntityWorkspaceSettingsSummary');
    expect(panel).toContain('Visible reserves');
    expect(panel).not.toContain('onSave');
    expect(panel).not.toContain('.send(');
  });
});
