import { useEffect, useRef, useState } from 'react';
import type { WalletAccountContext } from '../../../../bridges/wallet/wallet-canonical-account-context';
import { createLoadTestingController } from '../../../../src/lib/components/Entity/account/load-testing/load-testing-controller';
import { LoadTestScheduler, type LoadTestSchedulerSnapshot } from '../../../../src/lib/components/Entity/account/load-testing/load-testing-scheduler';
import type { WalletPaymentSource } from '../payments/wallet-payment-source';

export function WalletLoadTesting({ context, source, accountId }: Readonly<{ context: WalletAccountContext; source: WalletPaymentSource; accountId: string }>) {
  const current = useRef(context); current.current = context;
  const [rates, setRates] = useState({ pay: 1, swap: 1, duration: 10 });
  const [snapshot, setSnapshot] = useState<LoadTestSchedulerSnapshot | null>(null);
  const [error, setError] = useState('');
  const [scheduler] = useState(() => {
    const controller = createLoadTestingController({ sourceEntityId: () => current.current.entityId, selectedHubEntityId: () => accountId,
      paymentView: () => current.current.paymentView, swapView: () => current.current.swapView, sourceReplica: () => current.current.replica,
      runtimeFunctions: () => current.current.xln, random: Math.random,
      resolveSignerId: entityId => {
        const entry = current.current.swapView.localReplicaEntries.find(entry => entry.entityId === entityId);
        if (!entry || !entry.signerId) throw new Error(`LOAD_TEST_SIGNER_UNAVAILABLE:${entityId}`);
        return entry.signerId;
      },
      submitRuntimeInput: async input => {
        if (input.entityInputs.length !== 1 || !input.entityInputs[0] || input.runtimeTxs.length || (input.jInputs && input.jInputs.length)) throw new Error('LOAD_TEST_INPUT_INVALID');
        const command = input.entityInputs[0];
        if (!command.entityTxs) throw new Error('LOAD_TEST_TRANSACTIONS_MISSING');
        await source.submitAccountTxs(command.entityId, command.entityTxs);
      },
    });
    return new LoadTestScheduler({ now: Date.now, random: Math.random, setTimer: (run, delay) => setTimeout(run, delay),
      clearTimer: timer => clearTimeout(timer), attempt: lane => controller.attempt(lane), onSnapshot: setSnapshot });
  });
  useEffect(() => () => scheduler.stop(), [scheduler]);
  const running = snapshot ? snapshot.running : false;
  const disabled = !context.commandsReady || !context.env || !accountId;
  return <section data-testid="account-load-testing-panel"><h2>Load Testing</h2><p>Best-effort traffic. Available routes only; capacity misses are skipped without retries or bursts.</p>
    {disabled ? <p role="status">Load Testing requires a live embedded Runtime and selected Account.</p> : null}
    <fieldset disabled={disabled || running} className="wallet-tool-fields">{(['pay', 'swap', 'duration'] as const).map(key => <label key={key}>{key === 'duration' ? 'Duration' : key === 'pay' ? 'Pay rate' : 'Swap rate'} · {rates[key]} {key === 'duration' ? 'min' : 'ops/s'}
      <input data-testid={`load-${key === 'duration' ? 'duration' : `${key}-rate`}`} type="range" min={key === 'duration' ? 1 : 0.1} max="100" step={key === 'duration' ? 1 : 0.1} value={rates[key]} onChange={event => setRates({ ...rates, [key]: Number(event.target.value) })} /></label>)}</fieldset>
    <button disabled={!running && disabled} data-testid={running ? 'load-test-stop' : 'load-test-start'} onClick={() => {
      setError(''); try { if (running) scheduler.stop(); else scheduler.start({ durationMinutes: rates.duration, pay: { enabled: true, rate: rates.pay }, swap: { enabled: true, rate: rates.swap } }); } catch (cause) { setError(String(cause)); }
    }}>{running ? 'Stop test' : 'Start test'}</button>
    <p>{snapshot ? snapshot.elapsedSeconds : 0}s elapsed · {running ? 'Running' : 'Ready'}</p>
    {snapshot ? <dl className="wallet-tool-metrics">{(['pay', 'swap'] as const).map(lane => <div key={lane}><dt>{lane}</dt><dd>{snapshot.metrics[lane].attempted} attempted · {snapshot.metrics[lane].submitted} submitted · {snapshot.metrics[lane].skipped} skipped · {snapshot.metrics[lane].failed} failed · {snapshot.metrics[lane].stpPrevented} self-trade prevented</dd><dd>{snapshot.lastResult[lane]}</dd></div>)}</dl> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
