export function isPlaceholderEntityName(value: string): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  if (/^signer\s+\d+$/i.test(normalized)) return true;
  if (/^entity\s+[0-9a-f]{4,}$/i.test(normalized)) return true;
  return false;
}

export function formatAddress(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 18) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
}

export function shortHash(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '-';
  return formatAddress(text);
}

export type EntityWorkspaceTimestamp = Readonly<{
  dateTime: string;
  label: string;
}>;

export function formatEntityWorkspaceTimestamp(timestamp: number): EntityWorkspaceTimestamp {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 8_640_000_000_000_000) {
    throw new Error('ENTITY_WORKSPACE_TIMESTAMP_INVALID');
  }
  const dateTime = new Date(timestamp).toISOString();
  const separator = dateTime.indexOf('T');
  return {
    dateTime,
    label: `${dateTime.slice(0, separator)} ${dateTime.slice(separator + 1, -5)} UTC`,
  };
}
