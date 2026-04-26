import { ReactNode, useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { Rail } from '../components/Rail';
import { Topbar } from '../components/Topbar';
import { FileEditorScreen } from './FileEditorScreen';
import { ConfirmDeleteDialog } from '../components/NewEntryDialog';
import { deletePath, listSkillFiles, readTextFile, SkillFileEntry, revealInFinder } from '../lib/fs-bridge';

interface Props {
  sidebar: ReactNode;
  railKey: 'user' | 'projects';
  railProjectId?: string;
  crumbs: { label: string; onClick?: () => void }[];
  title: string;
  skillDir: string;
  scopeChip: { label: string; tone: 'orange' | 'leaf' | 'sky' | 'plum' };
  onDeleted: () => void;
}

export function SkillDetailScreen(props: Props) {
  const { sidebar, railKey, railProjectId, crumbs, title, skillDir, scopeChip, onDeleted } = props;
  const { toast_msg } = useAppStore();
  const { scanAll, snapshot } = useConfigStore();
  const [files, setFiles] = useState<SkillFileEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SkillFileEntry | null>(null);
  const [confirm, setConfirm] = useState(false);

  const refresh = () => {
    listSkillFiles(skillDir)
      .then((list) => {
        setFiles(list);
        if (selectedFile) {
          const found = list.find((f) => f.source_path === selectedFile.source_path);
          if (!found) setSelectedFile(null);
          else if (found.mtime !== selectedFile.mtime) setSelectedFile(found);
        }
      })
      .catch((e) => setErr(String(e)));
  };

  useEffect(() => {
    setFiles(null);
    setErr(null);
    setSelectedFile(null);
    refresh();
  }, [skillDir]);

  useEffect(() => {
    refresh();
  }, [snapshot?.scanned_at]);

  if (selectedFile && !selectedFile.is_dir) {
    const lang = selectedFile.name.toLowerCase().endsWith('.json') ? 'json' : 'markdown';
    return (
      <FileEditorScreenWrapped
        sidebar={sidebar}
        railKey={railKey}
        railProjectId={railProjectId}
        crumbs={[
          ...crumbs,
          { label: selectedFile.relative_path },
        ]}
        title={selectedFile.relative_path}
        scopeChip={scopeChip}
        filePath={selectedFile.source_path}
        initialMtime={selectedFile.mtime}
        sizeBytes={selectedFile.size_bytes}
        language={lang}
        onBack={() => setSelectedFile(null)}
      />
    );
  }

  const total = files?.length ?? 0;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
      <Rail active={railKey} projectId={railProjectId} />
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', overflow: 'hidden' }}>
        <Topbar
          crumbs={crumbs}
          right={
            <>
              <button className="cc-btn ghost" onClick={async () => {
                try { await revealInFinder(skillDir); } catch (e) { toast_msg(`无法打开 Finder：${String(e)}`, 'error'); }
              }}>在 Finder 中显示</button>
              <button
                className="cc-btn ghost"
                style={{ color: '#B8543A' }}
                onClick={() => setConfirm(true)}
              >删除 Skill</button>
            </>
          }
        />
        <div style={{ flex: 1, overflow: 'auto', padding: '26px 36px 36px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</h1>
              <span className={`cc-chip ${scopeChip.tone}`} style={{ height: 20 }}>{scopeChip.label}</span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--cc-muted)' }}>{skillDir}</div>
            <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', marginTop: 4 }}>{total} 个文件</div>
          </div>

          {err && (
            <div style={{ padding: '10px 12px', background: '#FCEAEA', color: '#6B1F1F', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
              {err}
            </div>
          )}

          {files === null ? (
            <div style={{ color: 'var(--cc-muted)', fontSize: 12 }}>加载中…</div>
          ) : files.length === 0 ? (
            <div style={{ color: 'var(--cc-muted)', fontSize: 12, fontStyle: 'italic' }}>空 Skill 目录</div>
          ) : (
            <div style={{ background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 10, overflow: 'hidden' }}>
              {files.map((f, i) => (
                <div
                  key={f.source_path}
                  onClick={() => !f.is_dir && setSelectedFile(f)}
                  style={{
                    padding: '10px 14px', borderBottom: i < files.length - 1 ? '1px solid var(--cc-line)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: f.is_dir ? 'default' : 'pointer',
                    background: 'transparent',
                  }}
                >
                  <div className="mono" style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: f.is_dir ? 'var(--cc-bg-sunk)' : 'var(--cc-leaf-wash)',
                    color: f.is_dir ? 'var(--cc-muted)' : '#4A5B3D',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: 10, flexShrink: 0,
                  }}>{f.is_dir ? 'D' : 'F'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{f.relative_path}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--cc-muted)', marginTop: 1 }}>
                      {f.is_dir ? '目录' : `${(f.size_bytes / 1024).toFixed(1)} KB`} · {f.mtime}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {confirm && (
        <ConfirmDeleteDialog
          title={`删除 Skill ${title}？`}
          body={`将删除整个 Skill 目录及其下所有文件。`}
          pathHint={skillDir}
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            await deletePath(skillDir);
            toast_msg(`已删除 Skill ${title}`, 'success');
            setConfirm(false);
            await scanAll();
            onDeleted();
          }}
        />
      )}
    </div>
  );
}

function FileEditorScreenWrapped(props: {
  sidebar: ReactNode;
  railKey: 'user' | 'projects';
  railProjectId?: string;
  crumbs: { label: string; onClick?: () => void }[];
  title: string;
  scopeChip: { label: string; tone: 'orange' | 'leaf' | 'sky' | 'plum' };
  filePath: string;
  initialMtime: string;
  sizeBytes: number;
  language: 'markdown' | 'json';
  onBack: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setErr(null);
    readTextFile(props.filePath)
      .then((c) => { if (!cancelled) setContent(c); })
      .catch((e) => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [props.filePath]);

  if (err) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <Rail active={props.railKey} projectId={props.railProjectId} />
        {props.sidebar}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8543A', fontSize: 13 }}>
          读取文件失败：{err}
          <button className="cc-btn ghost" onClick={props.onBack} style={{ marginLeft: 12 }}>返回</button>
        </div>
      </div>
    );
  }
  if (content === null) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <Rail active={props.railKey} projectId={props.railProjectId} />
        {props.sidebar}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cc-muted)', fontSize: 13 }}>加载中…</div>
      </div>
    );
  }
  const crumbs = props.crumbs.map((c, i, arr) => i === arr.length - 1 ? c : { ...c, onClick: c.onClick });
  const crumbsWithBack = [...crumbs.slice(0, -1), { label: crumbs[crumbs.length - 1].label, onClick: undefined }];
  return (
    <FileEditorScreen
      sidebar={props.sidebar}
      railKey={props.railKey}
      railProjectId={props.railProjectId}
      crumbs={[
        ...crumbsWithBack.slice(0, -1),
        { label: '← 返回 Skill', onClick: props.onBack },
        crumbsWithBack[crumbsWithBack.length - 1],
      ]}
      title={props.title}
      scopeChip={props.scopeChip}
      filePath={props.filePath}
      initialContent={content}
      initialMtime={props.initialMtime}
      language={props.language}
      sizeBytes={props.sizeBytes}
    />
  );
}
