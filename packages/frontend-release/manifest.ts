import type { RouteRule, SurfaceId } from './surfaces';

export const RELEASE_SCHEMA_VERSION = 2 as const;

type CandidateApplication = Readonly<{
  id: SurfaceId;
  entryHtml: `apps/${SurfaceId}/index.html`;
  viteManifest: `apps/${SurfaceId}/manifest.json`;
  assetDirectory: `assets/${SurfaceId}`;
  routes: readonly RouteRule[];
  assetRoutes: readonly RouteRule[];
}>;

type CandidateGeneratedInput = Readonly<{
  id: string;
  owner: SurfaceId;
  outputNamespace: string;
  definitionSha256: string;
  files: readonly string[];
}>;

export type CandidateReleaseManifest = Readonly<{
  schemaVersion: typeof RELEASE_SCHEMA_VERSION;
  releaseId: `sha256-${string}`;
  applications: readonly CandidateApplication[];
  generatedInputs: readonly CandidateGeneratedInput[];
  edgeRoutes: readonly RouteRule[];
  files: readonly Readonly<{
    path: string;
    sha256: string;
    size: number;
  }>[];
}>;
