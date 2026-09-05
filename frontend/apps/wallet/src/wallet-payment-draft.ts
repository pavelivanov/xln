import type { RuntimePaymentDeliveryMode } from '../../../packages/runtime-client/src/payment-command-types';
import { parseXlnInvoice } from '../../../packages/runtime-client/src/xln-invoice';
import type { WalletPaymentProjection, WalletPaymentQuoteRequest } from './wallet-payment-model';

export type WalletPaymentDraft = Readonly<{
  targetEntityId: string;
  tokenId: number;
  amount: string;
  deliveryMode: RuntimePaymentDeliveryMode;
}>;

export const requireWalletPaymentQuoteMatchesDraft = (
  request: WalletPaymentQuoteRequest,
  draft: WalletPaymentDraft,
  activeEntityId: string,
  parseAmount: (tokenId: number, amount: string) => bigint,
): void => {
  if (request.sourceEntityId !== activeEntityId
    || request.targetEntityId !== draft.targetEntityId.trim().toLowerCase()
    || request.tokenId !== draft.tokenId
    || request.deliveryMode !== draft.deliveryMode
    || request.recipientAmount !== parseAmount(draft.tokenId, draft.amount.trim())) {
    throw new Error('Payment details changed. Find a new route before submitting.');
  }
};

export const readWalletPaymentInvoice = (value: string, projection: WalletPaymentProjection) => {
  const parsed = parseXlnInvoice(value);
  const recipient = projection.recipients.find(({ entityId }) => entityId === parsed.targetEntityId);
  if (!recipient) throw new Error('Invoice recipient is not present in this committed Runtime view.');
  if (recipient.blocked) throw new Error('Invoice recipient Account is blocked by a dispute.');
  if (parsed.tokenId !== null && !projection.tokens.some(({ tokenId }) => tokenId === parsed.tokenId)) {
    throw new Error('Invoice asset is not present in this committed Runtime view.');
  }
  const description = [parsed.description, parsed.recipientUserId ? `uid:${parsed.recipientUserId}` : '']
    .filter(Boolean).join(' | ');
  return { ...parsed, description, descriptionLocked: Boolean(parsed.noteLocked || description) };
};

export const initialWalletPaymentInvoice = (value: string, projection: WalletPaymentProjection) => {
  try {
    return { intent: value ? readWalletPaymentInvoice(value, projection) : null, error: '' };
  } catch (error: unknown) {
    return { intent: null, error: error instanceof Error ? error.message : String(error) };
  }
};
