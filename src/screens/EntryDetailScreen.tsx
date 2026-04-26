import { ReactNode, useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { Rail } from '../components/Rail';
import { FileEditorScreen } from './FileEditorScreen';
import { ConfirmDeleteDialog } from '../components/NewEntryDialog';
import { deletePath, readTextFile } from '../lib/fs-bridge';

interface Props {
  sidebar: ReactNode;
  railKey: 'user' | 'projects';
  railProjectId?: string;
  crumbs: { label: string; onClick?: () => void }[];
  title: string;
  scopeChip: { label: string; tone: 'orange' | 'leaf' | 'sky' | 'plum' };
  filePath: string;
  initialMtime: string;
  sizeBytes: number;
  onDeleted: () => void;
}

export function EntryDetailScreen(props: Props) {
  const { sidebar, railKey, railProjectId, crumbs, title, scopeChip, filePath, initialMtime, sizeBytes, onDeleted } = props;
  const { toast_msg } = useAppStore();
  const { scanAll } = useConfigStore();
  const [confirm, setConfirm] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setLoadError(null);
    readTextFile(filePath)
      .then((c) => { if (!cancelled) setContent(c); })
      .catch((e) => { if (!cancelled) setLoadError(String(e)); });
    return () => { cancelled = true; };
  }, [filePath]);

  if (loadError) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <Rail active={railKey} projectId={railProjectId} />
        {sidebar}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8543A', fontSize: 13 }}>
          读取文件失败：{loadError}
        </div>
      </div>
    );
  }

  if (content === null) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <Rail active={railKey} projectId={railProjectId} />
        {sidebar}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cc-muted)', fontSize: 13 }}>
          加载中…
        </div>
      </div>
    );
  }

  return (
    <>
      <FileEditorScreen
        sidebar={sidebar}
        railKey={railKey}
        railProjectId={railProjectId}
        crumbs={crumbs}
        title={title}
        scopeChip={scopeChip}
        filePath={filePath}
        initialContent={content}
        initialMtime={initialMtime}
        language="markdown"
        sizeBytes={sizeBytes}
        extraActions={
          <button
            className="cc-btn ghost"
            style={{ color: '#B8543A' }}
            onClick={() => setConfirm(true)}
          >删除</button>
        }
      />
      {confirm && (
        <ConfirmDeleteDialog
          title={`删除 ${title}？`}
          body={`将从磁盘移除 ${title}，此操作不可撤销。`}
          pathHint={filePath}
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            await deletePath(filePath);
            toast_msg(`已删除 ${title}`, 'success');
            setConfirm(false);
            await scanAll();
            onDeleted();
          }}
        />
      )}
    </>
  );
}
