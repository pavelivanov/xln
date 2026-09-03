import type { EntityWorkspaceHubPolicy } from '../../runtime-client/src/entity-workspace-hub-policy';
import type { EntityWorkspaceProfile } from '../../runtime-client/src/entity-workspace-profile';
import { formatAddress } from './entity-workspace-display';
import './entity-workspace-profile-panel.css';

type EntityWorkspaceProfilePanelProps = Readonly<{
  hubPolicy: EntityWorkspaceHubPolicy;
  profile: EntityWorkspaceProfile;
}>;

const profileInitials = (name: string): string => name
  .split(/\s+/u)
  .slice(0, 2)
  .map((part) => part[0] ?? '')
  .join('')
  .toUpperCase();

type SelectedProfile = Extract<EntityWorkspaceProfile, Readonly<{ status: 'selected' }>>;

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

export function EntityWorkspaceProfilePanel({ hubPolicy, profile }: EntityWorkspaceProfilePanelProps) {
  if (profile.status !== 'selected') return null;
  return (
    <section className="entity-workspace-profile-panel" data-testid="settings-profile-projection">
      <ProfileHeader profile={profile} />
      <div className="entity-workspace-profile-content">
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
