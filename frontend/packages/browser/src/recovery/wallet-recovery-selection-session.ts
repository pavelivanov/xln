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

  private requireActive(token: string, runtimeId: string): ActiveRecoverySelection<Candidate> {
    const active = this.active;
    if (!active || active.token !== token || active.runtimeId !== runtimeId) {
      throw new Error('WALLET_RECOVERY_DISCOVERY_STALE');
    }
    return active;
  }

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

  read(token: string, runtimeId: string): readonly Candidate[] {
    return this.requireActive(token, runtimeId).candidates;
  }

  update(
    token: string,
    runtimeId: string,
    transform: (candidates: readonly Candidate[]) => readonly Candidate[],
  ): readonly Candidate[] {
    const active = this.requireActive(token, runtimeId);
    const candidates = transform(active.candidates);
    if (this.active !== active) throw new Error('WALLET_RECOVERY_DISCOVERY_STALE');
    this.active = { ...active, candidates: [...candidates] };
    return this.active.candidates;
  }

  consume(token: string, runtimeId: string, candidateId: string): Candidate | undefined {
    const active = this.requireActive(token, runtimeId);
    const { candidates } = active;
    const candidate = candidateId
      ? candidates.find(current => current.id === candidateId)
      : undefined;
    if (candidates.length > 0 && !candidate) {
      throw new Error('WALLET_RECOVERY_CANDIDATE_REQUIRED');
    }
    this.discard(token);
    return candidate;
  }
}
