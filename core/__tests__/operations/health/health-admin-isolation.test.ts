import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('health admin route reads only health/debug surfaces and links to QA', () => {
  const route = readSource('frontend/apps/ops/src/health/ops-health.tsx');
  const healthSource = readSource('frontend/apps/ops/src/health/ops-health-source.ts');
  const eventsSource = readSource('frontend/apps/ops/src/health/ops-health-events-source.ts');
  const topology = readSource('frontend/apps/ops/src/health/topology/ops-health-topology.tsx');

  for (const forbidden of [
    "from '../qa/",
    'QaRunsPanel',
    'QaCockpitEmbedPanel',
    'QaProtectedImage',
    '/api/qa/',
    'api/qa/',
  ]) {
    expect(route).not.toContain(forbidden);
  }

  expect(healthSource).toContain("fetch('/api/health'");
  expect(eventsSource).toContain('client.readActivity({ limit: 1000, scanLimit: 1000 })');
  expect(eventsSource).toContain('client.readEntities({ limit: 1000 })');
  expect(route).toContain('<OpsHealthTopology topology={snapshot.health.topology} />');
  expect(topology).toContain('href="/qa"');
  expect(topology).not.toContain('fetch(');
  expect(topology).not.toContain('<iframe');
});
