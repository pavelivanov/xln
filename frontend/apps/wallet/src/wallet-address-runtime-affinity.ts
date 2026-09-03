import type { RuntimeAdapterStorageSnapshot } from '../../../packages/browser/src/runtime-adapter-session';
import type { StoredRemoteRuntimeImportEntry } from '../../../packages/browser/src/remote-runtime-import';

export type WalletAddressRuntimeAffinity = Readonly<{
  config: RuntimeAdapterStorageSnapshot;
  selectedImport: StoredRemoteRuntimeImportEntry | null;
}>;

const normalizeRuntimeId = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export const resolveWalletAddressRuntimeAffinity = (
  config: RuntimeAdapterStorageSnapshot,
  requestedRuntimeId: string,
  imports: readonly StoredRemoteRuntimeImportEntry[],
): WalletAddressRuntimeAffinity => {
  const requested = normalizeRuntimeId(requestedRuntimeId);
  if (!requested) return { config, selectedImport: null };

  const selectedImport = imports.reduce<StoredRemoteRuntimeImportEntry | null>(
    (selected, entry) => normalizeRuntimeId(entry.runtimeId) === requested ? entry : selected,
    null,
  );
  if (!selectedImport) return { config, selectedImport: null };

  return {
    config: {
      mode: 'remote',
      wsUrl: selectedImport.wsUrl,
      access: selectedImport.access,
      sessionKey: selectedImport.token,
    },
    selectedImport,
  };
};
