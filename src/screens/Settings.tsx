import { ReactNode } from 'react';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { FileEditorScreen } from './FileEditorScreen';
import { SettingsFormScreen } from './SettingsFormScreen';
import { validateSettingsJsonText } from '../lib/settings-schema';

interface Props { sidebar?: ReactNode; embedded?: boolean }

export function SettingsScreen({ sidebar, embedded }: Props) {
  const { settingsView, set } = useAppStore();
  const { snapshot } = useConfigStore();
  const settingsFile = snapshot?.user_config.settings;

  const filePath = settingsFile?.source_path || '~/.claude/settings.json';
  const raw = (settingsFile?.raw as Record<string, unknown> | undefined) || {};
  const initialContent = JSON.stringify(raw, null, 2);
  const mtime = settingsFile?.mtime || '';
  const size = settingsFile?.size_bytes || initialContent.length;

  const toggle = (
    <SettingsViewToggle
      view={settingsView}
      onChange={v => set({ settingsView: v })}
    />
  );

  if (settingsView === 'form') {
    return (
      <SettingsFormScreen
        embedded={embedded}
        sidebar={sidebar}
        railKey="user"
        crumbs={[
          { label: '全局配置' },
          { label: 'settings.json' },
        ]}
        title="settings.json"
        scopeChip={{ label: '用户级', tone: 'orange' }}
        filePath={filePath}
        initialRaw={raw}
        initialMtime={mtime}
        sizeBytes={size}
        viewToggle={toggle}
      />
    );
  }

  return (
    <FileEditorScreen
      embedded={embedded}
      sidebar={sidebar}
      railKey="user"
      crumbs={[
        { label: '全局配置' },
        { label: 'settings.json' },
      ]}
      title="settings.json"
      scopeChip={{ label: '用户级', tone: 'orange' }}
      filePath={filePath}
      initialContent={initialContent}
      initialMtime={mtime}
      language="json"
      sizeBytes={size}
      validate={validateSettingsJsonText}
      extraActions={toggle}
    />
  );
}

function SettingsViewToggle({ view, onChange }: { view: 'form' | 'json'; onChange: (v: 'form' | 'json') => void }) {
  const opts: { id: 'form' | 'json'; label: string }[] = [
    { id: 'form', label: '表单' },
    { id: 'json', label: 'JSON' },
  ];
  return (
    <div style={{ display: 'inline-flex', background: 'var(--cc-bg-sunk)', borderRadius: 8, padding: 3, gap: 2 }}>
      {opts.map(o => (
        <div key={o.id} onClick={() => onChange(o.id)} style={{
          cursor: 'pointer', padding: '4px 12px', borderRadius: 6, fontSize: 11.5,
          fontWeight: view === o.id ? 500 : 400,
          background: view === o.id ? 'var(--cc-bg-raised)' : 'transparent',
          color: view === o.id ? 'var(--cc-ink)' : 'var(--cc-muted)',
        }}>{o.label}</div>
      ))}
    </div>
  );
}
