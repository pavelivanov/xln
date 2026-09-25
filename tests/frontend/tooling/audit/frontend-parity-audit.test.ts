import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

import { CAPABILITIES } from '../../../../frontend/config/capabilities';
import {
  CAPABILITY_PARITY,
  CUTOVER_CHECKLIST,
  PARITY_GAP_IDS,
  PARITY_GAPS,
  ROUTE_PARITY,
} from '../../../../frontend/config/parity-audit';
import { resolveRouteOwner, SURFACES } from '../../../../packages/frontend-release/surfaces';
import { buildParityAuditReport } from '../../../../frontend/scripts/checks/parity-audit';

describe('frontend route and capability acceptance inventory', () => {
  test('accounts for every canonical app route and keeps representative cases distinct', () => {
    const actual = SURFACES.flatMap(surface => surface.routes.map(route => `${surface.id}:${route.pathname}`)).toSorted();
    const audited = [...new Set(ROUTE_PARITY.map(route => `${route.intendedOwner}:${route.pathname.split('/:')[0]}`))].toSorted();
    expect(audited).toEqual(actual);
    expect(new Set(ROUTE_PARITY.map(route => route.id)).size).toBe(ROUTE_PARITY.length);
    expect(new Set(ROUTE_PARITY.map(route => route.representativePath)).size).toBe(ROUTE_PARITY.length);
  });

  test('binds implemented routes to their intended owner, sources, and evidence', () => {
    for (const route of ROUTE_PARITY) {
      if (route.implementation === 'missing') {
        expect(route.reactSource).toBeNull();
        expect(route.focusedTests).toEqual([]);
      } else {
        expect(route.reactSource && existsSync(route.reactSource)).toBe(true);
        for (const path of route.focusedTests) expect(existsSync(path)).toBe(true);
      }
      for (const path of route.browserTests) expect(existsSync(path)).toBe(true);
      expect(resolveRouteOwner(route.representativePath)).toBe(route.intendedOwner);
    }
  });

  test('keeps browser claims and gap references exact', () => {
    const gapIds = new Set(PARITY_GAPS.map(({ id }) => id));
    expect(PARITY_GAPS.map(({ id }) => id)).toEqual(PARITY_GAP_IDS);
    for (const route of ROUTE_PARITY) {
      expect(route.browserEvidence === 'missing' ? route.browserTests.length === 0 : route.browserTests.length > 0).toBe(true);
      for (const gapId of route.gapIds) expect(gapIds.has(gapId)).toBe(true);
    }
    for (const gap of PARITY_GAPS) {
      expect(gap.nextSlice.length).toBeGreaterThan(30);
      for (const routeId of gap.routeIds) {
        expect(ROUTE_PARITY.some(({ id }) => id === routeId)).toBe(true);
      }
      for (const path of gap.evidenceSources) expect(existsSync(path)).toBe(true);
    }
  });

  test('accounts for every capability and preserves the owner gates', () => {
    expect(CAPABILITY_PARITY.map(({ capabilityId }) => capabilityId).toSorted())
      .toEqual(CAPABILITIES.map(({ id }) => id).toSorted());
    for (const capability of CAPABILITY_PARITY) {
      for (const gapId of capability.gapIds) {
        expect(PARITY_GAP_IDS).toContain(gapId);
        expect(PARITY_GAPS.find(({ id }) => id === gapId)?.capabilityIds).toContain(capability.capabilityId);
      }
    }
    expect(CUTOVER_CHECKLIST.filter(({ status }) => status === 'verified').map(({ id }) => id))
      .toEqual([
        'retained-route-parity',
        'per-surface-browser-evidence',
        'immutable-candidate-release',
        'whole-release-rollback',
        'canonical-commands-and-routing',
        'canonical-artifact-consumers',
        'retired-source-dependencies-and-config',
      ]);
    expect(CUTOVER_CHECKLIST.filter(({ status }) => status !== 'verified'))
      .toEqual([{ id: 'production-activation', status: 'release-operation-wp11', evidence: 'scripts/deployment/deploy-platform.sh' }]);
    for (const item of CUTOVER_CHECKLIST) expect(existsSync(item.evidence)).toBe(true);
  });

  test('publishes deterministic counts for the current candidate', () => {
    expect(buildParityAuditReport()).toMatchObject({
      schemaVersion: 1,
      routes: {
        total: 20,
        implementation: { complete: 19, partial: 1 },
        browserEvidence: { covered: 19, partial: 1 },
      },
      capabilities: { total: 12, accounted: 12 },
    });
    expect(buildParityAuditReport().routes.implementation.missing).toBeUndefined();
    expect(buildParityAuditReport().routes.browserEvidence.missing).toBeUndefined();
  });
});
