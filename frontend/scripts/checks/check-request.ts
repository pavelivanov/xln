import { SURFACE_IDS, type SurfaceId } from '../../config/surfaces';
import { parseSurfaceSelection } from '../shared/surface-selection';
import { CANDIDATE_BROWSER_TEST_FILES } from '../test-react-candidate';

export type CheckRequest = Readonly<{
  surfaceIds: readonly SurfaceId[];
  explain: boolean;
  level: 'local' | 'slice' | 'frontend';
  spec: string | null;
  changedFrom: string | null;
}>;

export const parseCheckRequest = (args: readonly string[]): CheckRequest => {
  const selection: string[] = [];
  let level: CheckRequest['level'] = 'local';
  let explain = false, spec: string | null = null, changedFrom: string | null = null;
  const flags = new Set<string>();
  for (const arg of args) {
    const flag = arg.split('=')[0] ?? arg;
    if (flags.has(flag)) throw new Error(`FRONTEND_CHECK_ARGUMENT_DUPLICATE:${flag}`);
    flags.add(flag);
    if (arg === '--explain') explain = true;
    else if (arg.startsWith('--spec=')) spec = arg.slice(7);
    else if (arg.startsWith('--changed-from=')) changedFrom = arg.slice(15);
    else if (arg.startsWith('--level=')) {
      const value = arg.slice(8);
      if (value !== 'local' && value !== 'slice' && value !== 'frontend') throw new Error(`FRONTEND_CHECK_LEVEL_UNSUPPORTED:${arg}`);
      level = value;
    } else selection.push(arg);
  }
  if (changedFrom !== null && (!changedFrom || changedFrom.startsWith('-') || selection.length)) throw new Error('FRONTEND_CHECK_CHANGE_SELECTION_INVALID');
  const surfaceIds = changedFrom === null ? parseSurfaceSelection(selection) : [];
  if (level === 'slice') {
    const surface = surfaceIds[0];
    if (surfaceIds.length !== 1 || !surface || !spec || !(CANDIDATE_BROWSER_TEST_FILES[surface] as readonly string[]).includes(spec)) {
      throw new Error('FRONTEND_CHECK_SLICE_SPEC_REQUIRED');
    }
  } else if (spec !== null) throw new Error('FRONTEND_CHECK_SPEC_REQUIRES_SLICE');
  return { surfaceIds, level, explain, spec, changedFrom };
};

// Shared and unclassified paths conservatively select all apps. A directory
// owner narrows only app-local edits, never a shared dependency change.
export const selectChangedSurfaces = (paths: readonly string[]): readonly SurfaceId[] => {
  const selected = new Set<SurfaceId>();
  for (const path of paths) {
    if (path.startsWith('plans/') || path.startsWith('docs/')) continue;
    const app = SURFACE_IDS.find(id => path.startsWith(`frontend/apps/${id}/`));
    if (!app) return SURFACE_IDS;
    selected.add(app);
  }
  return SURFACE_IDS.filter(id => selected.has(id));
};
