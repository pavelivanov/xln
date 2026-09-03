export type WalletRecoverySelectionCandidate = Readonly<{ id: string }>;

type ActiveRecoverySelection<Candidate> = Readonly<{
  token: string;
  runtimeId: string;
  candidates: readonly Candidate[];
}>;

export class WalletRecoverySelectionSession<
  Candidate extends WalletRecoverySelectionCandidate,
> {
  private revision = 0;
  private active: ActiveRecoverySelection<Candidate> | null = null;

  begin(): number {
    this.revision += 1;
    this.active = null;
    return this.revision;
  }

  commit(revision: number, runtimeId: string, candidates: readonly Candidate[]): string {
    if (revision !== this.revision) throw new Error('WALLET_RECOVERY_DISCOVERY_CANCELLED');
    const token = `${runtimeId}:${revision}`;
    this.active = { token, runtimeId, candidates };
    return token;
  }

  discard(token = ''): void {
    if (token && this.active?.token !== token) return;
    this.revision += 1;
    this.active = null;
  }

  consume(token: string, runtimeId: string, candidateId: string): Candidate | undefined {
    const active = this.active;
    if (!active || active.token !== token || active.runtimeId !== runtimeId) {
      throw new Error('WALLET_RECOVERY_DISCOVERY_STALE');
    }
    const candidate = candidateId
      ? active.candidates.find(current => current.id === candidateId)
      : undefined;
    if (active.candidates.length > 0 && !candidate) {
      throw new Error('WALLET_RECOVERY_CANDIDATE_REQUIRED');
    }
    this.discard(token);
    return candidate;
  }
}
