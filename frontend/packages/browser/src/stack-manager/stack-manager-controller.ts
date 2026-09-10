import { useEffect, useRef, useState } from 'react';
import { deriveJMachineCreatedAt, jmachineOperations, type JMachineConfig } from '../jurisdiction/jmachine-store';
import {
  defaultStackStablecoinKind,
  deployStack,
  fetchStackManagerStatus,
  requireStackManagerProbe,
  type StackManagerDeployResult,
  type StackManagerProbe,
  type StackManagerStatusResponse,
  type StackPublicationRequest,
  type StackStablecoinKind,
} from '../../../../bridges/runtime/stack-manager-client';

type Inspection = Readonly<{ response: StackManagerStatusResponse | null; issue: string; busy: boolean }>;
const empty: Inspection = { response: null, issue: '', busy: false };
const errorMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));
const persistedDeployment = (
  result: StackManagerDeployResult,
  rpcUrl: string,
  blockTimeMs: number,
  ticker: string,
): JMachineConfig => {
  const manifest = result.manifest;
  const seed = {
    name: result.localJurisdiction.name,
    mode: 'rpc' as const,
    chainId: manifest.chainId,
    ticker,
    rpcs: [rpcUrl],
    blockTimeMs,
  };
  return {
    ...seed,
    entityProviderDeploymentBlock: manifest.entityProviderDeploymentBlock,
    contracts: {
      account: manifest.contracts.account,
      depository: manifest.contracts.depository,
      entityProvider: manifest.contracts.entityProvider,
      deltaTransformer: manifest.contracts.deltaTransformer,
    },
    createdAt: deriveJMachineCreatedAt(seed),
  };
};

export type StackManagerTarget = Readonly<{ origin: string; capability: string; isCurrent: () => boolean }>;

export function useStackManagerController({ origin, capability, isCurrent }: StackManagerTarget) {
  const [rpcUrl, setRpcUrl] = useState('');
  const [signerId, setSignerId] = useState('');
  const [networkName, setNetworkName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [foundation, setFoundation] = useState('');
  const [stablecoinKind, setStablecoinKind] = useState<StackStablecoinKind>('existing');
  const [stablecoinEdited, setStablecoinEdited] = useState(false);
  const [stablecoinAddress, setStablecoinAddress] = useState('');
  const [publication, setPublication] = useState<StackPublicationRequest>('local');
  const [confirmations, setConfirmations] = useState(12);
  const [blockTimeMs, setBlockTimeMs] = useState(12_000);
  const [currency, setCurrency] = useState('ETH');
  const [explorer, setExplorer] = useState('');
  const [description, setDescription] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [inspection, setInspection] = useState<Inspection>(empty);
  const [probe, setProbe] = useState<StackManagerProbe | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<StackManagerDeployResult | null>(null);
  const request = useRef<AbortController | null>(null);
  const alive = useRef(true);

  const load = async (nextRpc: string, nextSigner: string): Promise<void> => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setInspection({ response: null, issue: '', busy: true });
    setProbe(null);
    setResult(null);
    try {
      if (!isCurrent()) throw new Error('STACK_MANAGER_CONTEXT_CHANGED');
      const response = await fetchStackManagerStatus(origin, nextRpc, nextSigner, capability, (input, init) =>
        fetch(input, { ...init, signal: controller.signal }),
      );
      if (controller.signal.aborted || !alive.current || !isCurrent()) return;
      const exactProbe = nextRpc ? requireStackManagerProbe(response, nextRpc, nextSigner) : null;
      const signer = response.signerIds.includes(signerId) ? signerId : (response.signerIds[0] ?? '');
      setSignerId(signer);
      setFoundation(current => current || signer);
      setInspection({
        response,
        issue: response.signerIds.length ? '' : 'STACK_MANAGER_RUNTIME_SIGNER_REQUIRED',
        busy: false,
      });
      setProbe(exactProbe);
      if (exactProbe) {
        setConfirmations(exactProbe.chainId === 31_337 || exactProbe.chainId === 1_337 ? 1 : 12);
        if (!stablecoinEdited) setStablecoinKind(defaultStackStablecoinKind(exactProbe.chainId));
      }
    } catch (cause) {
      if (!controller.signal.aborted && alive.current)
        setInspection({ response: null, issue: errorMessage(cause), busy: false });
    }
  };
  useEffect(() => {
    alive.current = true;
    void load('', '');
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, [origin, capability]);
  const invalidateProbe = (): void => {
    request.current?.abort();
    setProbe(null);
    setResult(null);
    setConfirmed(false);
    setInspection(current => ({
      ...current,
      busy: false,
      response: current.response
        ? { ok: true, status: current.response.status, signerIds: current.response.signerIds }
        : null,
    }));
  };
  const deploy = async (): Promise<void> => {
    setDeploying(true);
    setResult(null);
    setInspection(current => ({ ...current, issue: '' }));
    try {
      if (!isCurrent()) throw new Error('STACK_MANAGER_CONTEXT_CHANGED');
      if (!probe || probe.rpcUrl !== rpcUrl.trim() || probe.signerId !== signerId)
        throw new Error('STACK_MANAGER_FRESH_PROBE_REQUIRED');
      if (!networkName.trim() || !key.trim() || !foundation.trim() || !confirmed)
        throw new Error('STACK_MANAGER_DEPLOYMENT_FIELDS_REQUIRED');
      const controller = new AbortController();
      request.current?.abort();
      request.current = controller;
      const response = await deployStack(
        origin,
        {
          name: networkName.trim(),
          key: key.trim(),
          rpcUrl: rpcUrl.trim(),
          expectedChainId: probe.chainId,
          blockTimeMs,
          currency: currency.trim(),
          explorer: explorer.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          signerId,
          foundationRecipient: foundation.trim(),
          stablecoin:
            stablecoinKind === 'test' ? { kind: 'test' } : { kind: 'existing', address: stablecoinAddress.trim() },
          publication,
          confirmations,
        },
        capability,
        (input, init) => fetch(input, { ...init, signal: controller.signal }),
      );
      if (!alive.current || controller.signal.aborted || !isCurrent()) return;
      jmachineOperations.upsert(persistedDeployment(response.result, rpcUrl.trim(), blockTimeMs, currency.trim()));
      jmachineOperations.setActive(response.result.localJurisdiction.name);
      setResult(response.result);
      setConfirmed(false);
    } catch (cause) {
      if (alive.current) setInspection(current => ({ ...current, issue: errorMessage(cause) }));
    } finally {
      if (alive.current) setDeploying(false);
    }
  };
  const response = inspection.response;
  const hasGas = probe !== null && BigInt(probe.nativeBalanceWei) > 0n;
  const canDeploy =
    !deploying &&
    !inspection.busy &&
    hasGas &&
    confirmed &&
    Boolean(
      networkName.trim() &&
      key.trim() &&
      foundation.trim() &&
      currency.trim() &&
      (stablecoinKind === 'test' || stablecoinAddress.trim()),
    );
  return {
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
    stablecoinEdited,
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
    setInspection,
    probe,
    setProbe,
    deploying,
    setDeploying,
    result,
    setResult,
    load,
    invalidateProbe,
    deploy,
    response,
    canDeploy,
  };
}
