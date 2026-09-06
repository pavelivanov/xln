import type { AccountTx } from '@xln/core/api/public/runtime-module';

export type AccountActionParam = {
    label: string;
    value: string;
    tone?: 'default' | 'good' | 'warn' | 'danger';
  };
type ActionParam = AccountActionParam;
export type AccountActivityPresentationInput = Readonly<{
  entityNames: ReadonlyMap<string, string>;
  htlcNotes?: ReadonlyMap<string, string> | undefined;
  activeXlnFunctions: { getTokenInfo?: (id: number) => { symbol?: string } | null | undefined; formatTokenAmount?: (id: number, value: bigint) => string } | null | undefined;
}>;

// Extracted from AccountPanel: display formatting only, never command input.
export function createAccountActivityPresentation({ entityNames, htlcNotes, activeXlnFunctions }: AccountActivityPresentationInput) {
  function formatTimestamp(ms: number): string {
    if (!ms) return '';
    const d = new Date(ms);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions);
  }

  function txTypeLabel(type: string): string {
    const known: Record<string, string> = {
      request_collateral: 'Request Collateral',
      reserve_to_collateral: 'Reserve to Collateral',
      account_settle: 'Account Settle',
      j_event_claim: 'J Event Claim',
      direct_payment: 'Direct Payment',
      add_delta: 'Add Delta',
      set_credit_limit: 'Set Credit Limit',
    };
    if (known[type]) return known[type];
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatKeyLabel(raw: string): string {
    const known: Record<string, string> = {
      offerId: 'Offer',
      pullId: 'Pull',
      crossJurisdiction: 'Cross-J leg',
      crossJurisdictionRoute: 'Cross-J route',
      tokenId: 'Token',
      giveTokenId: 'Sell Token',
      wantTokenId: 'Buy Token',
      amount: 'Amount',
      giveAmount: 'Sell Amount',
      wantAmount: 'Buy Amount',
      priceTicks: 'Limit Price',
      fillRatio: 'Fill',
      cancelRemainder: 'Cancel Remainder',
      requestId: 'Request ID',
      approved: 'Approved',
      counterpartyEntityId: 'Counterparty',
      fromEntityId: 'From',
      toEntityId: 'To',
      jHeight: 'J Height',
      blockNumber: 'J Block',
      jBlockHash: 'J Block Hash',
      transactionHash: 'Tx Hash',
      workspaceVersion: 'Workspace',
      jNonce: 'Nonce',
      feeTokenId: 'Fee Token',
      feeAmount: 'Fee',
      events: 'Events',
      observedAt: 'Observed',
      description: 'Description',
      route: 'Route',
      revealBeforeHeight: 'Reveal Before',
      hashlock: 'Hashlock',
      lockId: 'Lock ID',
      timelock: 'Timelock',
      policyVersion: 'Policy Version',
      r2cRequestSoftLimit: 'R2C Request Soft Limit',
      hardLimit: 'Hard Limit',
      maxAcceptableFee: 'Max Acceptable Fee',
    };
    if (known[raw]) return known[raw];
    return raw.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  }

  function toBigIntSafe(value: unknown): bigint | null {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) return BigInt(value);
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
    return null;
  }

  function toNumberSafe(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
    return null;
  }

  function toTokenIdSafe(value: unknown): number | null {
    const num = toNumberSafe(value);
    if (num === null || !Number.isFinite(num) || num <= 0) return null;
    return Math.floor(num);
  }

  function tokenLabel(tokenId: number): string {
    const tokenInfo = activeXlnFunctions?.getTokenInfo?.(tokenId);
    return tokenInfo?.symbol ? `${tokenInfo.symbol} (#${tokenId})` : `Token #${tokenId}`;
  }

  function entityLabel(entityRaw: unknown): string {
    const entity = String(entityRaw || '');
    if (!entity) return '-';
    const resolvedName = entityNames.get(entity.trim().toLowerCase()) || '';
    const short = entity.length > 18 ? `${entity.slice(0, 10)}...${entity.slice(-4)}` : entity;
    if (resolvedName && resolvedName.toLowerCase() !== entity.toLowerCase()) return `${resolvedName} (${short})`;
    return short;
  }

  function fillRatioToPercent(ratioRaw: unknown): string {
    const ratio = toNumberSafe(ratioRaw);
    if (ratio === null) return '-';
    const clamped = Math.max(0, Math.min(65535, ratio));
    return `${((clamped / 65535) * 100).toFixed(2)}%`;
  }

  function tokenIdForAmountKey(data: Record<string, unknown>, key: string): number | null {
    if (key === 'giveAmount') return toTokenIdSafe(data['giveTokenId']);
    if (key === 'wantAmount') return toTokenIdSafe(data['wantTokenId']);
    if (key === 'feeAmount') return toTokenIdSafe(data['feeTokenId']) ?? toTokenIdSafe(data['tokenId']);
    return toTokenIdSafe(data['tokenId']);
  }

  function formatDataValue(key: string, value: unknown, data: Record<string, unknown>): ActionParam {
    const label = formatKeyLabel(key);
    if (key === 'counterpartyEntityId' || key === 'fromEntityId' || key === 'toEntityId') {
      return { label, value: entityLabel(value) };
    }
    if (key === 'transactionHash' || key === 'jBlockHash') {
      const hash = String(value || '');
      return { label, value: hash.length > 18 ? `${hash.slice(0, 12)}...${hash.slice(-6)}` : hash || '-' };
    }
    if (key === 'route' && Array.isArray(value)) {
      const path = value
        .map((hop) => String(hop || '').trim())
        .filter(Boolean)
        .map((hop) => entityLabel(hop));
      return { label, value: path.length > 0 ? path.join(' → ') : '-' };
    }
    if ((key === 'crossJurisdiction' || key === 'crossJurisdictionRoute') && value && typeof value === 'object') {
      const cross = value as Record<string, unknown>;
      const orderId = String(cross['orderId'] || '-');
      const leg = String(cross['leg'] || '').trim();
      const status = String(cross['status'] || '').trim();
      const parts = [orderId, leg, status].filter(Boolean);
      return { label, value: parts.join(' · ') };
    }
    if (key === 'observedAt') {
      const observedAt = toNumberSafe(value);
      if (observedAt === null || observedAt <= 0) return { label, value: '-' };
      return {
        label,
        value: new Date(observedAt).toLocaleString(undefined, {
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
    }
    if (key === 'description') {
      const text = String(value || '').trim();
      return { label, value: text || '-' };
    }
    if (key === 'offerId' || key === 'requestId' || key === 'lockId') {
      return { label, value: String(value || '-') };
    }
    if (key === 'events' && Array.isArray(value)) {
      const preview = value
        .slice(0, 3)
        .map((ev) => String((ev as { type?: unknown })?.type || 'event').replace(/_/g, ' '))
        .join(', ');
      const suffix = value.length > 3 ? ', ...' : '';
      return { label, value: `${value.length} · ${preview}${suffix}` };
    }
    if (key.endsWith('TokenId') || key === 'tokenId' || key === 'feeTokenId') {
      const tokenId = toTokenIdSafe(value);
      return { label, value: tokenId ? tokenLabel(tokenId) : '-' };
    }
    if (key === 'fillRatio') {
      return { label, value: fillRatioToPercent(value) };
    }
    if (key === 'priceTicks') {
      const ticks = toBigIntSafe(value);
      if (ticks === null) return { label, value: String(value || '-') };
      const whole = ticks / 10_000n;
      const frac = (ticks % 10_000n).toString().padStart(4, '0').replace(/0+$/, '');
      return { label, value: frac ? `${whole}.${frac}` : whole.toString() };
    }
    if (key === 'approved' || key === 'cancelRemainder') {
      const boolVal = Boolean(value);
      return { label, value: boolVal ? 'Yes' : 'No', tone: boolVal ? 'good' : 'warn' };
    }
    const big = toBigIntSafe(value);
    if (big !== null) {
      const tokenId = tokenIdForAmountKey(data, key);
      if (tokenId) return { label, value: formatTokenAmountSafe(tokenId, big) };
      return { label, value: big.toString() };
    }
    if (Array.isArray(value)) return { label, value: `${value.length} item(s)` };
    if (value && typeof value === 'object') return { label, value: `${Object.keys(value as Record<string, unknown>).length} field(s)` };
    return { label, value: String(value ?? '-') };
  }

  function getHtlcNote(data: Record<string, unknown>): string | null {
    const notes = htlcNotes;
    if (!(notes instanceof Map)) return null;
    const hashlock = typeof data['hashlock'] === 'string' ? data['hashlock'] : '';
    if (hashlock) {
      const hashNote = notes.get(`hashlock:${hashlock}`);
      if (typeof hashNote === 'string' && hashNote.trim()) return hashNote.trim();
    }
    return null;
  }

  function buildActionParams(tx: AccountTx): ActionParam[] {
    const data = (tx?.data && typeof tx.data === 'object') ? (tx.data as Record<string, unknown>) : {};
    const orderedKeys = [
      'offerId',
      'pullId',
      'crossJurisdiction',
      'crossJurisdictionRoute',
      'counterpartyEntityId',
      'fromEntityId',
      'toEntityId',
      'tokenId',
      'giveTokenId',
      'wantTokenId',
      'amount',
      'giveAmount',
      'wantAmount',
      'description',
      'route',
      'priceTicks',
      'fillRatio',
      'cancelRemainder',
      'requestId',
      'approved',
      'feeTokenId',
      'feeAmount',
      'r2cRequestSoftLimit',
      'hardLimit',
      'maxAcceptableFee',
      'workspaceVersion',
      'jHeight',
      'jBlockHash',
      'observedAt',
      'events',
      'blockNumber',
      'transactionHash',
      'jNonce',
    ];
    const keys = Object.keys(data);
    const seen = new Set<string>();
    const out: ActionParam[] = [];
    for (const key of orderedKeys) {
      if (!(key in data)) continue;
      seen.add(key);
      out.push(formatDataValue(key, data[key], data));
    }
    for (const key of keys) {
      if (seen.has(key)) continue;
      out.push(formatDataValue(key, data[key], data));
    }
    if (!('description' in data)) {
      const htlcNote = getHtlcNote(data);
      if (htlcNote) out.push({ label: 'Comment', value: htlcNote });
    }
    return out;
  }

  function txKindTone(type: string): 'neutral' | 'good' | 'warn' | 'danger' {
    if (type === 'swap_resolve' || type === 'account_settle') return 'good';
    if (type === 'swap_cancel_request' || type === 'request_collateral') return 'warn';
    return 'neutral';
  }

  function formatTokenAmountSafe(tokenId: number, value: bigint): string {
    return activeXlnFunctions?.formatTokenAmount
      ? activeXlnFunctions.formatTokenAmount(tokenId, value)
      : value.toString();
  }


  return { formatTimestamp, txTypeLabel, txKindTone, buildActionParams };
}
