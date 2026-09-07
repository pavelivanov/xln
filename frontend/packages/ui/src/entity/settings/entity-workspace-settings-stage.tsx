import type { ReactNode } from 'react';

import {
  ENTITY_SETTINGS_SECTIONS,
  type SettingsSubview,
} from '../../../../runtime-client/src/entity/entity-workspace-navigation';
import './entity-workspace-settings-stage.css';

type EntitySettingsSection = (typeof ENTITY_SETTINGS_SECTIONS)[number];

export function EntityWorkspaceSettingsStage({
  children,
  sections = ENTITY_SETTINGS_SECTIONS,
  settingsSubview,
}: Readonly<{
  children: ReactNode;
  sections?: readonly EntitySettingsSection[];
  settingsSubview: SettingsSubview;
}>) {
  const activeSection = settingsSubview === 'entity' ? 'wallet' : settingsSubview;
  return (
    <section className="entity-workspace-settings-stage">
      <nav aria-label="Entity settings sections" data-section-count={sections.length}>
        {sections.map(section => (
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
