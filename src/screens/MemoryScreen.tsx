import { ReactNode } from 'react';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { FileEditorScreen } from './FileEditorScreen';

interface Props { sidebar?: ReactNode; embedded?: boolean }

export function GlobalMemoryScreen({ sidebar, embedded }: Props) {
  const { snapshot } = useConfigStore();
  const file = snapshot?.user_config.memory;
  const filePath = file?.source_path || '~/.claude/CLAUDE.md';

  return (
    <FileEditorScreen
      embedded={embedded}
      sidebar={sidebar}
      railKey="user"
      crumbs={[
        { label: '全局配置' },
        { label: 'CLAUDE.md' },
      ]}
      title="CLAUDE.md"
      scopeChip={{ label: '用户级 · 记忆', tone: 'leaf' }}
      filePath={filePath}
      initialContent={file?.content || ''}
      initialMtime={file?.mtime || ''}
      language="markdown"
      sizeBytes={file?.size_bytes || 0}
    />
  );
}

interface ProjectMemoryProps extends Props {
  projectId: string;
}

export function ProjectMemoryScreen({ sidebar, projectId, embedded }: ProjectMemoryProps) {
  const { go } = useAppStore();
  const { snapshot } = useConfigStore();
  const project = snapshot?.projects.find(p => p.id === projectId);
  const file = project?.memory;
  const filePath = file?.source_path || (project ? `${project.path}/CLAUDE.md` : 'CLAUDE.md');

  return (
    <FileEditorScreen
      embedded={embedded}
      sidebar={sidebar}
      railKey="projects"
      railProjectId={projectId}
      crumbs={[
        { label: '项目', onClick: () => go({ name: 'dashboard' }) },
        { label: project?.name || '—', onClick: () => go({ name: 'project', id: projectId, screen: 'overview' }) },
        { label: 'CLAUDE.md' },
      ]}
      title="CLAUDE.md"
      scopeChip={{ label: '项目 · 记忆', tone: 'leaf' }}
      filePath={filePath}
      initialContent={file?.content || ''}
      initialMtime={file?.mtime || ''}
      language="markdown"
      sizeBytes={file?.size_bytes || 0}
    />
  );
}
