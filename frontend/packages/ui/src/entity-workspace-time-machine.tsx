import { useEffect, useState, type FormEvent } from 'react';

import type { EntityWorkspaceTimeMachineState } from '../../runtime-client/src/entity-workspace-time-machine';
import './entity-workspace-time-machine.css';

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'History read failed');

export function EntityWorkspaceTimeMachine({
  issue,
  onReturnLive,
  onSelectHeight,
  state,
}: Readonly<{
  issue: string;
  onReturnLive: () => void;
  onSelectHeight: (height: number) => Promise<boolean>;
  state: EntityWorkspaceTimeMachineState;
}>) {
  const [draft, setDraft] = useState(String(state.selectedHeight || 1));
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    setDraft(String(state.selectedHeight || 1));
    setInputError('');
  }, [state.selectedHeight]);

  const selectHeight = async (height: number): Promise<void> => {
    setInputError('');
    try {
      await onSelectHeight(height);
    } catch (error: unknown) {
      setInputError(errorMessage(error));
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const height = Number(draft);
    if (!Number.isSafeInteger(height) || height < 1 || height > state.latestHeight) {
      setInputError(`Enter a committed height from 1 to ${state.latestHeight}.`);
      return;
    }
    void selectHeight(height);
  };

  const canStepBack = !state.loading && state.selectedHeight > 1;
  const canStepForward = !state.loading && state.mode === 'history';
  const visibleIssue = inputError || issue || state.error;
  return (
    <section
      className="entity-workspace-time-machine"
      data-mode={state.mode}
      data-testid="entity-workspace-time-machine"
    >
      <header>
        <span>Time Machine</span>
        <strong data-testid="time-machine-mode">
          {state.loading ? `Reading h${state.selectedHeight}` : state.mode === 'live' ? `Live · h${state.latestHeight}` : `History · h${state.selectedHeight}`}
        </strong>
      </header>
      <div className="entity-workspace-time-machine-steps">
        <button disabled={!canStepBack} onClick={() => void selectHeight(state.selectedHeight - 1)} type="button">Previous</button>
        <button disabled={!canStepForward} onClick={() => void selectHeight(state.selectedHeight + 1)} type="button">Next</button>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="entity-history-height">Committed height</label>
        <input
          disabled={state.loading || state.latestHeight < 1}
          id="entity-history-height"
          inputMode="numeric"
          max={state.latestHeight}
          min="1"
          onChange={event => setDraft(event.currentTarget.value)}
          type="number"
          data-testid="time-machine-remote-height"
          value={draft}
        />
        <button data-testid="time-machine-remote-scan-button" disabled={state.loading || state.latestHeight < 1} type="submit">Read frame</button>
      </form>
      <div className="entity-workspace-time-machine-live">
        <span>Latest committed</span>
        <strong>h{state.latestHeight}</strong>
        <button data-testid="time-machine-return-live" disabled={state.loading || state.mode === 'live'} onClick={onReturnLive} type="button">Return live</button>
      </div>
      {visibleIssue ? <p role="alert">{visibleIssue}</p> : null}
    </section>
  );
}
