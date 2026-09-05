import { useEffect, useRef, useState } from 'react';
import type { DeltaParts } from './delta-types';
import type { DeltaBarSettings } from './delta-capacity-bar-model';

type EffectName = 'sweep' | 'glow' | 'ripple' | 'flash';
type AnimationState = Readonly<{ sweep: boolean; glow: boolean; ripple: boolean; flash: bigint | null }>;

export function useDeltaBarAnimation(derived: DeltaParts, settings: DeltaBarSettings & { barAnimDeltaFlash: boolean }) {
  const [state, setState] = useState<AnimationState>({ sweep: false, glow: false, ripple: false, flash: null });
  const previous = useRef({ out: 0n, inbound: 0n });
  const timers = useRef(new Map<EffectName, ReturnType<typeof setTimeout>>());
  const { outCapacity, inCapacity } = derived;
  const { barAnimSweep, barAnimGlow, barAnimRipple, barAnimDeltaFlash } = settings;
  useEffect(() => {
    const prior = previous.current;
    const changed = prior.out !== outCapacity || prior.inbound !== inCapacity;
    const trigger = (name: EffectName, duration: number, value: boolean | bigint) => {
      clearTimeout(timers.current.get(name));
      setState(current => ({ ...current, [name]: value }));
      timers.current.set(name, setTimeout(() => {
        setState(current => ({ ...current, [name]: name === 'flash' ? null : false }));
        timers.current.delete(name);
      }, duration));
    };
    if ((prior.out !== 0n || prior.inbound !== 0n) && changed) {
      if (barAnimSweep) trigger('sweep', 700, true);
      if (barAnimGlow) trigger('glow', 600, true);
      if (barAnimRipple) trigger('ripple', 800, true);
    }
    if (barAnimDeltaFlash && prior.out !== 0n && prior.out !== outCapacity) trigger('flash', 1500, outCapacity - prior.out);
    previous.current = { out: outCapacity, inbound: inCapacity };
  }, [outCapacity, inCapacity, barAnimSweep, barAnimGlow, barAnimRipple, barAnimDeltaFlash]);
  useEffect(() => {
    const active = timers.current;
    return () => { for (const timer of active.values()) clearTimeout(timer); active.clear(); };
  }, []);
  return state;
}
