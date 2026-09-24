import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const diagnosticSurfaces = [
  'frontend/packages/ui/src/entity/entity-workspace-shell.tsx',
  'frontend/packages/ui/src/entity/profile/entity-workspace-profile-editor.tsx',
  'frontend/apps/wallet/src/manage/wallet-manage.tsx',
  'frontend/apps/wallet/src/onboarding/wallet-formation.tsx',
  'frontend/apps/wallet/src/onboarding/wallet-hub-discovery.tsx',
  'frontend/apps/wallet/src/payments/wallet-payments.tsx',
  'frontend/apps/wallet/src/payments/wallet-payment-operations.tsx',
  'frontend/apps/wallet/src/payments/wallet-settlement-approvals.tsx',
  'frontend/apps/wallet/src/markets/wallet-market-pane.tsx',
] as const;

test('React Entity action surfaces render diagnostic state instead of raw console output', () => {
  for (const path of diagnosticSurfaces) {
    const source = readFileSync(path, 'utf8');
    expect(source).toMatch(/role=(?:"alert"|\{[^}\n]*'alert')/);
    expect(source).not.toContain('console.error');
    expect(source).not.toContain('console.warn');
    expect(source).not.toContain('console.info');
    expect(source).not.toContain('alert(');
  }
});

test('payment and settlement sources retain every command failure in observable state', () => {
  const paymentSource = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-source.ts', 'utf8');
  const payments = readFileSync('frontend/apps/wallet/src/payments/wallet-payments.tsx', 'utf8');
  const operations = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-operations.tsx', 'utf8');
  const approvals = readFileSync('frontend/apps/wallet/src/payments/wallet-settlement-approvals.tsx', 'utf8');

  expect(paymentSource).toContain("status: 'error', message: walletRuntimeReadErrorMessage(error)");
  expect(paymentSource).toContain("quote: { status: 'error', message: walletRuntimeReadErrorMessage(error), routes: [] }");
  expect(paymentSource).toContain('this.settlementExecutionKeys.delete(executionKey);');
  expect(payments).toContain('role="alert"');
  expect(operations).toContain('setError(failure instanceof Error ? failure.message : String(failure))');
  expect(approvals).toContain('setError(failure instanceof Error ? failure.message : String(failure))');
});

test('market order placement and both cancel paths surface failures', () => {
  const market = readFileSync('frontend/apps/wallet/src/markets/wallet-market-pane.tsx', 'utf8');

  expect(market).toContain('await source.submitOrder({');
  expect(market).toContain('await source.cancelOrder(offerId);');
  expect(market).toContain('await source.cancelCrossOrder(orderId);');
  expect(market.match(/setError\(cause instanceof Error \? cause\.message : String\(cause\)\)/g)).toHaveLength(4);
  expect(market).toContain('{error ? <p className="wallet-market-error" role="alert">{error}</p> : null}');
});
