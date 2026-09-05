import type {
  ConsensusConfig, NumberedRegistrationCommand, NumberedRegistrationCommandResult,
  RuntimeInput, XLNModule,
} from '@xln/core/api/public/runtime-module';
import { hasProjectedEntityId, type FormationRuntimeProjection } from './formation-runtime-projection';

export type FormationDraft = Readonly<{
  entityType: 'numbered' | 'lazy';
  entityName: string;
  selectedJurisdiction: string;
  validators: readonly Readonly<{ name: string; weight: number }>[];
  threshold: number;
}>;

type FormationModule = Pick<XLNModule, 'generateLazyEntityId' | 'createLazyEntity' | 'canonicalEntitySeed' | 'importEntity'>;
export type FormationDependencies = Readonly<{
  getRuntimeModule: () => Promise<FormationModule>;
  readAuthority: () => Readonly<{ runtimeId: string; signerId: string; seed?: string }>;
  readProjection: () => FormationRuntimeProjection;
  registerNumberedEntities: (input: NumberedRegistrationCommand, runtimeId: string) => Promise<NumberedRegistrationCommandResult>;
  submitRuntimeInput: (input: RuntimeInput) => Promise<unknown> | unknown;
  onImported: (entityId: string, signerId: string, jurisdiction: string) => void;
}>;
export type FormationResult = Readonly<{ entityId: string; imported: boolean; message: string }>;

const requireSharedEntitySeed = (seed: string | undefined): string => {
  if (!seed) throw new Error('NUMBERED_ENTITY_SHARED_SEED_REQUIRED');
  return seed;
};

// This is the retained FormationPanel sequence. Both renderers call the same
// factories and registration/import paths; this layer does not define a board
// algorithm or choose a different source of signing authority.
export const createFormationEntity = async (draft: FormationDraft, deps: FormationDependencies): Promise<FormationResult> => {
  const { entityType, entityName, selectedJurisdiction, threshold } = draft;
  if (!selectedJurisdiction) throw new Error('Select a jurisdiction');
  if (draft.validators.some(validator => !validator.name.trim())) throw new Error('All validators must have names');
  const xln = await deps.getRuntimeModule();
  const authority = deps.readAuthority();
  const mySignerAddress = authority.signerId;
  const boardMembers = draft.validators.map(validator => ({ name: validator.name.trim(), weight: Number(validator.weight) }));
  const thresholdBigInt = BigInt(threshold);
  const totalWeight = boardMembers.reduce((sum, validator) => sum + validator.weight, 0);
  if (boardMembers.some(member => !Number.isInteger(member.weight) || member.weight <= 0 || member.weight > 0xffff)) {
    throw new Error('Every board weight must be an integer from 1 to 65535');
  }
  if (!Number.isInteger(threshold) || threshold <= 0 || threshold > totalWeight) {
    throw new Error(`Board threshold must be between 1 and ${totalWeight}`);
  }
  const runtimeProjection = deps.readProjection();
  const jurisdictionReplica = runtimeProjection.jurisdictions.find(j => j.name === selectedJurisdiction);
  if (!jurisdictionReplica) throw new Error('Selected jurisdiction not found');
  let entityId: string;
  let config: ConsensusConfig;
  let numberedImported = false;
  if (entityType === 'lazy') {
    entityId = xln.generateLazyEntityId(boardMembers, thresholdBigInt);
    if (hasProjectedEntityId(runtimeProjection, entityId)) {
      throw new Error(`This validator configuration already exists! Entity ${entityId} is in use.`);
    }
    config = xln.createLazyEntity(entityName, boardMembers, thresholdBigInt, jurisdictionReplica).config;
  } else {
    const registrationSignerId = mySignerAddress.trim().toLowerCase();
    if (!registrationSignerId) throw new Error('NUMBERED_ENTITY_ACTIVE_WALLET_SIGNER_REQUIRED');
    const localSignerId = boardMembers.some(member => member.name.toLowerCase() === registrationSignerId) ? registrationSignerId : null;
    const ownership = localSignerId === null ? { localSignerId: null, entitySeed: null } : {
      localSignerId, entitySeed: xln.canonicalEntitySeed(requireSharedEntitySeed(authority.seed)),
    };
    const registration = await deps.registerNumberedEntities({
      jurisdictionRef: selectedJurisdiction, payerSignerId: registrationSignerId,
      entities: [{ name: entityName, validators: boardMembers, threshold: thresholdBigInt, ...ownership, profileName: entityName }],
    }, authority.runtimeId.trim().toLowerCase());
    const creation = registration.entities[0];
    if (!creation) throw new Error('NUMBERED_ENTITY_REGISTRATION_RESULT_MISSING');
    config = creation.config; entityId = creation.entityId; numberedImported = creation.imported;
  }
  const localSignerId = mySignerAddress.toLowerCase();
  const localBoardIndex = config.validators.findIndex(member => member.toLowerCase() === localSignerId);
  const imported = (entityType === 'lazy' && localBoardIndex >= 0) || (entityType === 'numbered' && numberedImported);
  if (entityType === 'lazy' && localBoardIndex >= 0) {
    if (!authority.seed) throw new Error('ENTITY_IMPORT_RUNTIME_SEED_REQUIRED');
    await deps.submitRuntimeInput({
      runtimeTxs: [xln.importEntity({ entityId, signerId: localSignerId, entitySeed: authority.seed,
        data: { config, isProposer: localBoardIndex === 0, profileName: entityName } })], entityInputs: [],
    });
  }
  if (imported) deps.onImported(entityId, localSignerId, selectedJurisdiction);
  return { entityId, imported, message: imported ? `Entity created: ${entityId}` : `Board created: ${entityId}. Import this configuration in a member wallet.` };
};
