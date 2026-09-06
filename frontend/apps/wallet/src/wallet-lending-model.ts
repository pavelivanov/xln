import { requireRuntimeEnum, requireRuntimeInteger, requireRuntimeRecord, requireRuntimeString, normalizeRequiredRuntimeEntityId } from './wallet-runtime-decode';

const amount = (value: unknown) => {
  const text = requireRuntimeString(value, 'LENDING_AMOUNT');
  if (!/^\d+$/.test(text)) throw new Error('LENDING_AMOUNT_INVALID');
  return BigInt(text);
};
const list = (value: unknown) => { if (!Array.isArray(value)) throw new Error('LENDING_LIST_INVALID'); return value; };
const id = (value: unknown) => normalizeRequiredRuntimeEntityId(value, 'LENDING_ENTITY');
const integer = (value: unknown) => requireRuntimeInteger(value, 'LENDING_INTEGER');

// User-command identity is generated at the UI boundary, before Runtime admission.
export function createWalletLendingIntentId(kind: 'lend' | 'borrow') {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${kind}-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function decodeWalletLending(value: unknown, hub: string, tokenId: number, user: string) {
  const root = requireRuntimeRecord(value, 'LENDING_STATE');
  if (root['success'] !== true) throw new Error(typeof root['error'] === 'string' ? root['error'] : 'LENDING_STATE_FAILED');
  if (id(root['hubEntityId']) !== hub) throw new Error('LENDING_HUB_MISMATCH');
  const common = (value: unknown) => {
    const row = requireRuntimeRecord(value, 'LENDING_ROW');
    if (id(row['hubEntityId']) !== hub || integer(row['tokenId']) !== tokenId) throw new Error('LENDING_ROW_CONTEXT_MISMATCH');
    return { row, hubEntityId: hub, tokenId, lenderEntityId: id(row['lenderEntityId']),
      principal: amount(row['principalAmount']), interestBps: integer(row['interestBps']),
      termId: requireRuntimeEnum(row['termId'], ['1h', '1d', '1m'], 'LENDING_TERM') };
  };
  const pools = list(root['pools']).map(raw => {
    const { row, ...base } = common(raw);
    if (base.lenderEntityId !== user) throw new Error('LENDING_USER_MISMATCH');
    return { ...base, status: requireRuntimeEnum(row['status'], ['open', 'closing', 'closed'], 'LENDING_POOL_STATUS'), positionId: requireRuntimeString(row['positionId'], 'LENDING_POSITION'), available: amount(row['availableAmount']), borrowed: amount(row['borrowedAmount']) };
  });
  const loans = list(root['loans']).map(raw => {
    const { row, ...base } = common(raw);
    const borrowerEntityId = id(row['borrowerEntityId']);
    if (borrowerEntityId !== user && base.lenderEntityId !== user) throw new Error('LENDING_USER_MISMATCH');
    return { ...base, status: requireRuntimeEnum(row['status'], ['opening', 'active', 'closing', 'repaid'], 'LENDING_LOAN_STATUS'), borrowerEntityId, loanId: requireRuntimeString(row['loanId'], 'LENDING_LOAN'),
      repayment: amount(row['repaymentAmount']), repaid: amount(row['repaidAmount']), dueAt: integer(row['dueAt']) };
  });
  const totals = requireRuntimeRecord(root['totals'], 'LENDING_TOTALS');
  return { hubEntityId: hub, userEntityId: user, tokenId, pools, loans, available: amount(totals['availableAmount']), borrowed: amount(totals['borrowedAmount']) };
}

export type WalletLendingState = ReturnType<typeof decodeWalletLending>;
export type WalletLendingLoan = WalletLendingState['loans'][number];

export function buildWalletLoanRepayment(loan: WalletLendingLoan, entityId: string, hub: string) {
  if (loan.hubEntityId !== hub || loan.borrowerEntityId !== entityId) throw new Error('LENDING_REPAY_BORROWER_MISMATCH');
  if (loan.status !== 'active') throw new Error('LENDING_LOAN_NOT_ACTIVE');
  const remaining = loan.repayment - loan.repaid;
  if (remaining <= 0n) throw new Error('LENDING_REPAY_AMOUNT_INVALID');
  return { type: 'lendingRepay', data: { hubEntityId: hub, loanId: loan.loanId, tokenId: loan.tokenId, amount: remaining } } as const;
}
