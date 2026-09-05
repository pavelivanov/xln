import type { DeltaParts } from './delta-types';

// Retained Apple skin geometry and display rounding; never used by commands.
export function buildDeltaAppleModel(derived: DeltaParts, decimals: number) {
  const num = (b: bigint | undefined): number => (b == null ? 0 : Number(b));
  function fmt(b: bigint | undefined): string {
    const v = num(b) / 10 ** decimals;
    if (v === 0) return '0';
    if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }

  const outCap = num(derived.outCapacity);
  const inCap = num(derived.inCapacity);
  const total = outCap + inCap;
  const empty = total <= 0;
  const pct = (x: number): number => (total > 0 ? Math.max(0, Math.min(100, (x / total) * 100)) : 0);
  const markerPct = total > 0 ? pct(outCap) : 50;
  const collStartPct = pct(outCap - num(derived.outCollateral));
  const collEndPct = pct(outCap + num(derived.inCollateral));
  const collWidthPct = Math.max(0, collEndPct - collStartPct);
  const pipsFilled = empty ? 0 : Math.max(1, Math.min(8, Math.round((markerPct / 100) * 8)));
  const outPct = markerPct;
  const inPct = Math.max(0, 100 - markerPct);


  const sendCredit = (derived.outOwnCredit ?? 0n) + (derived.outPeerCredit ?? 0n);
  const recvCredit = (derived.inOwnCredit ?? 0n) + (derived.inPeerCredit ?? 0n);
  const collateralTotal = (derived.outCollateral ?? 0n) + (derived.inCollateral ?? 0n);


  return { empty, markerPct, collStartPct, collWidthPct, pipsFilled, outPct, inPct, sendCredit, recvCredit, collateralTotal, fmt };
}
