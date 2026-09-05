import { expect, test } from 'bun:test';
import { buildDeltaCapacityBarModel } from '../../../frontend/packages/ui/src/rcpan/delta-capacity-bar-model';
import { buildDeltaAppleModel } from '../../../frontend/packages/ui/src/rcpan/delta-apple-model';
import { formatHoldHint, stripTrailingSymbol } from '../../../frontend/packages/ui/src/rcpan/delta-token-format';

const derived = { outCapacity: 25n, inCapacity: 75n, outOwnCredit: 0n, outCollateral: 25n, outPeerCredit: 0n, inOwnCredit: 0n, inCollateral: 25n, inPeerCredit: 50n };
const settings = { accountBarUsdPerPx: 20, barCreditGradient: true, barAnimTransition: true, barAnimSweep: false, barAnimGlow: false, barAnimRipple: false };

test('retained capacity bar geometry keeps BigInt percentages and scales both sides consistently', () => {
  const input = { derived, heightPx: 12, visualScale: null, presentation: null, settings };
  const relative = buildDeltaCapacityBarModel(input);
  expect(relative.pctOf(9007199254740993000n, 18014398509481986000n)).toBe(50);
  expect(relative.pctOf(1n, 0n)).toBe(0);
  expect(relative.halfMax).toBe(75n);
  const scale = { outCapacityUsd: 40, inCapacityUsd: 120, outOwnCreditUsd: 0, outCollateralUsd: 40, outPeerCreditUsd: 0, inOwnCreditUsd: 0, inCollateralUsd: 40, inPeerCreditUsd: 80, outTotalUsd: 40, inTotalUsd: 120 };
  const normal = buildDeltaCapacityBarModel({ ...input, visualScale: scale });
  const magnified = buildDeltaCapacityBarModel({ ...input, visualScale: scale, settings: { ...settings, accountBarUsdPerPx: 10 } });
  expect([normal.outWidthPx, normal.inWidthPx]).toEqual([1, 3]);
  expect([magnified.outWidthPx, magnified.inWidthPx]).toEqual([2, 6]);
  expect(normal.creditSegStyle(400)).toContain('width:300px');
  expect(() => buildDeltaCapacityBarModel({ ...input, presentation: { durationsMs: { sweep: -1 } } })).toThrow('finite non-negative');
});

test('retained Apple markers preserve capacity perspective and empty-state placement', () => {
  const view = buildDeltaAppleModel(derived, 0);
  expect([view.markerPct, view.collStartPct, view.collWidthPct, view.pipsFilled]).toEqual([25, 0, 50, 2]);
  expect([view.sendCredit, view.recvCredit, view.collateralTotal]).toEqual([0n, 50n, 50n]);
  const empty = buildDeltaAppleModel({ ...derived, outCapacity: 0n, inCapacity: 0n }, 0);
  expect([empty.empty, empty.markerPct, empty.pipsFilled]).toEqual([true, 50, 0]);
});

test('retained token display strips only a trailing symbol and keeps exact hold digits', () => {
  expect(stripTrailingSymbol('  9007199254740993.0001 USDC  ', 'USDC')).toBe('9007199254740993.0001');
  expect(stripTrailingSymbol('2 TOKEN+', 'TOKEN+')).toBe('2');
  expect(stripTrailingSymbol('USDC 2 USD', 'USDC')).toBe('USDC 2 USD');
  expect(formatHoldHint(9007199254740993123456n, 6)).toBe('9007199254740993.1234 hold');
  expect(formatHoldHint(0n, 18)).toBe('');
});
