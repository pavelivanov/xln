import type { ReactNode } from 'react';

import {
  ENTITY_SETTINGS_SECTIONS,
  type SettingsSubview,
} from '../../runtime-client/src/entity-workspace-navigation';
import './entity-workspace-settings-stage.css';

export function EntityWorkspaceSettingsStage({
  children,
  settingsSubview,
}: Readonly<{ children: ReactNode; settingsSubview: SettingsSubview }>) {
  const activeSection = settingsSubview === 'entity' ? 'wallet' : settingsSubview;
  return (
    <section className="entity-workspace-settings-stage">
      <nav aria-label="Entity settings sections">
        {ENTITY_SETTINGS_SECTIONS.map(section => (
          <a
            aria-current={section.id === activeSection ? 'page' : undefined}
            href={section.id === 'wallet' ? '#settings' : `#settings/${section.id}`}
            key={section.id}
          >
            {section.label}
          </a>
        ))}
      </nav>
      <div>{children}</div>
    </section>
  );
}
