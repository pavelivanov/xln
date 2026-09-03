type RuntimeMaterial = Readonly<{ runtimeId: string }>;

type ActiveMaterial<Material> = Readonly<{
  token: string;
  material: Material;
}>;

export class WalletBrainVaultMaterialSession<Material extends RuntimeMaterial> {
  private revision = 0;
  private active: ActiveMaterial<Material> | null = null;

  begin(): number {
    this.revision += 1;
    this.active = null;
    return this.revision;
  }

  commit(revision: number, material: Material): string {
    if (revision !== this.revision) throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
    const token = `${material.runtimeId}:${revision}`;
    this.active = { token, material };
    return token;
  }

  discard(token = ''): boolean {
    if (token && this.active?.token !== token) return false;
    this.revision += 1;
    this.active = null;
    return true;
  }

  consume(token: string, runtimeId: string): Material {
    const active = this.active;
    if (!active || active.token !== token || active.material.runtimeId !== runtimeId) {
      throw new Error('WALLET_BRAINVAULT_DERIVATION_STALE');
    }
    this.discard(token);
    return active.material;
  }
}
