import { ReactNode } from 'react';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { FileEditorScreen } from './FileEditorScreen';

interface Props { sidebar: ReactNode; }

export function KeybindingsScreen({ sidebar }: Props) {
  const { go } = useAppStore();
  const { snapshot } = useConfigStore();
  const file = snapshot?.user_config.keybindings;
  const filePath = file?.source_path || '~/.claude/keybindings.json';
  const initial = file?.content && file.content.trim().length
    ? file.content
    : '{\n  "keybindings": []\n}\n';

  return (
    <FileEditorScreen
      sidebar={sidebar}
      railKey="user"
      crumbs={[
        { label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) },
        { label: 'keybindings.json' },
      ]}
      title="keybindings.json"
      scopeChip={{ label: '用户级 · 快捷键', tone: 'sky' }}
      filePath={filePath}
      initialContent={initial}
      initialMtime={file?.mtime || ''}
      language="json"
      sizeBytes={file?.size_bytes || initial.length}
    />
  );
}
