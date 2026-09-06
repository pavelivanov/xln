import type { CommandPaletteCommand } from '../../../../packages/ui/src/workspace/command-palette-suggestions';

export type WalletCommandDraft = Extract<CommandPaletteCommand, { type: 'pay' | 'swap' | 'open' }> & Readonly<{ id: number }>;
export type WalletPayDraft = Extract<WalletCommandDraft, { type: 'pay' }>;
export type WalletSwapDraft = Extract<WalletCommandDraft, { type: 'swap' }>;
export type WalletOpenDraft = Extract<WalletCommandDraft, { type: 'open' }>;

export const requireDraftToken = <T extends Readonly<{ tokenId: number; symbol: string }>>(tokens: readonly T[], symbol: string): T => {
  const matches = tokens.filter(token => token.symbol.toLowerCase() === symbol.toLowerCase());
  const token = matches[0];
  if (matches.length !== 1 || !token) throw new Error(`Wallet token ${symbol} is ${matches.length ? 'ambiguous' : 'unavailable'} in the selected Entity.`);
  return token;
};

export type WalletPaymentPrefill = Readonly<{ id: number; recipientId: string; tokenId: number; amount: string }>;
export const walletDraftPayment = (draft: WalletPayDraft, tokens: readonly Readonly<{ tokenId: number; symbol: string }>[]): WalletPaymentPrefill =>
  ({ id: draft.id, recipientId: draft.args.recipientId, amount: draft.args.amount, tokenId: requireDraftToken(tokens, draft.args.token).tokenId });
