import type { RuntimeInput } from '@xln/core/api/public/runtime-module';

export type EntityWorkspaceProfileDraft = Readonly<{
  name: string;
  avatar: string;
  bio: string;
  website: string;
}>;

export type EntityWorkspaceProfileAuthority = Readonly<{
  entityId: string;
  signerId: string;
}>;

const requiredAuthority = (value: string, code: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new Error(code);
  return normalized;
};

export const normalizeEntityWorkspaceProfileDraft = (
  draft: EntityWorkspaceProfileDraft,
): EntityWorkspaceProfileDraft => {
  const normalized = {
    name: draft.name.trim(),
    avatar: draft.avatar.trim(),
    bio: draft.bio.trim(),
    website: draft.website.trim(),
  };
  if (!normalized.name) throw new Error('ENTITY_WORKSPACE_PROFILE_NAME_REQUIRED');
  return normalized;
};

export const buildEntityWorkspaceProfileUpdateInput = (
  authority: EntityWorkspaceProfileAuthority,
  draft: EntityWorkspaceProfileDraft,
): RuntimeInput => {
  const entityId = requiredAuthority(authority.entityId, 'ENTITY_WORKSPACE_PROFILE_ENTITY_REQUIRED');
  const signerId = requiredAuthority(authority.signerId, 'ENTITY_WORKSPACE_PROFILE_SIGNER_REQUIRED');
  const profile = normalizeEntityWorkspaceProfileDraft(draft);
  return {
    runtimeTxs: [],
    entityInputs: [{
      entityId,
      signerId,
      entityTxs: [{
        type: 'profile-update',
        data: { profile: { entityId, ...profile } },
      }],
    }],
  };
};
