<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { buildDeltaCapacityBarModel } from '../../../../../packages/ui/src/rcpan/delta-capacity-bar-model';
  import { settings } from '$lib/stores/settingsStore';
  import type { DeltaCapacityBarPresentation, DeltaParts, DeltaVisualScale } from './delta-types';

  export let derived: DeltaParts;
  export let heightPx: number = 4;
  export let layout: 'center' | 'sides' = 'center';
  export let pendingOutDebtMode: 'none' | 'pending' | 'settling' = 'none';
  export let visualScale: DeltaVisualScale | null = null;
  export let interactive = false;
  export let expanded = false;
  export let presentation: DeltaCapacityBarPresentation | null = null;

  const dispatch = createEventDispatcher<{ activate: void }>();

  $: ({ outTotal, inTotal, halfMax, animTransition, animSweep, animGlow, animRipple, sweepMs, glowMs, rippleMs, presentationStyle, outVisualDebtUsd, hasVisualScale, outOwnWidthPx, outCollWidthPx, outDebtWidthPx, inOwnWidthPx, inCollWidthPx, inCreditWidthPx, outWidthPx, inWidthPx, outCenterWidthStyle, inCenterWidthStyle, outSideWidthStyle, inSideWidthStyle, pctOf, segmentWidthStyle, creditSegStyle, creditPctStyle } = buildDeltaCapacityBarModel({ derived, heightPx, visualScale, presentation, settings: $settings }));

  // Sweep animation: trigger on capacity change (right-to-left = inbound from hub)
  let sweepActive = false;
  let sweepTimer: ReturnType<typeof setTimeout> | undefined;
  let glowActive = false;
  let glowTimer: ReturnType<typeof setTimeout> | undefined;
  let rippleActive = false;
  let rippleTimer: ReturnType<typeof setTimeout> | undefined;
  let prevOutCap = 0n;
  let prevInCap = 0n;

  function activateSweep(): void {
    if (sweepTimer !== undefined) clearTimeout(sweepTimer);
    sweepActive = true;
    sweepTimer = setTimeout(() => { sweepActive = false; }, sweepMs);
  }

  function activateGlow(): void {
    if (glowTimer !== undefined) clearTimeout(glowTimer);
    glowActive = true;
    glowTimer = setTimeout(() => { glowActive = false; }, glowMs);
  }

  function activateRipple(): void {
    if (rippleTimer !== undefined) clearTimeout(rippleTimer);
    rippleActive = true;
    rippleTimer = setTimeout(() => { rippleActive = false; }, rippleMs);
  }

  $: {
    const curOut = derived.outCapacity;
    const curIn = derived.inCapacity;
    const initialized = prevOutCap !== 0n || prevInCap !== 0n;
    const changed = curOut !== prevOutCap || curIn !== prevInCap;
    if (initialized && changed) {
      if (animSweep) activateSweep();
      if (animGlow) activateGlow();
      if (animRipple) activateRipple();
    }
    prevOutCap = curOut;
    prevInCap = curIn;
  }

  onDestroy(() => {
    if (sweepTimer !== undefined) clearTimeout(sweepTimer);
    if (glowTimer !== undefined) clearTimeout(glowTimer);
    if (rippleTimer !== undefined) clearTimeout(rippleTimer);
  });

  function activate(event?: MouseEvent | KeyboardEvent): void {
    if (!interactive) return;
    event?.stopPropagation();
    dispatch('activate');
  }
</script>

<svelte:element
  this={interactive ? 'button' : 'div'}
  class="delta-capacity-bar"
  class:visual-center={hasVisualScale && layout === 'center'}
  class:visual-sides={hasVisualScale && layout === 'sides'}
  class:interactive={interactive}
  class:anim-transition={animTransition}
  class:anim-glow={glowActive}
  type={interactive ? 'button' : undefined}
  role={interactive ? 'button' : undefined}
  aria-expanded={interactive ? expanded : undefined}
  on:click={activate}
  style={presentationStyle}
>
  {#if hasVisualScale}
    <div class="track"></div>
    {#if sweepActive}<div class="sweep-line"></div>{/if}
    {#if rippleActive}<div class="ripple-ring"></div>{/if}

    {#if layout === 'center'}
      <div class="axis">
        <div class="delta-cut"></div>
      </div>

      {#if outWidthPx > 0}
        <div class="shell out center-shell" style={outCenterWidthStyle}>
          {#if outOwnWidthPx > 0}<div class="seg credit" style={creditSegStyle(outOwnWidthPx)}></div>{/if}
          {#if outCollWidthPx > 0}<div class="seg coll" style={segmentWidthStyle(outCollWidthPx)}></div>{/if}
          {#if outVisualDebtUsd > 0}
            <div
              class="seg debt"
              class:striped={pendingOutDebtMode === 'pending'}
              class:settling={pendingOutDebtMode === 'settling'}
              style={segmentWidthStyle(outDebtWidthPx)}
            ></div>
          {/if}
        </div>
      {/if}

      {#if inWidthPx > 0}
        <div class="shell in center-shell" style={inCenterWidthStyle}>
          {#if inOwnWidthPx > 0}<div class="seg debt" style={segmentWidthStyle(inOwnWidthPx)}></div>{/if}
          {#if inCollWidthPx > 0}<div class="seg coll" style={segmentWidthStyle(inCollWidthPx)}></div>{/if}
          {#if inCreditWidthPx > 0}<div class="seg credit" style={creditSegStyle(inCreditWidthPx)}></div>{/if}
        </div>
      {/if}
    {:else}
      {#if outWidthPx > 0}
        <div class="shell out side-shell" style={outSideWidthStyle}>
          {#if outOwnWidthPx > 0}<div class="seg credit" style={creditSegStyle(outOwnWidthPx)}></div>{/if}
          {#if outCollWidthPx > 0}<div class="seg coll" style={segmentWidthStyle(outCollWidthPx)}></div>{/if}
          {#if outVisualDebtUsd > 0}
            <div
              class="seg debt"
              class:striped={pendingOutDebtMode === 'pending'}
              class:settling={pendingOutDebtMode === 'settling'}
              style={segmentWidthStyle(outDebtWidthPx)}
            ></div>
          {/if}
        </div>
      {/if}

      {#if inWidthPx > 0}
        <div class="shell in side-shell" style={inSideWidthStyle}>
          {#if inOwnWidthPx > 0}<div class="seg debt" style={segmentWidthStyle(inOwnWidthPx)}></div>{/if}
          {#if inCollWidthPx > 0}<div class="seg coll" style={segmentWidthStyle(inCollWidthPx)}></div>{/if}
          {#if inCreditWidthPx > 0}<div class="seg credit" style={creditSegStyle(inCreditWidthPx)}></div>{/if}
        </div>
      {/if}
    {/if}
  {:else if halfMax === 0n}
    <div class="bar empty"></div>
  {:else if layout === 'sides'}
    <div class="bar one-sided">
      {#if derived.outOwnCredit > 0n}<div class="seg credit" style={creditPctStyle(pctOf(derived.outOwnCredit, outTotal + inTotal))}></div>{/if}
      {#if derived.outCollateral > 0n}<div class="seg coll" style={`width:${pctOf(derived.outCollateral, outTotal + inTotal)}%`}></div>{/if}
      {#if derived.outPeerCredit > 0n}
        <div
          class="seg debt"
          class:striped={pendingOutDebtMode === 'pending'}
          class:settling={pendingOutDebtMode === 'settling'}
          style={`width:${pctOf(derived.outPeerCredit, outTotal + inTotal)}%`}
        ></div>
      {/if}

      {#if derived.inOwnCredit > 0n}<div class="seg debt" style={`width:${pctOf(derived.inOwnCredit, outTotal + inTotal)}%`}></div>{/if}
      {#if derived.inCollateral > 0n}<div class="seg coll" style={`width:${pctOf(derived.inCollateral, outTotal + inTotal)}%`}></div>{/if}
      {#if derived.inPeerCredit > 0n}<div class="seg credit" style={creditPctStyle(pctOf(derived.inPeerCredit, outTotal + inTotal))}></div>{/if}

      {#if outTotal > 0n && inTotal > 0n}
        <div class="mid one-sided-sep" style={`left:${pctOf(outTotal, outTotal + inTotal)}%`}>
          <div class="delta-cut"></div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="bar center split-center">
      <div class="half out">
        {#if derived.outOwnCredit > 0n}<div class="seg credit" style={creditPctStyle(pctOf(derived.outOwnCredit, halfMax))}></div>{/if}
        {#if derived.outCollateral > 0n}<div class="seg coll" style={`width:${pctOf(derived.outCollateral, halfMax)}%`}></div>{/if}
        {#if derived.outPeerCredit > 0n}
          <div
            class="seg debt"
            class:striped={pendingOutDebtMode === 'pending'}
            class:settling={pendingOutDebtMode === 'settling'}
            style={`width:${pctOf(derived.outPeerCredit, halfMax)}%`}
          ></div>
        {/if}
      </div>
      <div class="mid">
        <div class="delta-cut"></div>
      </div>
      <div class="half in">
        {#if derived.inOwnCredit > 0n}<div class="seg debt" style={`width:${pctOf(derived.inOwnCredit, halfMax)}%`}></div>{/if}
        {#if derived.inCollateral > 0n}<div class="seg coll" style={`width:${pctOf(derived.inCollateral, halfMax)}%`}></div>{/if}
        {#if derived.inPeerCredit > 0n}<div class="seg credit" style={creditPctStyle(pctOf(derived.inPeerCredit, halfMax))}></div>{/if}
      </div>
    </div>
  {/if}
</svelte:element>

<style>
  .delta-capacity-bar {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    position: relative;
    appearance: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: initial;
  }

  .delta-capacity-bar.interactive {
    cursor: pointer;
  }

  .delta-capacity-bar.interactive:focus-visible {
    outline: 2px solid rgba(251, 191, 36, 0.78);
    outline-offset: 4px;
    border-radius: 6px;
  }

  .track {
    width: 100%;
    height: var(--bar-h);
    border-radius: 999px;
    background: var(--bar-track-color);
    box-shadow: inset 0 0 0 0.5px rgba(82, 82, 91, 0.35);
  }

  .axis,
  .mid {
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--center-gap);
    background: transparent;
    border: none;
    box-shadow: none;
    z-index: 4;
  }

  .axis {
    left: 50%;
    transform: translateX(-50%);
  }

  .bar {
    width: 100%;
    height: var(--bar-h);
    display: flex;
    align-items: center;
    position: relative;
  }

  .bar.empty {
    border-radius: 999px;
    background: var(--bar-track-color);
    box-shadow: inset 0 0 0 0.5px rgba(82, 82, 91, 0.35);
    opacity: 0.45;
  }

  .bar.one-sided {
    border-radius: 999px;
    overflow: hidden;
    background: var(--bar-track-color);
    box-shadow: inset 0 0 0 0.5px rgba(82, 82, 91, 0.35);
    display: flex;
    align-items: stretch;
  }

  .bar.split-center {
    justify-content: center;
  }

  .shell {
    position: absolute;
    top: 0;
    bottom: 0;
    min-width: 0;
    border-radius: 999px;
    overflow: hidden;
    display: flex;
    align-items: stretch;
    background: transparent;
    box-shadow: none;
    z-index: 2;
  }

  /* Smooth width transition when enabled */
  .anim-transition .shell,
  .anim-transition .seg,
  .anim-transition .half {
    transition: width var(--bar-transition-duration) ease-out;
  }

  .visual-center .shell.out.center-shell {
    right: calc(50% + var(--center-gap) / 2);
    justify-content: flex-end;
    background: transparent;
    box-shadow: none;
  }

  .visual-center .shell.in.center-shell {
    left: calc(50% + var(--center-gap) / 2);
    justify-content: flex-start;
    background: transparent;
    box-shadow: none;
  }

  .visual-sides .shell.out.side-shell {
    left: 0;
    justify-content: flex-start;
  }

  .visual-sides .shell.in.side-shell {
    right: 0;
    justify-content: flex-end;
  }

  .half {
    display: flex;
    align-items: stretch;
    height: 100%;
    overflow: hidden;
    min-width: 0;
    flex: 1 1 auto;
    background: transparent;
    box-shadow: none;
    border-radius: 999px;
  }

  .half.out {
    justify-content: flex-end;
  }

  .half.in {
    justify-content: flex-start;
  }

  .mid {
    flex: 0 0 auto;
  }

  .mid.one-sided-sep {
    width: 12px;
    background: transparent;
    transform: translateX(-6px);
  }

  /* Delta boundary — subtle cut mark */
  .delta-cut {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1.5px;
    height: calc(var(--bar-h) + 6px);
    background: var(--bar-delta-color);
    border-radius: 0;
    box-shadow: 0 0 3px var(--bar-delta-shadow);
    z-index: 5;
    pointer-events: none;
  }

  .seg {
    min-width: 1px;
    height: 100%;
    opacity: 0.92;
  }

  /* credit = bright white — peer credit promise */
  .seg.credit {
    background: var(--bar-credit-color);
  }

  /* coll = electric green — hard collateral */
  .seg.coll {
    background: var(--bar-collateral-color);
  }

  /* debt = hot red — uncollateralized exposure */
  .seg.debt {
    background: var(--bar-debt-color);
  }

  .seg.debt.striped {
    background: repeating-linear-gradient(
      -45deg,
      #f43f5e 0px,
      #f43f5e 3px,
      #fbbf24 3px,
      #fbbf24 6px
    );
    background-size: 8px 8px;
    animation: stripe-scroll var(--bar-stripe-duration) linear infinite;
  }

  .seg.debt.settling {
    background: linear-gradient(180deg, #fbbf24, #f59e0b);
    animation: settling-pulse var(--bar-settling-duration) ease-in-out infinite;
  }

  /* ── Glow animation ── */
  .anim-glow .shell,
  .anim-glow .bar:not(.empty) {
    animation: bar-glow var(--bar-glow-duration) ease-out;
  }

  @keyframes bar-glow {
    0% { filter: brightness(1.8) drop-shadow(0 0 8px rgba(34, 197, 94, 0.5)); }
    100% { filter: brightness(1) drop-shadow(0 0 0 transparent); }
  }

  /* ── Sweep animation (right-to-left = inbound from hub to user) ── */
  .sweep-line {
    position: absolute;
    top: -1px;
    bottom: -1px;
    width: 30px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), rgba(251, 191, 36, 0.3), transparent);
    z-index: 10;
    animation: sweep-rtl var(--bar-sweep-duration) ease-out forwards;
    pointer-events: none;
  }

  @keyframes sweep-rtl {
    0% { right: -30px; opacity: 1; }
    100% { right: 100%; opacity: 0; }
  }

  /* ── Ripple animation (expanding ring from center) ── */
  .ripple-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid rgba(251, 191, 36, 0.6);
    transform: translate(-50%, -50%);
    z-index: 10;
    animation: ripple-expand var(--bar-ripple-duration) ease-out forwards;
    pointer-events: none;
  }

  @keyframes ripple-expand {
    0% { width: 10px; height: 10px; opacity: 1; border-width: 2px; }
    100% { width: 200px; height: 40px; opacity: 0; border-width: 1px; }
  }

  @keyframes stripe-scroll {
    0% { background-position: 0 0; }
    100% { background-position: 8px 8px; }
  }

  @keyframes settling-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }

  @media (prefers-reduced-motion: reduce) {
    .anim-transition .shell,
    .anim-transition .seg,
    .anim-transition .half {
      transition: none;
    }

    .anim-glow .shell,
    .anim-glow .bar:not(.empty),
    .seg.debt.striped,
    .seg.debt.settling {
      animation: none;
    }

    .sweep-line,
    .ripple-ring {
      display: none;
    }
  }
</style>
