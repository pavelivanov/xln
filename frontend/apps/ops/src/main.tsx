import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { embedBootTitle, parseEmbedBootRequest } from '../../../packages/runtime-client/src/scenario/embed-boot-model';
import { OpsApp } from './ops-app';
import { startOpsHealthRuntime } from './health/ops-health-runtime';
import { opsPageMetadata, resolveOpsPage } from './ops-model';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('FRONTEND_REACT_ROOT_MISSING');

const page = resolveOpsPage(window.location.pathname);
const metadata = opsPageMetadata(page);
const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
if (!description) throw new Error('OPS_DESCRIPTION_META_MISSING');
document.title = page.pathname === '/embed' ? embedBootTitle(parseEmbedBootRequest(new URL(window.location.href))) : metadata.title;
description.content = metadata.description;

if (page.kind === 'health') startOpsHealthRuntime();
if (page.kind === 'qa') void import('./qa/ops-qa-runtime').then(module => module.startOpsQaRuntime());
if (page.kind === 'hlt') void import('./hlt/ops-hlt-runtime').then(module => module.startOpsHltRuntime());
if (page.kind === 'runs') void import('./runs/ops-runs-runtime').then(module => module.startOpsRunsRuntime());
if (page.kind === 'scenarios') void import('./scenarios/ops-scenarios-runtime').then(module => module.startOpsScenariosRuntime());
if (page.kind === 'ai') void import('./ai/ops-ai-runtime').then(module => module.startOpsAiRuntime());
if (page.kind === 'workspace') {
  void import('./entity-workspace/ops-entity-workspace-runtime').then(module => module.startOpsEntityWorkspaceRuntime());
}

createRoot(rootElement).render(
  <StrictMode>
    <OpsApp page={page} />
  </StrictMode>,
);
