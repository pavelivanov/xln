import type { EntityWorkspaceActivityEvent } from '../../runtime-client/src/entity-workspace-activity';

export type EntityWorkspaceActivityTone =
  | 'chain'
  | 'cross'
  | 'danger'
  | 'in'
  | 'neutral'
  | 'out'
  | 'swap';

type ActivityToneEvidence = Pick<
  EntityWorkspaceActivityEvent,
  'direction' | 'kind' | 'status' | 'type'
>;

export const entityWorkspaceActivityTone = (
  event: ActivityToneEvidence,
): EntityWorkspaceActivityTone => {
  if (event.status === 'error' || event.type === 'error') return 'danger';
  if (event.kind === 'onchain') return 'chain';
  if (event.type === 'payment') return event.direction === 'in' ? 'in' : 'out';
  if (event.type === 'cross_swap') return 'cross';
  if (event.type === 'swap') return 'swap';
  return 'neutral';
};
