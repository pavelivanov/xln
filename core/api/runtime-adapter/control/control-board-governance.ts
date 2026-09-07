import { requireBoundaryRecord, requireExactBoundaryKeys } from '../../../protocol/boundary-validation';

export type ControlBoardGovernanceRequest =
  | Readonly<{ type: 'control-board-governance'; operation: 'targets'; shareholderEntityId: string; signerId: string }>
  | Readonly<{ type: 'control-board-governance'; operation: 'status'; shareholderEntityId: string; signerId: string; targetEntityId: string }>
  | Readonly<{ type: 'control-board-governance'; operation: 'review'; shareholderEntityId: string; signerId: string; targetEntityId: string }>
  | Readonly<{ type: 'control-board-governance'; operation: 'prepare'; shareholderEntityId: string; signerId: string; targetEntityId: string; expectedBoardHash: string; expectedActionNonce: string }>;

const requireString = (value: unknown, code: string): void => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
};

export const decodeControlBoardGovernanceRequest = (value: unknown): ControlBoardGovernanceRequest => {
  const request = requireBoundaryRecord(value, 'CONTROL_BOARD_GOVERNANCE_REQUEST_INVALID');
  if (request['type'] !== 'control-board-governance') throw new Error('CONTROL_BOARD_GOVERNANCE_TYPE_INVALID');
  const operation = request['operation'];
  if (operation === 'targets') {
    requireExactBoundaryKeys(request, ['type', 'operation', 'shareholderEntityId', 'signerId'], [], 'CONTROL_BOARD_GOVERNANCE_FIELDS_INVALID');
  } else if (operation === 'status' || operation === 'review') {
    requireExactBoundaryKeys(request, ['type', 'operation', 'shareholderEntityId', 'signerId', 'targetEntityId'], [], 'CONTROL_BOARD_GOVERNANCE_FIELDS_INVALID');
  } else if (operation === 'prepare') {
    requireExactBoundaryKeys(request, ['type', 'operation', 'shareholderEntityId', 'signerId', 'targetEntityId', 'expectedBoardHash', 'expectedActionNonce'], [], 'CONTROL_BOARD_GOVERNANCE_FIELDS_INVALID');
    requireString(request['expectedBoardHash'], 'CONTROL_BOARD_GOVERNANCE_BOARD_HASH_REQUIRED');
    requireString(request['expectedActionNonce'], 'CONTROL_BOARD_GOVERNANCE_ACTION_NONCE_REQUIRED');
  } else {
    throw new Error('CONTROL_BOARD_GOVERNANCE_OPERATION_INVALID');
  }
  requireString(request['shareholderEntityId'], 'CONTROL_BOARD_GOVERNANCE_SHAREHOLDER_REQUIRED');
  requireString(request['signerId'], 'CONTROL_BOARD_GOVERNANCE_SIGNER_REQUIRED');
  if (operation !== 'targets') requireString(request['targetEntityId'], 'CONTROL_BOARD_GOVERNANCE_TARGET_REQUIRED');
  return request as ControlBoardGovernanceRequest;
};
