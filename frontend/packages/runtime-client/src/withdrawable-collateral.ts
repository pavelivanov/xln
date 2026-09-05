/** The shared wallet bound consumes the caller perspective from core deriveDelta. */
export const withdrawableCollateral = (derived: Readonly<{
  outCollateral: bigint;
  outTotalHold: bigint;
}>): bigint => derived.outCollateral > derived.outTotalHold
  ? derived.outCollateral - derived.outTotalHold
  : 0n;
