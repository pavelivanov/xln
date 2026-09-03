export type WalletRuntimeLoginType = 'manual' | 'demo';

export type WalletRuntimeOpeningChoice = Readonly<{
  openLocal: boolean;
  forceFresh: boolean;
  hasRecoveryCandidate: boolean;
}>;

export const walletRuntimeOpeningNeedsLocalLookup = (
  choice: WalletRuntimeOpeningChoice,
): boolean => !choice.openLocal && !choice.forceFresh && !choice.hasRecoveryCandidate;

export type WalletRuntimeOpeningInput<
  RecoveryCandidate,
  UnlockDuration extends number | null,
> = Readonly<{
  runtimeId: string;
  name: string;
  labelOverride: string | undefined;
  seed: string;
  mnemonic12: string;
  devicePassphrase: string;
  loginType: WalletRuntimeLoginType;
  unlockDurationMs: UnlockDuration;
  recoveryCandidate: RecoveryCandidate | undefined;
  forceFresh: boolean;
  openLocal: boolean;
  localRuntimeExists: boolean;
}>;

export type WalletRuntimeOpeningPlan<
  RecoveryCandidate,
  UnlockDuration extends number | null,
> =
  | Readonly<{
    action: 'unlock-local';
    runtimeId: string;
    seed: string;
    unlockDurationMs: UnlockDuration;
  }>
  | Readonly<{
    action: 'create-runtime';
    label: string;
    seed: string;
    options: Readonly<{
      loginType: WalletRuntimeLoginType;
      requiresOnboarding: boolean;
      mnemonic12: string | undefined;
      devicePassphrase: string | undefined;
      recoveryCandidate: RecoveryCandidate | undefined;
      skipRecoveryRestore: boolean;
      unlockDurationMs: UnlockDuration;
    }>;
  }>;

export type WalletRuntimeOpeningExecutionInput<
  RecoveryCandidate,
  UnlockDuration extends number | null,
> = Omit<WalletRuntimeOpeningInput<RecoveryCandidate, UnlockDuration>, 'localRuntimeExists'>;

export type WalletRuntimeOpeningDependencies<
  RecoveryCandidate,
  UnlockDuration extends number | null,
  Runtime,
> = Readonly<{
  runtimeExists: (runtimeId: string) => boolean;
  unlockRuntime: (
    runtimeId: string,
    seed: string,
    unlockDurationMs: UnlockDuration,
  ) => Promise<void>;
  createRuntime: (
    label: string,
    seed: string,
    options: Extract<
      WalletRuntimeOpeningPlan<RecoveryCandidate, UnlockDuration>,
      { action: 'create-runtime' }
    >['options'],
  ) => Promise<Runtime>;
}>;

export type WalletRuntimeOpeningExecution<Runtime> =
  | Readonly<{ action: 'unlock-local'; runtime: null }>
  | Readonly<{ action: 'create-runtime'; runtime: Runtime }>;

const normalizeOptionalMnemonic = (mnemonic: string): string | undefined =>
  mnemonic.trim().split(/\s+/).join(' ') || undefined;

export const resolveWalletRuntimeOpeningPlan = <
  RecoveryCandidate,
  UnlockDuration extends number | null,
>(
  input: WalletRuntimeOpeningInput<RecoveryCandidate, UnlockDuration>,
): WalletRuntimeOpeningPlan<RecoveryCandidate, UnlockDuration> => {
  if (
    input.openLocal
    || (!input.forceFresh && input.recoveryCandidate === undefined && input.localRuntimeExists)
  ) {
    return {
      action: 'unlock-local',
      runtimeId: input.runtimeId,
      seed: input.seed,
      unlockDurationMs: input.unlockDurationMs,
    };
  }
  const label = (input.labelOverride || input.name || '').trim()
    || `Runtime ${input.runtimeId.slice(0, 6)}`;
  return {
    action: 'create-runtime',
    label,
    seed: input.seed,
    options: {
      loginType: input.loginType,
      requiresOnboarding: input.loginType !== 'demo',
      mnemonic12: normalizeOptionalMnemonic(input.mnemonic12),
      devicePassphrase: input.devicePassphrase || undefined,
      recoveryCandidate: input.recoveryCandidate,
      skipRecoveryRestore: input.recoveryCandidate === undefined,
      unlockDurationMs: input.unlockDurationMs,
    },
  };
};

export const executeWalletRuntimeOpening = async <
  RecoveryCandidate,
  UnlockDuration extends number | null,
  Runtime,
>(
  input: WalletRuntimeOpeningExecutionInput<RecoveryCandidate, UnlockDuration>,
  dependencies: WalletRuntimeOpeningDependencies<RecoveryCandidate, UnlockDuration, Runtime>,
): Promise<WalletRuntimeOpeningExecution<Runtime>> => {
  const openingChoice = {
    openLocal: input.openLocal,
    forceFresh: input.forceFresh,
    hasRecoveryCandidate: input.recoveryCandidate !== undefined,
  };
  const plan = resolveWalletRuntimeOpeningPlan({
    ...input,
    localRuntimeExists: walletRuntimeOpeningNeedsLocalLookup(openingChoice)
      ? dependencies.runtimeExists(input.runtimeId)
      : false,
  });
  if (plan.action === 'unlock-local') {
    await dependencies.unlockRuntime(plan.runtimeId, plan.seed, plan.unlockDurationMs);
    return { action: 'unlock-local', runtime: null };
  }
  const runtime = await dependencies.createRuntime(plan.label, plan.seed, plan.options);
  return { action: 'create-runtime', runtime };
};
