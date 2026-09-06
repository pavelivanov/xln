export type EntityInputProfile = Readonly<{ entityId: string; name: string }>;
export type ParsedEntityInput = Readonly<{ entityId: string; shortId: string; resolved: boolean }>;
type EntityInputOptions = Readonly<{
  entities: readonly string[];
  profiles: readonly EntityInputProfile[];
  strictValueInput?: boolean;
}>;

const lookupEntity = (query: string, profiles: readonly EntityInputProfile[]): string | null => {
  const normalized = query.toLowerCase();
  for (const profile of profiles) if (profile.entityId.slice(2, 6).toLowerCase() === normalized) return profile.entityId;
  for (const profile of profiles) if (profile.name.toLowerCase() === normalized) return profile.entityId;
  return null;
};

export function getShortIdFromHex(hex: string): string {
  const clean = hex.replace('0x', '').toLowerCase();
  if (/^[0-9a-f]+$/.test(clean)) {
    const number = BigInt(`0x${clean}`);
    if (number < BigInt(256 ** 6)) return number.toString();
  }
  return clean.slice(0, 4).toUpperCase();
}

// Shared with the retained EntityInput: invoice suffix, full hex, short hex,
// numbered and named resolution retain their existing precedence.
export function parseEntityInput(input: string, options: EntityInputOptions): ParsedEntityInput {
  const trimmed = input.trim();
  if (!trimmed) return { entityId: '', shortId: '', resolved: false };
  const invoice = trimmed.match(/^(0x[0-9a-fA-F]{64})\?.+$/);
  const invoiceEntityId = invoice?.[1];
  if (invoiceEntityId) return { entityId: invoiceEntityId.toLowerCase(), shortId: getShortIdFromHex(invoiceEntityId), resolved: true };
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return { entityId: trimmed.toLowerCase(), shortId: getShortIdFromHex(trimmed), resolved: true };
  if (options.strictValueInput) return { entityId: trimmed, shortId: '', resolved: false };
  const short = trimmed.match(/^#?([0-9a-fA-F]{4})$/i)?.[1]?.toLowerCase();
  if (short) {
    const found = lookupEntity(short, options.profiles) || options.entities.find(id => id.slice(2, 6).toLowerCase() === short);
    return { entityId: found || '', shortId: short.toUpperCase(), resolved: Boolean(found) };
  }
  const numbered = trimmed.match(/^#?(\d+)$/)?.[1];
  if (numbered) {
    const number = BigInt(numbered);
    if (number >= 0n && number < BigInt(256 ** 6)) {
      return { entityId: `0x${number.toString(16).padStart(64, '0')}`, shortId: number.toString(), resolved: true };
    }
  }
  const name = trimmed.match(/^@?([a-zA-Z][a-zA-Z0-9_.-]*)$/)?.[1]?.toLowerCase();
  if (name) {
    const found = lookupEntity(name, options.profiles);
    return { entityId: found || '', shortId: name, resolved: Boolean(found) };
  }
  if (/^0x[0-9a-fA-F]+$/.test(trimmed) && trimmed.length >= 6) {
    return { entityId: trimmed.toLowerCase(), shortId: trimmed.slice(2, 6).toUpperCase(), resolved: false };
  }
  return { entityId: trimmed, shortId: '', resolved: false };
}
