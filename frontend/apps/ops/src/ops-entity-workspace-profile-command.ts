import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';

import { createRuntimeCommandId } from '../../../packages/browser/src/runtime-command-intent-codec';
import {
  buildEntityWorkspaceProfileUpdateInput,
  normalizeEntityWorkspaceProfileDraft,
  type EntityWorkspaceProfileDraft,
} from '../../../packages/runtime-client/src/entity-workspace-profile-update';
import type { OpsEntityWorkspaceSourceSnapshot } from './ops-entity-workspace-projection';

type ProfileCommandDependencies = Readonly<{
  isHistoryActive: () => boolean;
  readAdapter: () => RuntimeAdapter | null;
  readGeneration: () => number;
  readSnapshot: () => OpsEntityWorkspaceSourceSnapshot;
  refresh: () => void;
  subscribe: (listener: () => void) => () => void;
}>;

const PROFILE_COMMIT_TIMEOUT_MS = 20_000;

const profileMatches = (
  profile: OpsEntityWorkspaceSourceSnapshot['profile'],
  expected: EntityWorkspaceProfileDraft,
): boolean => profile.status === 'selected'
  && profile.name === expected.name
  && profile.avatar === expected.avatar
  && profile.bio === expected.bio
  && profile.website === expected.website;

export class OpsEntityWorkspaceProfileCommand {
  private inFlight = false;

  constructor(private readonly dependencies: ProfileCommandDependencies) {}

  readonly save = async (draft: EntityWorkspaceProfileDraft): Promise<void> => {
    if (this.inFlight) throw new Error('OPS_ENTITY_PROFILE_COMMAND_IN_FLIGHT');
    const context = this.dependencies.readSnapshot().context;
    if (context.status !== 'selected') throw new Error('OPS_ENTITY_PROFILE_CONTEXT_REQUIRED');
    if (this.dependencies.isHistoryActive()) throw new Error('OPS_ENTITY_PROFILE_LIVE_MODE_REQUIRED');
    const adapter = this.dependencies.readAdapter();
    if (!adapter) throw new Error('OPS_ENTITY_PROFILE_RUNTIME_REQUIRED');
    const expected = normalizeEntityWorkspaceProfileDraft(draft);
    const input = buildEntityWorkspaceProfileUpdateInput({
      entityId: context.entityId,
      signerId: context.signerId ?? '',
    }, expected);
    this.inFlight = true;
    try {
      // The projection proves what may be edited; only the authenticated owner
      // lane authorizes mutation. Admin read authority is never sufficient.
      await adapter.ensureOwnerCommandLane();
      if (adapter.commandLaneKind !== 'owner') {
        throw new Error(`OPS_ENTITY_PROFILE_OWNER_LANE_REQUIRED:${adapter.runtimeId}`);
      }
      const commandSequence = adapter.nextCommandSequence;
      if (!Number.isSafeInteger(commandSequence) || Number(commandSequence) <= 0) {
        throw new Error('OPS_ENTITY_PROFILE_COMMAND_SEQUENCE_REQUIRED');
      }
      const accepted = await adapter.send(input, {
        commandId: createRuntimeCommandId(),
        commandSequence: Number(commandSequence),
      });
      await this.waitForCommit(context.entityId, expected, accepted.height + 1);
    } finally {
      this.inFlight = false;
    }
  };

  private waitForCommit(
    entityId: string,
    expected: EntityWorkspaceProfileDraft,
    targetHeight: number,
  ): Promise<void> {
    const generation = this.dependencies.readGeneration();
    return new Promise((resolve, reject) => {
      let settled = false;
      let unsubscribe = (): void => {};
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribe();
        if (error) reject(error);
        else resolve();
      };
      const inspect = (): void => {
        if (generation !== this.dependencies.readGeneration()) {
          finish(new Error('OPS_ENTITY_PROFILE_SESSION_CHANGED'));
          return;
        }
        const snapshot = this.dependencies.readSnapshot();
        if (snapshot.readState.status === 'error') {
          finish(new Error(`OPS_ENTITY_PROFILE_READ_FAILED:${snapshot.readState.message}`));
          return;
        }
        if (snapshot.readState.status === 'ready'
          && snapshot.context.status === 'selected'
          && snapshot.context.entityId === entityId
          && snapshot.context.height >= targetHeight
          && profileMatches(snapshot.profile, expected)) finish();
      };
      const timeout = setTimeout(() => finish(new Error(
        `OPS_ENTITY_PROFILE_COMMIT_TIMEOUT:target=${targetHeight}:latest=${this.dependencies.readSnapshot().context.height}`,
      )), PROFILE_COMMIT_TIMEOUT_MS);
      unsubscribe = this.dependencies.subscribe(inspect);
      inspect();
      this.dependencies.refresh();
    });
  }
}
