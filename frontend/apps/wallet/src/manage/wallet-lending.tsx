export const WALLET_LENDING_UNSUPPORTED_REASON =
  'Lending transactions are outside the current production admission profile. No lending command can be submitted from Wallet.';

export function WalletLending() {
  return (
    <section aria-labelledby="wallet-lending-title" data-testid="wallet-lending">
      <div className="wallet-lending-policy" data-testid="wallet-lending-unsupported">
        <p className="wallet-lending-status">Unavailable</p>
        <h2 id="wallet-lending-title">Production lending is not enabled</h2>
        <p role="status">{WALLET_LENDING_UNSUPPORTED_REASON}</p>
        <dl>
          <div><dt>Admission</dt><dd>Fund, borrow, repay, credit, close, and payout mutations are rejected.</dd></div>
          <div><dt>Wallet behavior</dt><dd>No lending form or submission control is exposed.</dd></div>
          <div><dt>Available now</dt><dd>Use Payments, Move, or Settlement for admitted Account operations.</dd></div>
        </dl>
      </div>
    </section>
  );
}
