import type { EntityReplica, JReplica, RuntimeReplica } from '@xln/core/api/public/runtime-module';
import type { JurisdictionConfig } from '@xln/core/protocol/config/jurisdiction-config';

export const OPS_DEMO_ENTITY_COUNT = 9;

export const architectEntityIds = (env: RuntimeReplica, machine: JReplica): string[] =>
  [...env.state.eReplicas.values()]
    .filter(replica => replica.state.config.jurisdiction?.chainId === machine.chainId
      && replica.state.config.jurisdiction?.entityProviderAddress.toLowerCase() === machine.contracts?.entityProvider?.toLowerCase())
    .map(replica => replica.entityId.toLowerCase())
    .filter((id, index, values) => values.indexOf(id) === index)
    .sort();

export const architectReplica = (env: RuntimeReplica, entityId: string): EntityReplica | null =>
  [...env.state.eReplicas.values()].find(replica => replica.entityId.toLowerCase() === entityId.toLowerCase()) ?? null;

export const architectJurisdictionConfig = (machine: JReplica): JurisdictionConfig => {
  if (!machine.contracts?.entityProvider || !machine.contracts.depository) {
    throw new Error(`ARCHITECT_JURISDICTION_CONTRACTS_MISSING:${machine.name}`);
  }
  return {
    address: machine.contracts.entityProvider,
    name: machine.name,
    entityProviderAddress: machine.contracts.entityProvider,
    depositoryAddress: machine.contracts.depository,
    ...(machine.chainId === undefined ? {} : { chainId: machine.chainId }),
    ...(machine.blockTimeMs === undefined ? {} : { blockTimeMs: machine.blockTimeMs }),
    ...(machine.entityProviderDeploymentBlock === undefined ? {} : {
      entityProviderDeploymentBlock: machine.entityProviderDeploymentBlock,
    }),
  };
};

export const architectDemoPosition = (machine: JReplica, index: number) => ({
  x: machine.position.x + (index % 3 - 1) * 40,
  y: machine.position.y + 20,
  z: machine.position.z + (Math.floor(index / 3) - 1) * 40,
});

export const requireArchitectAmount = (value: string): bigint => {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error(`ARCHITECT_AMOUNT_INVALID:${value}`);
  return BigInt(value);
};
