import { useEffect, useState } from 'react';

import {
  walletCrossMarketDraftKey,
  type WalletCrossMarketDraft,
  type WalletCrossMarketReview,
} from './wallet-cross-market-command';
import type { WalletMarketProjection } from './wallet-market-model';
import type { WalletMarketSource, WalletMarketSourceSnapshot } from './wallet-market-source';

const isBusy = (snapshot: WalletMarketSourceSnapshot): boolean =>
  snapshot.status !== 'ready' || snapshot.command.status === 'submitting' || snapshot.command.status === 'pending';

const shortId = (value: string): string => (value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value);

export function WalletCrossMarketTicket({
  projection,
  snapshot,
  source,
}: Readonly<{
  projection: WalletMarketProjection;
  snapshot: WalletMarketSourceSnapshot;
  source: WalletMarketSource;
}>) {
  const defaultTarget = projection.crossTargets[0]?.routeValue ?? '';
  const [routeValue, setRouteValue] = useState(defaultTarget);
  const [giveTokenId, setGiveTokenId] = useState(projection.tokens[0]?.tokenId ?? 0);
  const [wantTokenId, setWantTokenId] = useState(projection.tokens[1]?.tokenId ?? 0);
  const [giveAmount, setGiveAmount] = useState('');
  const [wantAmount, setWantAmount] = useState('');
  const [review, setReview] = useState<WalletCrossMarketReview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projection.crossTargets.some(target => target.routeValue === routeValue)) return;
    setRouteValue(defaultTarget);
    setReview(null);
  }, [defaultTarget, projection.crossTargets, routeValue]);

  const draft = (): WalletCrossMarketDraft => ({
    routeValue,
    giveTokenId,
    wantTokenId,
    giveAmount,
    wantAmount,
  });
  const change = (update: () => void): void => {
    update();
    setReview(null);
    setError('');
  };
  const reviewOrder = async (): Promise<void> => {
    setError('');
    try {
      setReview(await source.reviewCrossOrder(draft()));
    } catch (cause: unknown) {
      setReview(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const submit = async (): Promise<void> => {
    setError('');
    try {
      if (!review || review.draftKey !== walletCrossMarketDraftKey(draft())) {
        throw new Error('WALLET_CROSS_REVIEW_REQUIRED');
      }
      await source.submitCrossOrder(review);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <section className="wallet-cross-ticket" aria-labelledby="wallet-cross-ticket-title">
      <header>
        <div>
          <p className="wallet-shell-eyebrow">Two committed stacks</p>
          <h2 id="wallet-cross-ticket-title">Cross-jurisdiction order</h2>
        </div>
        <span>{projection.crossTargets.length} routes</span>
      </header>
      {projection.crossTargets.length === 0 ? (
        <p>No distinct-jurisdiction user and Hub route is committed to this Runtime.</p>
      ) : (
        <>
          <div className="wallet-cross-fields">
            <label>
              <span>Target route</span>
              <select
                disabled={isBusy(snapshot)}
                onChange={event => change(() => setRouteValue(event.target.value))}
                value={routeValue}
              >
                {projection.crossTargets.map(target => (
                  <option key={target.routeValue} value={target.routeValue}>
                    {target.jurisdictionLabel} · {target.entityLabel} via {target.hubLabel}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Source asset</span>
              <div>
                <input
                  aria-label="Cross-j source amount"
                  inputMode="decimal"
                  onChange={event => change(() => setGiveAmount(event.target.value))}
                  placeholder="0.00"
                  value={giveAmount}
                />
                <select
                  aria-label="Cross-j source asset"
                  disabled={isBusy(snapshot)}
                  onChange={event => change(() => setGiveTokenId(Number(event.target.value)))}
                  value={giveTokenId}
                >
                  {projection.tokens.map(token => (
                    <option key={token.tokenId} value={token.tokenId}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label>
              <span>Target asset</span>
              <div>
                <input
                  aria-label="Cross-j target amount"
                  inputMode="decimal"
                  onChange={event => change(() => setWantAmount(event.target.value))}
                  placeholder="0.00"
                  value={wantAmount}
                />
                <select
                  aria-label="Cross-j target asset"
                  disabled={isBusy(snapshot)}
                  onChange={event => change(() => setWantTokenId(Number(event.target.value)))}
                  value={wantTokenId}
                >
                  {projection.tokens.map(token => (
                    <option key={token.tokenId} value={token.tokenId}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>
          <button
            className="wallet-cross-review-button"
            disabled={isBusy(snapshot) || !routeValue || !giveAmount || !wantAmount || giveTokenId === wantTokenId}
            onClick={() => void reviewOrder()}
            type="button"
          >
            Review cross-j route
          </button>
          {error ? (
            <p className="wallet-market-error" role="alert">
              {error}
            </p>
          ) : null}
          {review ? (
            <article
              className="wallet-cross-review"
              aria-label="Cross-jurisdiction quote review"
              data-order-id={review.orderId}
            >
              <div>
                <span>Source</span>
                <strong>
                  {review.sourceJurisdictionLabel} · {review.sourceEntityLabel}
                </strong>
                <small>
                  {review.giveAmountLabel} via {review.sourceHubLabel}
                </small>
              </div>
              <span aria-hidden="true">→</span>
              <div>
                <span>Target</span>
                <strong>
                  {review.targetJurisdictionLabel} · {review.targetEntityLabel}
                </strong>
                <small>
                  {review.wantAmountLabel} via {review.targetHubLabel}
                </small>
              </div>
              <footer>
                <code>{shortId(review.orderId)}</code>
                <button disabled={isBusy(snapshot)} onClick={() => void submit()} type="button">
                  Submit cross-j order
                </button>
              </footer>
            </article>
          ) : null}
        </>
      )}
    </section>
  );
}
