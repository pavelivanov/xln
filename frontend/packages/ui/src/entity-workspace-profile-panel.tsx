import type { EntityWorkspaceContext } from '../../runtime-client/src/entity-workspace-context';
import type { EntityWorkspaceHubPolicy } from '../../runtime-client/src/entity-workspace-hub-policy';
import type { EntityWorkspaceProfile } from '../../runtime-client/src/entity-workspace-profile';
import type { EntityWorkspaceReserves } from '../../runtime-client/src/entity-workspace-reserves';
import {
  projectEntityWorkspaceSettingsSummary,
} from '../../runtime-client/src/entity-workspace-settings-summary';
import type { EntityWorkspaceTimeMachineState } from '../../runtime-client/src/entity-workspace-time-machine';
import { formatAddress } from './entity-workspace-display';
import './entity-workspace-profile-panel.css';

type EntityWorkspaceProfilePanelProps = Readonly<{
  context: EntityWorkspaceContext;
  hubPolicy: EntityWorkspaceHubPolicy;
  profile: EntityWorkspaceProfile;
  reserves: EntityWorkspaceReserves;
  timeMachine: EntityWorkspaceTimeMachineState;
}>;

const profileInitials = (name: string): string => name
  .split(/\s+/u)
  .slice(0, 2)
  .map((part) => part[0] ?? '')
  .join('')
  .toUpperCase();

type SelectedProfile = Extract<EntityWorkspaceProfile, Readonly<{ status: 'selected' }>>;
type SettingsSummaryMode = 'live' | 'history' | 'reading';

const settingsSummaryModeLabel = (mode: SettingsSummaryMode): string =>
  mode === 'live' ? 'Live' : mode === 'history' ? 'History' : 'Reading';

function ProfileHeader({ profile }: Readonly<{ profile: SelectedProfile }>) {
  return (
    <header>
      <span aria-hidden="true">{profileInitials(profile.name)}</span>
      <div>
        <small>Committed Entity profile</small>
        <strong data-testid="settings-profile-name">{profile.name}</strong>
        <p data-testid="settings-profile-role">{profile.isHub ? 'Hub entity' : 'User entity'}</p>
      </div>
    </header>
  );
}

function ProfileFields({ profile }: Readonly<{ profile: SelectedProfile }>) {
  return (
    <dl>
      <div><dt>Entity kind</dt><dd>{profile.entityKind || 'Not declared'}</dd></div>
      <div><dt>Sectors</dt><dd>{profile.sectors.length > 0 ? profile.sectors.join(' · ') : 'Not declared'}</dd></div>
      <div className="profile-wide-field"><dt>Bio</dt><dd>{profile.bio || 'No public bio'}</dd></div>
      <div><dt>Website</dt><dd title={profile.website}>{profile.website || 'Not published'}</dd></div>
      <div>
        <dt>Avatar reference</dt>
        <dd title={profile.avatar}>{profile.avatar ? formatAddress(profile.avatar) : 'Not published'}</dd>
      </div>
    </dl>
  );
}

function SettingsSummary({ context, profile, reserves, timeMachine }: Readonly<{
  context: EntityWorkspaceContext;
  profile: EntityWorkspaceProfile;
  reserves: EntityWorkspaceReserves;
  timeMachine: EntityWorkspaceTimeMachineState;
}>) {
  const summary = projectEntityWorkspaceSettingsSummary({ context, profile, reserves, timeMachine });
  if (summary.status !== 'selected') return null;
  return (
    <section className="entity-workspace-profile-subsection" data-testid="settings-runtime-summary">
      <header>
        <small>Committed Runtime context</small>
        <strong data-testid="settings-runtime-mode">{settingsSummaryModeLabel(summary.mode)}</strong>
      </header>
      <dl>
        <div className="profile-wide-field"><dt>Runtime</dt><dd title={summary.runtimeId ?? ''}>{formatAddress(summary.runtimeId ?? '') || 'Not attached'}</dd></div>
        <div><dt>Height</dt><dd data-testid="settings-runtime-height">{summary.runtimeHeight}</dd></div>
        <div><dt>Jurisdiction</dt><dd>{summary.jurisdictionName || 'Unassigned'}</dd></div>
        <div className="profile-wide-field"><dt>Entity</dt><dd title={summary.entityId}>{formatAddress(summary.entityId)}</dd></div>
        <div className="profile-wide-field"><dt>Signer</dt><dd title={summary.signerId ?? ''}>{formatAddress(summary.signerId ?? '') || 'Not exposed'}</dd></div>
        <div><dt>Hub</dt><dd>{summary.isHub ? 'Yes' : 'No'}</dd></div>
        <div><dt>Accounts</dt><dd data-testid="settings-account-count">{summary.accountCount}</dd></div>
        <div className="profile-wide-field"><dt>Visible reserves</dt><dd data-testid="settings-visible-reserve-count">{summary.visibleReserveCount}</dd></div>
      </dl>
    </section>
  );
}

function HubPolicyFields({ policy }: Readonly<{ policy: EntityWorkspaceHubPolicy }>) {
  if (policy.status !== 'selected') return null;
  return (
    <section className="entity-workspace-profile-hub-policy" data-testid="settings-hub-policy">
      <header>
        <small>Committed Hub policy</small>
        <strong>Version <b data-testid="settings-hub-policy-version">{policy.policyVersion}</b></strong>
      </header>
      <dl>
        <div><dt>Strategy</dt><dd>{policy.matchingStrategy}</dd></div>
        <div><dt>Routing fee</dt><dd>{policy.routingFeePPM} ppm</dd></div>
        <div><dt>Base fee</dt><dd>{policy.baseFee.toString()} raw units</dd></div>
        <div><dt>Liquidity fee</dt><dd>{policy.rebalanceLiquidityFeeBps.toString()} bps</dd></div>
        <div className="profile-wide-field"><dt>Rebalance timeout</dt><dd>{policy.rebalanceTimeoutMs === null ? 'Not declared' : `${policy.rebalanceTimeoutMs} ms`}</dd></div>
      </dl>
    </section>
  );
}

export function EntityWorkspaceProfilePanel({ context, hubPolicy, profile, reserves, timeMachine }: EntityWorkspaceProfilePanelProps) {
  if (profile.status !== 'selected') return null;
  return (
    <section className="entity-workspace-profile-panel" data-testid="settings-profile-projection">
      <ProfileHeader profile={profile} />
      <div className="entity-workspace-profile-content">
        <SettingsSummary context={context} profile={profile} reserves={reserves} timeMachine={timeMachine} />
        <ProfileFields profile={profile} />
        <HubPolicyFields policy={hubPolicy} />
      </div>
      <footer>
        <span>Read only</span>
        <strong>Profile edits stay on the canonical workspace</strong>
      </footer>
    </section>
  );
}
