import type { DeltaCapacityBarPresentation, DeltaParts, DeltaVisualScale } from './delta-types';

export type DeltaBarSettings = Readonly<{
  accountBarUsdPerPx: number; barCreditGradient: boolean; barAnimTransition: boolean;
  barAnimSweep: boolean; barAnimGlow: boolean; barAnimRipple: boolean;
}>;

// Retained display geometry, extracted from DeltaCapacityBar.svelte.
// Capacities and credit ownership arrive from the canonical deriveDelta projection.
export function buildDeltaCapacityBarModel({ derived, heightPx, visualScale, presentation, settings }: Readonly<{ derived: DeltaParts; heightPx: number; visualScale: DeltaVisualScale | null; presentation: DeltaCapacityBarPresentation | null; settings: DeltaBarSettings; }>) {
  const CENTER_GAP_PX = 10;
  const SIDES_GAP_PX = 10;
  const MIN_VISIBLE_SIDE_PX = 0;
  const CREDIT_GRADIENT_MAX_PX = 300;

  const outTotal = derived.outOwnCredit + derived.outCollateral + derived.outPeerCredit;
  const inTotal = derived.inOwnCredit + derived.inCollateral + derived.inPeerCredit;
  const halfMax = outTotal > inTotal ? outTotal : inTotal;

  // Settings flags
  const creditGradient = presentation?.creditGradient ?? settings.barCreditGradient ?? true;
  const animTransition = presentation?.animations?.transition ?? settings.barAnimTransition ?? true;
  const animSweep = presentation?.animations?.sweep ?? settings.barAnimSweep ?? false;
  const animGlow = presentation?.animations?.glow ?? settings.barAnimGlow ?? false;
  const animRipple = presentation?.animations?.ripple ?? settings.barAnimRipple ?? false;

  const transitionMs = durationMs('transition', presentation?.durationsMs?.transition, 400);
  const sweepMs = durationMs('sweep', presentation?.durationsMs?.sweep, 700);
  const glowMs = durationMs('glow', presentation?.durationsMs?.glow, 600);
  const rippleMs = durationMs('ripple', presentation?.durationsMs?.ripple, 800);
  const stripeMs = durationMs('stripe', presentation?.durationsMs?.stripe, 800);
  const settlingMs = durationMs('settling', presentation?.durationsMs?.settling, 1000);

  const creditColor = presentation?.colors?.credit ?? 'rgba(255, 255, 255, 0.75)';
  const collateralColor = presentation?.colors?.collateral ?? '#22c55e';
  const debtColor = presentation?.colors?.debt ?? '#ef4444';
  const trackColor = presentation?.colors?.track ?? 'rgba(39, 39, 42, 0.9)';
  const deltaColor = presentation?.colors?.delta ?? '#dc6b6b';
  const deltaShadow = presentation?.colors?.delta
    ? `color-mix(in srgb, ${deltaColor} 30%, transparent)`
    : 'rgba(220, 107, 107, 0.3)';
  const presentationStyle = [
    `--bar-h:${heightPx}px`,
    `--center-gap:${CENTER_GAP_PX}px`,
    `--sides-gap:${SIDES_GAP_PX}px`,
    `--bar-credit-color:${creditColor}`,
    `--bar-collateral-color:${collateralColor}`,
    `--bar-debt-color:${debtColor}`,
    `--bar-track-color:${trackColor}`,
    `--bar-delta-color:${deltaColor}`,
    `--bar-delta-shadow:${deltaShadow}`,
    `--bar-transition-duration:${transitionMs}ms`,
    `--bar-sweep-duration:${sweepMs}ms`,
    `--bar-glow-duration:${glowMs}ms`,
    `--bar-ripple-duration:${rippleMs}ms`,
    `--bar-stripe-duration:${stripeMs}ms`,
    `--bar-settling-duration:${settlingMs}ms`
  ].join(';');

  const outVisualOwnUsd = visualScale?.outOwnCreditUsd ?? 0;
  const outVisualCollUsd = visualScale?.outCollateralUsd ?? 0;
  const outVisualDebtUsd = visualScale?.outPeerCreditUsd ?? 0;
  const inVisualOwnUsd = visualScale?.inOwnCreditUsd ?? 0;
  const inVisualCollUsd = visualScale?.inCollateralUsd ?? 0;
  const inVisualCreditUsd = visualScale?.inPeerCreditUsd ?? 0;
  const hasVisualScale = visualScale !== null;
  const usdPerPx = settings.accountBarUsdPerPx ?? 100;
  const visualUsdPerPx = usdPerPx * 2;
  const outOwnWidthPx = widthPxForUsd(outVisualOwnUsd, visualUsdPerPx);
  const outCollWidthPx = widthPxForUsd(outVisualCollUsd, visualUsdPerPx);
  const outDebtWidthPx = widthPxForUsd(outVisualDebtUsd, visualUsdPerPx);
  const inOwnWidthPx = widthPxForUsd(inVisualOwnUsd, visualUsdPerPx);
  const inCollWidthPx = widthPxForUsd(inVisualCollUsd, visualUsdPerPx);
  const inCreditWidthPx = widthPxForUsd(inVisualCreditUsd, visualUsdPerPx);
  const outWidthPx = widthPxForUsd(visualScale?.outCapacityUsd ?? 0, visualUsdPerPx);
  const inWidthPx = widthPxForUsd(visualScale?.inCapacityUsd ?? 0, visualUsdPerPx);
  const outCenterWidthStyle = shellWidthStyle(outWidthPx, CENTER_GAP_PX);
  const inCenterWidthStyle = shellWidthStyle(inWidthPx, CENTER_GAP_PX);
  const outSideWidthStyle = shellWidthStyle(outWidthPx, SIDES_GAP_PX);
  const inSideWidthStyle = shellWidthStyle(inWidthPx, SIDES_GAP_PX);

  function pctOf(value: bigint, base: bigint): number {
    return base > 0n ? Number((value * 10000n) / base) / 100 : 0;
  }

  function durationMs(name: string, value: number | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`DeltaCapacityBar ${name} duration must be a finite non-negative number`);
    }
    return value;
  }

  function widthPxForUsd(valueUsd: number, usdPerPixel: number): number {
    if (!Number.isFinite(valueUsd) || valueUsd <= 0 || !Number.isFinite(usdPerPixel) || usdPerPixel <= 0) return 0;
    return Math.max(MIN_VISIBLE_SIDE_PX, Math.round((valueUsd / usdPerPixel) * 100) / 100);
  }

  function shellWidthStyle(widthPx: number, gapPx: number): string {
    return `width:min(${widthPx}px, calc(50% - ${gapPx / 2}px));max-width:calc(50% - ${gapPx / 2}px)`;
  }

  function segmentWidthStyle(widthPx: number): string {
    return `width:${Math.max(0, widthPx)}px`;
  }

  function creditSegStyle(widthPx: number): string {
    const w = Math.max(0, widthPx);
    if (creditGradient && w > CREDIT_GRADIENT_MAX_PX) {
      return `width:${CREDIT_GRADIENT_MAX_PX}px;-webkit-mask-image:linear-gradient(to right,black 80%,transparent 100%);mask-image:linear-gradient(to right,black 80%,transparent 100%)`;
    }
    return `width:${w}px`;
  }

  function creditPctStyle(pct: number): string {
    if (creditGradient && pct > 60) {
      return `width:${pct}%;-webkit-mask-image:linear-gradient(to right,black 70%,transparent 100%);mask-image:linear-gradient(to right,black 70%,transparent 100%)`;
    }
    return `width:${pct}%`;
  }


  return { CENTER_GAP_PX, SIDES_GAP_PX, MIN_VISIBLE_SIDE_PX, CREDIT_GRADIENT_MAX_PX, outTotal, inTotal, halfMax, creditGradient, animTransition, animSweep, animGlow, animRipple, transitionMs, sweepMs, glowMs, rippleMs, stripeMs, settlingMs, creditColor, collateralColor, debtColor, trackColor, deltaColor, deltaShadow, presentationStyle, outVisualOwnUsd, outVisualCollUsd, outVisualDebtUsd, inVisualOwnUsd, inVisualCollUsd, inVisualCreditUsd, hasVisualScale, usdPerPx, visualUsdPerPx, outOwnWidthPx, outCollWidthPx, outDebtWidthPx, inOwnWidthPx, inCollWidthPx, inCreditWidthPx, outWidthPx, inWidthPx, outCenterWidthStyle, inCenterWidthStyle, outSideWidthStyle, inSideWidthStyle, pctOf, shellWidthStyle, segmentWidthStyle, creditSegStyle, creditPctStyle };
}
