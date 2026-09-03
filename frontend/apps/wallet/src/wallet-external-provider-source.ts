import type {
  WalletExternalApprovalRequest,
  WalletExternalOperation,
  WalletExternalProviderReadyView,
  WalletExternalProviderView,
  WalletExternalTransferRequest,
} from '../../../packages/browser/src/wallet-external-provider';
import { walletExternalCompletionMessage } from '../../../packages/browser/src/wallet-external-provider';

export type WalletExternalProviderOperationState = Readonly<{
  status: 'idle' | 'submitting' | 'confirmed' | 'error';
  message: string;
  transactionHash: string;
}>;

export type WalletExternalProviderSnapshot = Readonly<{
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  message: string;
  view: WalletExternalProviderReadyView | null;
  operation: WalletExternalProviderOperationState;
}>;

type WalletExternalProviderDependencies = Readonly<{
  read: (entityId: string, signerId: string) => Promise<WalletExternalProviderView>;
  transfer: (request: WalletExternalTransferRequest) => Promise<WalletExternalOperation>;
  approve: (request: WalletExternalApprovalRequest) => Promise<WalletExternalOperation>;
}>;

const idleOperation = (): WalletExternalProviderOperationState => ({
  status: 'idle',
  message: '',
  transactionHash: '',
});

const loadDependencies = async (): Promise<WalletExternalProviderDependencies> => {
  const canonical = await import('../../../bridges/wallet-canonical-external-provider');
  return {
    read: canonical.readCanonicalWalletExternalProvider,
    transfer: canonical.transferCanonicalWalletExternalAsset,
    approve: canonical.approveCanonicalWalletExternalAsset,
  };
};

export class WalletExternalProviderSource {
  private readonly listeners = new Set<() => void>();
  private snapshot: WalletExternalProviderSnapshot = {
    status: 'loading',
    message: 'Resolving local wallet authority…',
    view: null,
    operation: idleOperation(),
  };
  private dependencies: WalletExternalProviderDependencies | null = null;
  private generation = 0;
  private started = false;
  private busy = false;

  constructor(
    private readonly entityId: string,
    private readonly signerId: string,
  ) {}

  readonly getSnapshot = (): WalletExternalProviderSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly start = async (): Promise<void> => {
    if (this.started) return;
    this.started = true;
    await this.refresh();
  };

  readonly stop = (): void => {
    this.started = false;
    this.generation += 1;
  };

  readonly refresh = async (): Promise<void> => {
    const generation = ++this.generation;
    this.patch({ status: 'loading', message: 'Reading one finalized wallet snapshot…' });
    try {
      const dependencies = this.dependencies ?? await loadDependencies();
      this.dependencies = dependencies;
      const view = await dependencies.read(this.entityId, this.signerId);
      if (!this.isCurrent(generation)) return;
      if (view.state === 'unavailable') {
        this.patch({ status: 'unavailable', message: view.reason, view: null });
        return;
      }
      this.patch({ status: 'ready', message: '', view });
    } catch (error: unknown) {
      if (!this.isCurrent(generation)) return;
      this.patch({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        view: null,
      });
    }
  };

  readonly transfer = async (input: Readonly<{
    tokenAddress: string;
    recipient: string;
    amount: bigint;
  }>): Promise<void> => {
    const view = this.requireWritableView();
    await this.runOperation(
      'Signing and confirming the external transfer…',
      (dependencies) => dependencies.transfer({ binding: view, ...input }),
    );
  };

  readonly approve = async (input: Readonly<{
    tokenAddress: string;
    amount: bigint;
  }>): Promise<void> => {
    const view = this.requireWritableView();
    await this.runOperation(
      'Approving the Depository from the bound signer…',
      (dependencies) => dependencies.approve({ binding: view, ...input }),
    );
  };

  readonly clearOperation = (): void => this.patch({ operation: idleOperation() });

  private async runOperation(
    message: string,
    run: (dependencies: WalletExternalProviderDependencies) => Promise<WalletExternalOperation>,
  ): Promise<void> {
    if (this.busy) throw new Error('EXTERNAL_WALLET_OPERATION_IN_PROGRESS');
    this.busy = true;
    this.patch({ operation: { status: 'submitting', message, transactionHash: '' } });
    try {
      const dependencies = this.dependencies ?? await loadDependencies();
      this.dependencies = dependencies;
      const outcome = await run(dependencies);
      this.patch({ operation: {
        status: 'confirmed',
        message: walletExternalCompletionMessage(outcome.kind, outcome.contextCurrent),
        transactionHash: outcome.transactionHash,
      } });
      if (outcome.contextCurrent) await this.refresh();
    } catch (error: unknown) {
      const failure = error instanceof Error ? error.message : String(error);
      this.patch({ operation: { status: 'error', message: failure, transactionHash: '' } });
      throw error;
    } finally {
      this.busy = false;
    }
  }

  private requireWritableView(): WalletExternalProviderReadyView {
    const view = this.snapshot.view;
    if (!view || this.snapshot.status !== 'ready') throw new Error('EXTERNAL_WALLET_VIEW_NOT_READY');
    if (!view.writable) throw new Error(`EXTERNAL_WALLET_AUTHORITY_LOCKED:${view.blockedReason}`);
    return view;
  }

  private isCurrent(generation: number): boolean {
    return this.started && generation === this.generation;
  }

  private patch(patch: Partial<WalletExternalProviderSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}
