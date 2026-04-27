import Editor, { OnMount } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store';
import { detectExternalChange, readTextFileMeta, writeTextFile } from '../../lib/fs-bridge';

interface Props {
  path: string;
  language?: string;
}

type Status = 'loading' | 'ready' | 'error';

/**
 * Monaco-based 文本编辑器，主要给 sh / 简单文本用。
 * 保存路径：detect_external_change → write_text_file(expected_mtime)。
 * 外部修改时让用户选择"覆盖"还是"取消"——和 settings.json 的编辑模式一致。
 */
export function ShEditor({ path, language = 'shell' }: Props) {
  const { toast_msg } = useAppStore();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [original, setOriginal] = useState('');
  const [draft, setDraft] = useState('');
  const [mtime, setMtime] = useState('');
  const [size, setSize] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const reload = async () => {
    setStatus('loading');
    try {
      const meta = await readTextFileMeta(path);
      if (!meta.exists) {
        setStatus('error');
        setErrorMsg('文件不存在');
        return;
      }
      setOriginal(meta.content);
      setDraft(meta.content);
      setMtime(meta.mtime);
      setSize(meta.size_bytes);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setErrorMsg(String(e));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const dirty = status === 'ready' && draft !== original;

  const doSave = async (force = false) => {
    if (!dirty) return;
    setSaving(true);
    try {
      if (!force) {
        const changed = await detectExternalChange(path, mtime).catch(() => false);
        if (changed) {
          setShowConflict(true);
          setSaving(false);
          return;
        }
      }
      const result = await writeTextFile(path, draft, force ? null : mtime);
      setOriginal(draft);
      setMtime(result.mtime);
      setSize(result.size_bytes);
      setShowConflict(false);
      toast_msg(`已保存 · ${path.split('/').pop()}`, 'success');
    } catch (e) {
      toast_msg(`保存失败：${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ⌘S / Ctrl+S 保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        if (status === 'ready') {
          e.preventDefault();
          doSave();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dirty, draft, mtime]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--cc-bg)' }}>
      {/* 编辑器工具条 */}
      <div style={{
        height: 36, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--cc-line)', background: 'var(--cc-bg-raised)',
        fontSize: 11.5, color: 'var(--cc-muted)', flexShrink: 0,
      }}>
        <span className="mono" style={{ color: 'var(--cc-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {path}
        </span>
        {status === 'ready' && (
          <span style={{ fontSize: 10.5, color: 'var(--cc-muted-soft)' }}>
            {(size / 1024).toFixed(1)} KB · {mtime}
          </span>
        )}
        {dirty && (
          <span className="cc-chip orange" style={{ height: 18, fontSize: 10 }}>未保存</span>
        )}
        <button className="cc-btn ghost" style={{ height: 24, fontSize: 11 }} onClick={() => reload()} disabled={saving}>
          重新载入
        </button>
        <button
          className="cc-btn primary"
          style={{ height: 24, fontSize: 11 }}
          onClick={() => doSave()}
          disabled={!dirty || saving}
        >{saving ? '保存中…' : '保存 (⌘S)'}</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {status === 'loading' && (
          <div style={{ padding: 24, color: 'var(--cc-muted)', fontSize: 12 }}>载入中…</div>
        )}
        {status === 'error' && (
          <div style={{ padding: 24, color: '#A33', fontSize: 12 }}>{errorMsg}</div>
        )}
        {status === 'ready' && (
          <Editor
            height="100%"
            language={language}
            value={draft}
            onChange={v => setDraft(v ?? '')}
            onMount={(editor) => { editorRef.current = editor; }}
            options={{
              fontSize: 12.5,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              renderWhitespace: 'selection',
              tabSize: 2,
              automaticLayout: true,
              wordWrap: 'on',
            }}
          />
        )}
      </div>

      {showConflict && (
        <ConflictDialog
          path={path}
          onCancel={() => setShowConflict(false)}
          onOverwrite={() => doSave(true)}
          onReload={async () => { setShowConflict(false); await reload(); }}
        />
      )}
    </div>
  );
}

function ConflictDialog({ path, onCancel, onOverwrite, onReload }: {
  path: string;
  onCancel: () => void;
  onOverwrite: () => void;
  onReload: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(31,27,22,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)',
        borderRadius: 12, padding: '20px 22px', maxWidth: 460, fontSize: 12.5,
        color: 'var(--cc-ink-soft)', boxShadow: '0 12px 30px rgba(31,27,22,0.18)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cc-ink)', marginBottom: 8 }}>文件已被外部修改</div>
        <p className="mono" style={{ fontSize: 11, color: 'var(--cc-muted)', marginBottom: 6 }}>{path}</p>
        <p style={{ marginBottom: 16, lineHeight: 1.55 }}>
          其它进程改写了这个文件。你可以选择重新载入磁盘内容（丢弃当前编辑），或强制用当前内容覆盖（远端改动会丢失）。
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="cc-btn ghost" onClick={onCancel}>取消</button>
          <button className="cc-btn ghost" onClick={onReload}>重新载入</button>
          <button className="cc-btn primary" onClick={onOverwrite}>覆盖保存</button>
        </div>
      </div>
    </div>
  );
}
