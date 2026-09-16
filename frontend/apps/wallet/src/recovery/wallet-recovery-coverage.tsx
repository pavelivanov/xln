import type { WalletRecoveryServicesReadyView } from '../../../../packages/browser/src/recovery/wallet-recovery-services';

export function WalletRecoveryCoverage({ view }: Readonly<{ view: WalletRecoveryServicesReadyView }>) {
  return (
    <section className="wallet-recovery-coverage" aria-label="Recovery coverage">
      <h3>Recovery coverage</h3>
      <p>Configured services and observed backup evidence are shown separately.</p>
      <dl data-testid="recovery-coverage-grid">
        {view.coverage.map(item => (
          <div key={item.id} data-testid={`recovery-coverage-${item.id}`}>
            <dt>{item.label}</dt>
            <dd>
              <strong>{item.statusLabel}</strong>
              <span>{item.detail}</span>
            </dd>
          </div>
        ))}
      </dl>
      {view.towerStatuses.length > 0 ? (
        <ul aria-label="Recovery service status">
          {view.towerStatuses.map(tower => (
            <li key={tower.url} data-status={tower.status}>
              <code>{tower.url}</code>
              <strong>{tower.label}</strong>
              <span>{tower.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
