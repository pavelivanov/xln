import { useState, type FormEvent } from 'react';

import type {
  EntityWorkspaceProfileDraft,
} from '../../runtime-client/src/entity-workspace-profile-update';
import type { EntityWorkspaceProfile } from '../../runtime-client/src/entity-workspace-profile';
import './entity-workspace-profile-editor.css';

type SelectedProfile = Extract<EntityWorkspaceProfile, Readonly<{ status: 'selected' }>>;
type SaveState = Readonly<{ status: 'idle' | 'saving' | 'saved' | 'error'; message: string }>;

const initialDraft = (profile: SelectedProfile): EntityWorkspaceProfileDraft => ({
  name: profile.name,
  avatar: profile.avatar,
  bio: profile.bio,
  website: profile.website,
});

const normalizedDraft = (draft: EntityWorkspaceProfileDraft): EntityWorkspaceProfileDraft => ({
  name: draft.name.trim(),
  avatar: draft.avatar.trim(),
  bio: draft.bio.trim(),
  website: draft.website.trim(),
});

const isDirty = (draft: EntityWorkspaceProfileDraft, profile: SelectedProfile): boolean => {
  const normalized = normalizedDraft(draft);
  return normalized.name !== profile.name
    || normalized.avatar !== profile.avatar
    || normalized.bio !== profile.bio
    || normalized.website !== profile.website;
};

export function EntityWorkspaceProfileEditor({
  disabledReason,
  onSave,
  profile,
}: Readonly<{
  disabledReason: string | null;
  onSave: (draft: EntityWorkspaceProfileDraft) => Promise<void>;
  profile: SelectedProfile;
}>) {
  const [draft, setDraft] = useState<EntityWorkspaceProfileDraft>(() => initialDraft(profile));
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle', message: '' });
  const dirty = isDirty(draft, profile);
  const update = (field: keyof EntityWorkspaceProfileDraft, value: string): void => {
    setDraft(current => ({ ...current, [field]: value }));
    setSaveState({ status: 'idle', message: '' });
  };
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (disabledReason || !dirty || !draft.name.trim() || saveState.status === 'saving') return;
    setSaveState({ status: 'saving', message: 'Submitting through the Runtime owner lane…' });
    try {
      await onSave(normalizedDraft(draft));
      setSaveState({ status: 'saved', message: 'Profile committed to the selected Entity.' });
    } catch (error: unknown) {
      setSaveState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error || 'Profile update failed'),
      });
    }
  };
  return (
    <form className="entity-workspace-profile-editor" data-testid="settings-profile-editor" onSubmit={event => { void submit(event); }}>
      <header>
        <div><small>Public profile command</small><strong>Edit committed identity</strong></div>
        <span>{dirty ? 'Unsaved' : 'Current'}</span>
      </header>
      <div className="profile-editor-fields">
        <label className="profile-editor-wide">
          <span>Name</span>
          <input data-testid="settings-profile-name-input" disabled={Boolean(disabledReason)} onChange={event => update('name', event.currentTarget.value)} value={draft.name} />
        </label>
        <label>
          <span>Avatar URL</span>
          <input data-testid="settings-profile-avatar-input" disabled={Boolean(disabledReason)} onChange={event => update('avatar', event.currentTarget.value)} value={draft.avatar} />
        </label>
        <label>
          <span>Website</span>
          <input data-testid="settings-profile-website-input" disabled={Boolean(disabledReason)} onChange={event => update('website', event.currentTarget.value)} value={draft.website} />
        </label>
        <label className="profile-editor-wide">
          <span>Bio</span>
          <textarea data-testid="settings-profile-bio-input" disabled={Boolean(disabledReason)} onChange={event => update('bio', event.currentTarget.value)} rows={3} value={draft.bio} />
        </label>
      </div>
      <footer>
        <p data-status={saveState.status} data-testid="settings-profile-status" role={saveState.status === 'error' ? 'alert' : 'status'}>
          {disabledReason || saveState.message || 'Changes commit only after the Runtime publishes the next frame.'}
        </p>
        <button data-testid="settings-profile-save" disabled={Boolean(disabledReason) || !dirty || !draft.name.trim() || saveState.status === 'saving'} type="submit">
          {saveState.status === 'saving' ? 'Committing…' : 'Save profile'}
        </button>
      </footer>
    </form>
  );
}
