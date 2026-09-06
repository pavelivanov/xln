import { useEffect, useState } from 'react';
import type { IDockviewPanelHeaderProps } from 'dockview';

export function OpsPinnedTab({ api }: IDockviewPanelHeaderProps) {
  const [title, setTitle] = useState(api.title ?? 'Main Wallet');
  useEffect(() => {
    const subscription = api.onDidTitleChange(event => setTitle(event.title));
    return () => subscription.dispose();
  }, [api]);
  return <span className="ops-pinned-tab" title="Pinned reference panel">📌 {title}</span>;
}
