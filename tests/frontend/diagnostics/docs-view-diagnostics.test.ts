import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('docs view reports load failures through visible state without raw console output', () => {
  const source = readFileSync('frontend/src/lib/components/Views/DocsView.svelte', 'utf8');

  expect(source).toContain('function errorMessage(error: unknown): string');
  expect(source).toContain('loadError = `Failed to load docs catalog: ${errorMessage(error)}`;');
  expect(source).toContain('loadError = `Failed to load document: ${errorMessage(error)}`;');
  expect(source).toContain('data-testid="docs-error"');
  expect(source).not.toContain('console.error');
  expect(source).not.toContain('console.warn');
});

test('docs view defaults to live docs with explicit archive opt-in and keeps responsive scroll local', () => {
  const source = readFileSync('frontend/src/lib/components/Views/DocsView.svelte', 'utf8');
  const model = readFileSync('frontend/packages/ui/src/content/docs-page-model.ts', 'utf8');
  const reactStyles = readFileSync('frontend/apps/docs/src/styles/docs.css', 'utf8');

  expect(source).toContain('let showArchive = $state(false);');
  expect(source).toContain('filterDocsSections(manifest, showArchive, searchQuery)');
  expect(source).toContain('findManifestDocById(manifest, docId)');
  expect(model).toContain("manifest.sections.filter((section) => showArchive || section.kind === 'live')");
  expect(source).toContain('data-testid="archive-toggle"');
  expect(source).toContain('onclick={() => (showArchive = true)}');
  expect(source).toContain('height: calc(100dvh - 56px);');
  expect(source).toContain('overscroll-behavior: contain;');
  expect(source).toContain('overscroll-behavior-inline: contain;');
  expect(reactStyles).toContain('overscroll-behavior: contain;');
  expect(reactStyles).toContain('overscroll-behavior-inline: contain;');
});
