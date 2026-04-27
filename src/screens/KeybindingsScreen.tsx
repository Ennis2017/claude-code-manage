import { ReactNode } from 'react';
import { useConfigStore } from '../store/config-store';
import { FileEditorScreen } from './FileEditorScreen';

interface Props { sidebar?: ReactNode; embedded?: boolean }

export function KeybindingsScreen({ sidebar, embedded }: Props) {
  const { snapshot } = useConfigStore();
  const file = snapshot?.user_config.keybindings;
  const filePath = file?.source_path || '~/.claude/keybindings.json';
  const initial = file?.content && file.content.trim().length
    ? file.content
    : '{\n  "keybindings": []\n}\n';

  return (
    <FileEditorScreen
      embedded={embedded}
      sidebar={sidebar}
      railKey="user"
      crumbs={[
        { label: '全局配置' },
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
