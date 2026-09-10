import { ConfiguredStacks } from './configured-stacks';
import {
  useStackManagerController,
  type StackManagerTarget,
} from '../../../../packages/browser/src/stack-manager/stack-manager-controller';
import type { StackStablecoinKind, StackPublicationRequest } from '../../../../bridges/runtime/stack-manager-client';

const normalizedKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function StackManagerWorkspace(props: StackManagerTarget) {
  const {
    rpcUrl,
    setRpcUrl,
    signerId,
    setSignerId,
    networkName,
    setNetworkName,
    key,
    setKey,
    keyEdited,
    setKeyEdited,
    foundation,
    setFoundation,
    stablecoinKind,
    setStablecoinKind,
    setStablecoinEdited,
    stablecoinAddress,
    setStablecoinAddress,
    publication,
    setPublication,
    confirmations,
    setConfirmations,
    blockTimeMs,
    setBlockTimeMs,
    currency,
    setCurrency,
    explorer,
    setExplorer,
    description,
    setDescription,
    confirmed,
    setConfirmed,
    inspection,
    probe,
    deploying,
    result,
    load,
    invalidateProbe,
    deploy,
    response,
    canDeploy,
  } = useStackManagerController(props);
  return (
    <>
      <div className="ops-runtime-policy" data-testid="stack-manager-inspection">
        <p>Inspect the selected daemon's deployment status and probe an exact RPC with one of its Runtime signers.</p>
        <button type="button" disabled={inspection.busy || deploying} onClick={() => void load('', '')}>
          Refresh Runtime signers
        </button>
        {inspection.busy ? <p role="status">Loading Stack Manager…</p> : null}
        {inspection.issue ? <p role="alert">{inspection.issue}</p> : null}
        {response ? (
          <p data-testid="stack-manager-phase">
            Deployment phase: {response.status.phase}
            {response.status.active ? ' · active' : ''}
          </p>
        ) : null}
        {response?.status.error ? <p role="alert">{response.status.error}</p> : null}
        <label className="ops-settings-input">
          RPC URL
          <input
            data-testid="stack-manager-rpc"
            autoComplete="url"
            placeholder="https://your-chain.example/rpc"
            value={rpcUrl}
            onChange={event => {
              invalidateProbe();
              setRpcUrl(event.currentTarget.value);
            }}
          />
        </label>
        <label className="ops-settings-input">
          Runtime signer
          <select
            data-testid="stack-manager-signer"
            value={signerId}
            disabled={inspection.busy || !response?.signerIds.length}
            onChange={event => {
              invalidateProbe();
              const signer = event.currentTarget.value;
              setSignerId(signer);
              setFoundation(signer);
            }}
          >
            {!response?.signerIds.length ? (
              <option value="">No Runtime signers loaded</option>
            ) : (
              response.signerIds.map(id => <option key={id}>{id}</option>)
            )}
          </select>
        </label>
        <button
          type="button"
          disabled={inspection.busy || !rpcUrl.trim() || !signerId || !response}
          onClick={() => void load(rpcUrl.trim(), signerId)}
        >
          Probe RPC
        </button>
        {probe ? (
          <dl className="ops-audit-metrics" data-testid="stack-manager-probe">
            <div>
              <dt>RPC URL</dt>
              <dd>{probe.rpcUrl}</dd>
            </div>
            <div>
              <dt>Chain ID</dt>
              <dd>{probe.chainId}</dd>
            </div>
            <div>
              <dt>Runtime signer</dt>
              <dd>
                <code>{probe.signerId}</code>
              </dd>
            </div>
            <div>
              <dt>Native balance (wei)</dt>
              <dd>{probe.nativeBalanceWei}</dd>
            </div>
          </dl>
        ) : null}
      </div>
      <form
        className="ops-runtime-policy"
        data-testid="stack-manager-deployment"
        onSubmit={event => {
          event.preventDefault();
          void deploy();
        }}
      >
        <h4>Deploy and register V1 stack</h4>
        <label className="ops-settings-input">
          Network name
          <input
            data-testid="stack-manager-name"
            value={networkName}
            onChange={event => {
              const value = event.currentTarget.value;
              setNetworkName(value);
              if (!keyEdited) setKey(normalizedKey(value));
            }}
          />
        </label>
        <label className="ops-settings-input">
          Jurisdiction key
          <input
            data-testid="stack-manager-key"
            value={key}
            onChange={event => {
              setKeyEdited(true);
              setKey(event.currentTarget.value);
            }}
          />
        </label>
        <label className="ops-settings-input">
          Foundation recipient
          <input
            data-testid="stack-manager-foundation"
            value={foundation}
            onChange={event => setFoundation(event.currentTarget.value)}
          />
        </label>
        <label className="ops-settings-input">
          Stablecoin
          <select
            data-testid="stack-manager-stablecoin"
            value={stablecoinKind}
            onChange={event => {
              setStablecoinEdited(true);
              setStablecoinKind(event.currentTarget.value as StackStablecoinKind);
            }}
          >
            <option value="existing">Existing token</option>
            <option value="test">Deploy test USDT</option>
          </select>
        </label>
        {stablecoinKind === 'existing' ? (
          <label className="ops-settings-input">
            USDT address
            <input
              data-testid="stack-manager-usdt"
              value={stablecoinAddress}
              onChange={event => setStablecoinAddress(event.currentTarget.value)}
            />
          </label>
        ) : null}
        <label className="ops-settings-input">
          Publication
          <select
            data-testid="stack-manager-publication"
            value={publication}
            onChange={event => setPublication(event.currentTarget.value as StackPublicationRequest)}
          >
            <option value="local">Local</option>
            <option value="community">Community</option>
            <option value="official">Official</option>
          </select>
        </label>
        <label className="ops-settings-input">
          Confirmations
          <input
            data-testid="stack-manager-confirmations"
            min={1}
            type="number"
            value={confirmations}
            onChange={event => setConfirmations(Number(event.currentTarget.value))}
          />
        </label>
        <label className="ops-settings-input">
          Block time (ms)
          <input
            min={1}
            type="number"
            value={blockTimeMs}
            onChange={event => setBlockTimeMs(Number(event.currentTarget.value))}
          />
        </label>
        <label className="ops-settings-input">
          Currency
          <input value={currency} onChange={event => setCurrency(event.currentTarget.value)} />
        </label>
        <label className="ops-settings-input">
          Explorer
          <input value={explorer} onChange={event => setExplorer(event.currentTarget.value)} />
        </label>
        <label className="ops-settings-input">
          Description
          <input value={description} onChange={event => setDescription(event.currentTarget.value)} />
        </label>
        <label className="ops-settings-toggle">
          <input
            data-testid="stack-manager-confirm"
            type="checkbox"
            checked={confirmed}
            onChange={event => setConfirmed(event.currentTarget.checked)}
          />{' '}
          I verified the RPC, signer, chain, recipient, and publication scope.
        </label>
        <button data-testid="stack-manager-deploy" disabled={!canDeploy} type="submit">
          {deploying ? 'Deploying and verifying…' : 'Deploy V1 stack'}
        </button>
        {result ? (
          <section data-testid="stack-manager-result">
            <h5>{result.localJurisdiction.name} deployed and registered</h5>
            <p>
              Chain {result.manifest.chainId} · EntityProvider block {result.manifest.entityProviderDeploymentBlock} ·
              publication {result.publication.scope}/{result.publication.status}
            </p>
          </section>
        ) : null}
      </form>
    </>
  );
}

export function StackManager({
  origin,
  capability,
  isCurrent,
  restriction,
  contextKey = '',
}: StackManagerTarget & Readonly<{ restriction: string; contextKey?: string }>) {
  return (
    <section className="ops-stack-manager" data-testid="workspace-stack-manager">
      <h3>Stack Manager V1</h3>
      <ConfiguredStacks />
      {restriction ? (
        <p role="status">{restriction}</p>
      ) : (
        <StackManagerWorkspace
          key={`${contextKey}:${origin}:${capability}`}
          origin={origin}
          capability={capability}
          isCurrent={isCurrent}
        />
      )}
    </section>
  );
}
