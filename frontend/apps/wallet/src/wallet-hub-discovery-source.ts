import type { RuntimeAdapter, RuntimeInput } from '@xln/core/api/public/runtime-module';
import { RuntimeQueryObserver } from '../../../packages/runtime-client/src/runtime-query-observer';
import { compareStableText } from '../../../src/lib/utils/stableSort';
import { connectDiscoveredHub } from '../../../src/lib/components/Entity/onboarding/hub-discovery-commands';
import { openAccountById } from '../../../src/lib/components/Entity/account/account-open-commands';
import { isFullEntityId } from '../../../src/lib/components/Entity/workspace/entity-panel-options';
import type { WalletAccountOpenRead } from './wallet-account-open-model';
import type { HubDiscoveryHub } from '../../../src/lib/components/Entity/onboarding/hub-discovery-profile';
import { createWalletRuntimeQueryClient, walletRuntimeReadErrorMessage } from './wallet-runtime-read-boundary';
import { abandonTerminalWalletPaymentCommand, executeWalletPaymentCommand, prepareWalletPaymentCommand, type WalletPreparedCommand } from './wallet-payment-command';

export type WalletHubDetails = Readonly<{
  fee: number | null;
  peerCount: number | null;
  description: string;
  website: string;
  timestamp: number;
  raw: string;
}>;

export type WalletHubDiscoverySnapshot = Readonly<{
  loading: boolean;
  error: string;
  hubs: readonly HubDiscoveryHub[];
  canOpenAccounts: boolean;
  permissionError: string;
  connectingHubId: string;
  retryHubId: string;
  messageKind: 'hub' | 'direct';
  retryKind: 'hub' | 'direct' | null;
  notice: string;
  entities: WalletAccountOpenRead['entities'];
  profiles: WalletAccountOpenRead['profiles'];
  disputed: WalletAccountOpenRead['disputed'];
}>;

export class WalletHubDiscoverySource {
  private readonly runtimeId: string;
  private readonly listeners = new Set<() => void>();
  private observer: RuntimeQueryObserver<WalletAccountOpenRead> | null = null;
  private release = () => {};
  private lifetime = new AbortController();
  private pending: Readonly<{ hubId: string; kind: 'hub' | 'direct'; command: WalletPreparedCommand }> | null = null;
  private commandError = '';
  private snapshot: WalletHubDiscoverySnapshot = {
    loading: true, error: '', hubs: [], canOpenAccounts: false, permissionError: '', connectingHubId: '', retryHubId: '',
    messageKind: 'hub', retryKind: null, notice: '', entities: [], profiles: [], disputed: [],
  };

  constructor(private readonly adapter: RuntimeAdapter, private readonly entityId: string) {
    this.runtimeId = adapter.runtimeId;
  }
  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(next: Partial<WalletHubDiscoverySnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }
  private requireCurrent() {
    this.lifetime.signal.throwIfAborted();
    if (this.adapter.runtimeId !== this.runtimeId) throw new Error('HUB_DISCOVERY_RUNTIME_CHANGED');
  }
  private readonly readContext = async (targetId = ''): Promise<WalletAccountOpenRead> => {
    this.requireCurrent();
    const [bridge, frame] = await Promise.all([
      import('../../../bridges/wallet-canonical-hub-discovery'),
      createWalletRuntimeQueryClient(this.adapter).readViewFrame({ entityId: this.entityId, accountsLimit: 200, booksLimit: 1,
        ...(isFullEntityId(targetId) ? { accountId: targetId } : {}),
      }),
    ]);
    this.requireCurrent();
    const targetFrame = this.adapter.mode === 'remote' && isFullEntityId(targetId) && targetId !== this.entityId.toLowerCase()
      ? await createWalletRuntimeQueryClient(this.adapter).readViewFrame({ entityId: targetId, atHeight: frame.height, accountsLimit: 1, booksLimit: 1 })
      : undefined;
    this.requireCurrent();
    const context = await bridge.readCanonicalHubDiscovery(this.adapter, this.entityId, frame, targetId, targetFrame);
    this.requireCurrent();
    return context;
  };
  readonly start = () => {
    this.lifetime = new AbortController();
    this.observer = new RuntimeQueryObserver(this.readContext, {
      readHeight: () => this.adapter.currentHeight,
      subscribeHeight: listener => this.adapter.onChange(listener),
      subscribeAdapter: listener => this.adapter.onStatus(listener),
    });
    const publish = () => {
      if (!this.observer) return;
      const observed = this.observer.getSnapshot();
      const context = observed.data;
      this.patch({ loading: observed.loading, error: this.commandError || observed.error || '',
        hubs: context ? [...context.projection.localHubs].sort((a, b) => compareStableText(a.name, b.name)) : [],
        canOpenAccounts: Boolean(context?.canOpenAccounts), permissionError: context?.permissionError || '',
        entities: context?.entities || [], profiles: context?.profiles || [],
        disputed: context?.disputed || [],
      });
    };
    this.release = this.observer.subscribe(publish); publish();
  };
  readonly stop = () => { this.lifetime.abort(); this.release(); this.observer?.destroy(); this.observer = null; };
  readonly refresh = async () => { await this.observer?.refresh(); };
  readonly clearDirectMessage = () => {
    if (this.pending || this.snapshot.messageKind !== 'direct' || (!this.commandError && !this.snapshot.notice)) return;
    this.commandError = '';
    this.patch({ error: this.observer?.getSnapshot().error || '', notice: '' });
  };
  readonly readDetails = async (hubId: string): Promise<WalletHubDetails | null> => {
    this.requireCurrent();
    const [frame, { safeStringify }] = await Promise.all([
      createWalletRuntimeQueryClient(this.adapter).readViewFrame({ entityId: hubId, accountsLimit: 1, booksLimit: 1 }),
      import('../../../../core/protocol/serialization'),
    ]);
    this.requireCurrent();
    const entity = frame.activeEntity;
    // An advertised Entity need not be hosted by the selected Runtime. Its
    // summary has no fee, Account count or timestamp; never infer those values.
    if (!entity || entity.core.entityId.toLowerCase() !== hubId.toLowerCase()) return null;
    return {
      fee: entity.core.hubRebalanceConfig?.routingFeePPM ?? null,
      peerCount: entity.accounts.totalItems ?? null,
      description: entity.core.profile.bio, website: entity.core.profile.website,
      timestamp: entity.core.timestamp, raw: safeStringify(entity.core.profile, 2),
    };
  };
  readonly connect = async (hubId: string): Promise<void> => { await this.openTarget('hub', hubId); };
  readonly openDirect = async (targetId: string): Promise<boolean> => this.openTarget('direct', targetId.trim().toLowerCase());
  private async openTarget(kind: 'hub' | 'direct', hubId: string): Promise<boolean> {
    if (this.snapshot.connectingHubId) return false;
    this.commandError = '';
    this.patch({ connectingHubId: hubId, messageKind: kind, error: '', notice: '' });
    try {
      if (this.pending && (this.pending.hubId !== hubId || this.pending.kind !== kind)) throw new Error('Retry the pending Account request first.');
      let submitted = true;
      if (this.pending) await this.executePending();
      else {
        const { getTokenInfo } = await import('../../../../core/account/utils');
        this.requireCurrent();
        if (kind === 'hub') await connectDiscoveredHub(hubId, {
          readContext: this.readContext, readTokenDecimals: () => getTokenInfo(1).decimals,
          submitRuntimeInput: input => this.submit(kind, hubId, input),
        });
        else {
          const result = await openAccountById(hubId, {
            readContext: async target => (await this.readContext(target)).direct,
            readTokenDecimals: () => getTokenInfo(1).decimals,
            submitRuntimeInput: input => this.submit(kind, hubId, input),
          });
          submitted = result === 'submitted';
        }
      }
      this.requireCurrent();
      if (!this.pending && kind === 'direct') this.patch({ notice: submitted ? 'Account request sent' : 'Account with this entity already exists' });
      await this.refresh();
      return submitted && !this.pending;
    } catch (cause) {
      if (!this.lifetime.signal.aborted) {
        this.commandError = walletRuntimeReadErrorMessage(cause);
        this.patch({ error: this.commandError, retryHubId: this.pending?.hubId || '', retryKind: this.pending?.kind || null });
      }
      return false;
    } finally { if (!this.lifetime.signal.aborted) this.patch({ connectingHubId: '' }); }
  }
  private async submit(kind: 'hub' | 'direct', hubId: string, input: RuntimeInput) {
    this.requireCurrent();
    const command = await prepareWalletPaymentCommand(this.adapter, input);
    this.requireCurrent();
    this.pending = { hubId, kind, command };
    await this.executePending();
  }
  private async executePending() {
    const pending = this.pending;
    if (!pending) throw new Error('HUB_DISCOVERY_PENDING_COMMAND_REQUIRED');
    this.requireCurrent();
    try {
      const result = await executeWalletPaymentCommand(this.adapter, pending.command);
      if (pending.command.mode === 'embedded' || result.status === 'observed') {
        this.pending = null; this.commandError = ''; this.patch({ retryHubId: '', retryKind: null, error: '' });
      } else {
        this.commandError = `Account request accepted after height ${result.height}; observation is pending. Retry this same request before opening another Account.`;
        this.patch({ retryHubId: pending.hubId, retryKind: pending.kind, error: this.commandError });
      }
    } catch (cause) {
      const failure = await abandonTerminalWalletPaymentCommand(pending.command, cause);
      if (failure.terminal) this.pending = null;
      throw cause;
    }
  }
}
