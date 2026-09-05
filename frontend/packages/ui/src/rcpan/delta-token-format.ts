export function iconForSymbol(rawSymbol: string): { text: string; cls: string } {
    const s = String(rawSymbol || '').toUpperCase();
    if (s === 'USDC') return { text: '$', cls: 'usdc' };
    if (s === 'USDT') return { text: '$', cls: 'usdt' };
    if (s === 'WETH' || s === 'ETH') return { text: 'E', cls: 'weth' };
    return { text: s.slice(0, 1) || 'T', cls: 'other' };
  }

export function normalizeAmount(raw: string): string {
    return String(raw || '').replace(/\s+/g, ' ').trim();
  }

export function stripTrailingSymbol(rawAmount: string, rawSymbol: string): string {
    const amount = normalizeAmount(rawAmount);
    const symbolText = String(rawSymbol || '').trim();
    if (!amount || !symbolText) return amount;
    const escaped = symbolText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return amount.replace(new RegExp(`\\s+${escaped}\\s*$`, 'i'), '').trim();
  }

export function formatUsdHint(valueUsd: number): string {
    if (!Number.isFinite(valueUsd) || valueUsd <= 0) return '';
    if (valueUsd >= 1000) return `~$${Math.round(valueUsd).toLocaleString('en-US')}`;
    if (valueUsd >= 1) return `~$${valueUsd.toFixed(0)}`;
    return `~$${valueUsd.toFixed(2)}`;
  }

export function formatHoldHint(value: bigint, decimals: number): string {
    if (value <= 0n) return '';
    const scale = 10n ** BigInt(Math.max(0, decimals));
    const whole = value / scale;
    const fraction = value % scale;
    const fractionText = fraction
      .toString()
      .padStart(Math.max(0, decimals), '0')
      .slice(0, Math.min(4, Math.max(0, decimals)))
      .replace(/0+$/, '');
    const amountText = fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
    return `${amountText} hold`;
  }
