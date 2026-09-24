import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('React docs app reports catalog and document failures through visible retry state', () => {
  const app = readFileSync('frontend/apps/docs/src/docs-app.tsx', 'utf8');
  const reader = readFileSync('frontend/apps/docs/src/docs-reader.tsx', 'utf8');

  expect(app).toContain('const errorMessage = (error: unknown): string');
  expect(app).toContain('`Failed to load docs catalog: ${errorMessage(error)}`');
  expect(app).toContain('`Failed to load document: ${errorMessage(error)}`');
  expect(reader).toContain("data-testid={error ? 'docs-error' : 'docs-loading'}");
  expect(reader).toContain("role={error ? 'alert' : 'status'}");
  expect(reader).toContain('Retry request');
  expect(`${app}\n${reader}`).not.toContain('console.error');
  expect(`${app}\n${reader}`).not.toContain('console.warn');
});

test('React docs app defaults to live docs with explicit archive opt-in and local scrolling', () => {
  const app = readFileSync('frontend/apps/docs/src/docs-app.tsx', 'utf8');
  const navigation = readFileSync('frontend/apps/docs/src/docs-navigation.tsx', 'utf8');
  const model = readFileSync('frontend/packages/ui/src/content/docs-page-model.ts', 'utf8');
  const styles = readFileSync('frontend/apps/docs/src/styles/docs.css', 'utf8');

  expect(app).toContain('const [showArchive, setShowArchive] = useState(false);');
  expect(app).toContain('filterDocsSections(manifest, showArchive, deferredSearchQuery)');
  expect(model).toContain("manifest.sections.filter((section) => showArchive || section.kind === 'live')");
  expect(navigation).toContain('data-testid="archive-toggle"');
  expect(navigation).toContain('onClick={() => onArchiveChange(true)}');
  expect(styles).toContain('overscroll-behavior: contain;');
  expect(styles).toContain('overscroll-behavior-inline: contain;');
});
