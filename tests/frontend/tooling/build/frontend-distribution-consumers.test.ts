import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

type Step = { run?: string; uses?: string; with?: Record<string, string>; id?: string };
type Job = { needs?: string; outputs?: Record<string, string>; env?: Record<string, string>; steps: Step[] };
const workflow = Bun.YAML.parse(readFileSync('.github/workflows/distribution-release.yml', 'utf8')) as {
  jobs: Record<string, Job>;
};

test('distribution builds one frontend and exports its assembler-selected identity', () => {
  const producer = workflow.jobs['frontend-release']!;
  expect(producer.needs).toBe('validate');
  expect(
    Object.values(workflow.jobs)
      .flatMap(job => job.steps)
      .filter(step => step.run === 'bun run build:react'),
  ).toHaveLength(1);
  expect(producer.outputs?.['release-id']).toBe('${{ steps.assemble.outputs.release-id }}');
  expect(producer.steps.find(step => step.id === 'assemble')?.run).toBe('bun run assemble:react');
  expect(producer.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))?.with?.['name']).toBe(
    'verified-frontend-release',
  );
});

for (const name of ['mac-launcher-desktop-chrome', 'android']) {
  test(`${name} verifies the producer's bytes before consuming them without a frontend rebuild`, () => {
    const consumer = workflow.jobs[name]!;
    expect(consumer.needs).toBe('frontend-release');
    expect(consumer.env?.['FRONTEND_RELEASE_DIRECTORY']).toBe(
      'frontend/.artifacts/releases/${{ needs.frontend-release.outputs.release-id }}',
    );
    expect(consumer.steps.find(step => step.uses?.startsWith('actions/download-artifact@'))?.with?.['name']).toBe(
      'verified-frontend-release',
    );
    const verification = consumer.steps.findIndex(step => step.run?.includes('candidate-release-verifier.ts'));
    const build = consumer.steps.findIndex(step => step.run?.includes('build-platforms.ts'));
    expect(verification).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(verification);
    expect(consumer.steps[build]?.run).toContain('--frontend-release "$FRONTEND_RELEASE_DIRECTORY"');
    for (const step of consumer.steps) {
      expect(step.run ?? '').not.toContain('--no-build');
      expect(step.run ?? '').not.toMatch(/bun run build(?:\s|:|$)/);
    }
  });
}

test('npm release validation exercises the installed launcher before signing', () => {
  const steps = workflow.jobs['mac-launcher-desktop-chrome']!.steps;
  const packed = steps.findIndex(step => step.run?.includes('release:launcher:verify'));
  const preflight = steps.findIndex(step => step.run?.includes('check-xlnfinance-frontend.ts'));
  const signing = steps.findIndex(step => step.run?.includes('security create-keychain'));
  expect(packed).toBeGreaterThan(-1);
  expect(preflight).toBeGreaterThan(packed);
  expect(signing).toBeGreaterThan(preflight);
  expect(steps[preflight]?.run).toContain('--archive "packages/npm/xlnfinance/xlnfinance-${package_version}.tgz"');
});
