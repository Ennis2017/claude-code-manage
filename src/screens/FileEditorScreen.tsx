import { ReactNode, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

import { Rail } from '../components/Rail';
import { Topbar } from '../components/Topbar';
import { CodeEditor, CodeLanguage } from '../components/CodeEditor';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { writeJsonFile, writeTextFile, revealInFinder, detectExternalChange } from '../lib/fs-bridge';

type RailKey = 'user' | 'projects';

export interface ValidationResult {
  ok: boolean;
  issues: { path: string; message: string }[];
  parseError?: string;
}

interface FileEditorScreenProps {
  sidebar?: ReactNode;
  railKey: RailKey;
  railProjectId?: string;
  crumbs: { label: string; onClick?: () => void }[];
  title: string;
  scopeChip: { label: string; tone: 'orange' | 'leaf' | 'sky' | 'plum' };
  filePath: string;
  initialContent: string;
  initialMtime: string;
  language: CodeLanguage;
  sizeBytes: number;
  extraActions?: ReactNode;
  validate?: (text: string) => ValidationResult;
  embedded?: boolean;
}

type ViewMode = 'edit' | 'preview' | 'split';

export function FileEditorScreen(props: FileEditorScreenProps) {
  const { sidebar, railKey, railProjectId, crumbs, title, scopeChip, filePath, initialContent, initialMtime, language, sizeBytes, extraActions, validate, embedded } = props;
  const { toast_msg } = useAppStore();
  const { scanAll } = useConfigStore();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialContent);
  const [baseline, setBaseline] = useState(initialContent);
  const [editorMtime, setEditorMtime] = useState(initialMtime);
  const [view, setView] = useState<ViewMode>(language === 'markdown' ? 'preview' : 'edit');
  const [saving, setSaving] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [diskMtime, setDiskMtime] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const currentText = editing ? draft : initialContent;
  const validation: ValidationResult | null = useMemo(
    () => (validate ? validate(currentText) : null),
    [validate, currentText],
  );

  useEffect(() => {
    if (!editing) {
      setDraft(initialContent);
      setBaseline(initialContent);
      setEditorMtime(initialMtime);
    }
  }, [initialContent, initialMtime, editing]);

  const dirty = editing && draft !== baseline;

  const enterEdit = () => {
    setDraft(initialContent);
    setBaseline(initialContent);
    setEditorMtime(initialMtime);
    setEditing(true);
    if (language === 'markdown') setView('edit');
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(baseline);
    if (language === 'markdown') setView('preview');
  };

  const doSave = async (force = false) => {
    setSaving(true);
    try {
      if (!force) {
        const changed = await detectExternalChange(filePath, editorMtime).catch(() => false);
        if (changed) {
          const dm = await fetchMtimeFallback(filePath);
          setDiskMtime(dm);
          setShowConflict(true);
          setSaving(false);
          return;
        }
      }
      const result = language === 'json'
        ? await writeJsonFile(filePath, draft, force ? null : editorMtime)
        : await writeTextFile(filePath, draft, force ? null : editorMtime);
      setBaseline(draft);
      setEditorMtime(result.mtime);
      setEditing(false);
      setShowConflict(false);
      toast_msg(`已保存 · ${title}`, 'success');
      if (language === 'markdown') setView('preview');
      scanAll();
    } catch (e) {
      toast_msg(`保存失败：${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const onReveal = async () => {
    try { await revealInFinder(filePath); } catch (e) { toast_msg(`无法打开 Finder：${String(e)}`, 'error'); }
  };

  const inner = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', overflow: 'hidden', position: 'relative', minWidth: 0, minHeight: 0 }}>
        {editing ? (
          <div style={{ height: 52, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF4EC', borderBottom: '1px solid #EDD6C5', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, background: 'var(--cc-orange)', color: 'white', fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                <span>编辑中</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--cc-ink-soft)' }}>
                {title} {dirty && <span style={{ color: 'var(--cc-orange-deep)', fontWeight: 500 }}>· 未保存</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {validation && <ValidationPill validation={validation} onClick={() => setShowValidation(v => !v)} />}
              {language === 'markdown' && <ViewToggle view={view} setView={setView} />}
              <button className="cc-btn ghost" onClick={cancelEdit} disabled={saving}>取消</button>
              <button
                className="cc-btn primary"
                onClick={() => doSave(false)}
                disabled={saving || !dirty || (validation ? !validation.ok : false)}
                title={validation && !validation.ok ? 'Schema 校验未通过，请先修复错误再保存' : undefined}
              >{saving ? '保存中…' : '保存'}</button>
            </div>
          </div>
        ) : (
          <Topbar
            crumbs={crumbs}
            right={
              <>
                <div style={{ fontSize: 11, color: 'var(--cc-muted)', display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cc-muted-soft)' }} />
                  <span>只读</span>
                </div>
                {validation && <ValidationPill validation={validation} onClick={() => setShowValidation(v => !v)} />}
                {language === 'markdown' && <ViewToggle view={view} setView={setView} />}
                <button className="cc-btn ghost" onClick={onReveal}>在 Finder 中显示</button>
                {extraActions}
                <button className="cc-btn primary" onClick={enterEdit}>✎ 编辑</button>
              </>
            }
          />
        )}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '20px 28px 24px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</h1>
              <span className={`cc-chip ${scopeChip.tone}`} style={{ height: 20 }}>{scopeChip.label}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span className="mono">{filePath}</span>
              <span>· {(sizeBytes / 1024).toFixed(1)} KB · 修改于 {editorMtime || '—'}</span>
            </div>
          </div>

          {validation && showValidation && (
            <ValidationPanel validation={validation} onClose={() => setShowValidation(false)} />
          )}

          <EditorBody
            language={language}
            view={editing ? view : (language === 'markdown' ? view : 'preview')}
            editing={editing}
            value={editing ? draft : initialContent}
            onChange={setDraft}
          />
        </div>

        {showConflict && (
          <ConflictDialog
            diskMtime={diskMtime || ''}
            editorMtime={editorMtime}
            onCancel={() => setShowConflict(false)}
            onOverwrite={() => doSave(true)}
          />
        )}
    </div>
  );

  if (embedded) return inner;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
      <Rail active={railKey} projectId={railProjectId} />
      {sidebar}
      {inner}
    </div>
  );
}

function EditorBody({ language, view, editing, value, onChange }: {
  language: CodeLanguage; view: ViewMode; editing: boolean; value: string; onChange: (v: string) => void;
}) {
  if (language === 'json') {
    return (
      <CodeEditor
        value={value}
        onChange={editing ? onChange : undefined}
        language="json"
        readOnly={!editing}
      />
    );
  }
  // markdown
  if (view === 'edit') {
    return <CodeEditor value={value} onChange={editing ? onChange : undefined} language="markdown" readOnly={!editing} />;
  }
  if (view === 'preview') {
    return <MarkdownPreview value={value} />;
  }
  return (
    <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <CodeEditor value={value} onChange={editing ? onChange : undefined} language="markdown" readOnly={!editing} />
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <MarkdownPreview value={value} />
      </div>
    </div>
  );
}

function MarkdownPreview({ value }: { value: string }) {
  const safe = useMemo(() => value || '*（空文件）*', [value]);
  return (
    <div style={{
      flex: 1, overflow: 'auto', borderRadius: 12,
      border: '1px solid var(--cc-line)', background: 'var(--cc-bg-raised)',
      padding: '28px 36px', minHeight: 0,
    }} className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      >
        {safe}
      </ReactMarkdown>
    </div>
  );
}

function ViewToggle({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }) {
  const opts: { id: ViewMode; label: string }[] = [
    { id: 'edit', label: '编辑' },
    { id: 'split', label: '分屏' },
    { id: 'preview', label: '预览' },
  ];
  return (
    <div style={{ display: 'inline-flex', background: 'var(--cc-bg-sunk)', borderRadius: 8, padding: 3, gap: 2 }}>
      {opts.map(o => (
        <div key={o.id} onClick={() => setView(o.id)} style={{
          cursor: 'pointer', padding: '4px 12px', borderRadius: 6, fontSize: 11.5,
          fontWeight: view === o.id ? 500 : 400,
          background: view === o.id ? 'var(--cc-bg-raised)' : 'transparent',
          color: view === o.id ? 'var(--cc-ink)' : 'var(--cc-muted)',
        }}>{o.label}</div>
      ))}
    </div>
  );
}

async function fetchMtimeFallback(_p: string): Promise<string> {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

function ValidationPill({ validation, onClick }: { validation: ValidationResult; onClick: () => void }) {
  const total = validation.issues.length + (validation.parseError ? 1 : 0);
  const label = validation.parseError
    ? 'JSON 解析失败'
    : validation.ok
      ? 'Schema 校验通过'
      : `Schema 错误 · ${total}`;
  const bg = validation.ok ? 'var(--cc-leaf-wash)' : 'rgba(217,119,87,0.14)';
  const color = validation.ok ? '#4A5B3D' : 'var(--cc-orange-deep)';
  const dot = validation.ok ? 'var(--cc-leaf)' : 'var(--cc-orange)';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 26, padding: '0 10px', borderRadius: 7,
        background: bg, color, border: 'none', fontSize: 11.5, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      <span>{label}</span>
    </button>
  );
}

function ValidationPanel({ validation, onClose }: { validation: ValidationResult; onClose: () => void }) {
  if (validation.ok && !validation.parseError) return null;
  return (
    <div style={{
      marginBottom: 10, borderRadius: 10,
      border: '1px solid #EDD6C5', background: '#FFF9F3',
      padding: '12px 16px', fontSize: 12, color: 'var(--cc-ink-soft)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontWeight: 600, color: 'var(--cc-orange-deep)' }}>
          {validation.parseError ? 'JSON 解析错误' : `Schema 校验未通过（${validation.issues.length} 条）`}
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--cc-muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      {validation.parseError && <div className="mono" style={{ fontSize: 11.5, color: 'var(--cc-orange-deep)' }}>{validation.parseError}</div>}
      {validation.issues.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          {validation.issues.slice(0, 8).map((it, i) => (
            <li key={i}>
              <span className="mono" style={{ color: 'var(--cc-orange-deep)', marginRight: 8 }}>{it.path}</span>
              <span>{it.message}</span>
            </li>
          ))}
          {validation.issues.length > 8 && (
            <li style={{ color: 'var(--cc-muted)' }}>…还有 {validation.issues.length - 8} 条未展开</li>
          )}
        </ul>
      )}
    </div>
  );
}

function ConflictDialog({ diskMtime, editorMtime, onCancel, onOverwrite }: { diskMtime: string; editorMtime: string; onCancel: () => void; onOverwrite: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(31,27,22,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 40 }}>
      <div style={{ width: 560, background: 'var(--cc-bg-raised)', borderRadius: 14, boxShadow: '0 24px 80px rgba(31,27,22,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '26px 28px 20px', borderBottom: '1px solid var(--cc-line)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#FFF4EC', color: 'var(--cc-orange-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, flexShrink: 0 }}>!</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>文件在你编辑期间被外部修改过</div>
              <div style={{ fontSize: 12.5, color: 'var(--cc-ink-soft)', lineHeight: 1.55 }}>磁盘上的内容比你打开时更新。如果直接保存，会覆盖那份改动。</div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', display: 'flex', gap: 16, marginLeft: 50, marginTop: 10, fontFamily: 'JetBrains Mono, monospace' }}>
            <div><div style={{ color: 'var(--cc-muted-soft)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 2 }}>你进入编辑时</div><div>{editorMtime || '—'}</div></div>
            <div style={{ color: 'var(--cc-muted-soft)', fontSize: 16, marginTop: 14 }}>→</div>
            <div><div style={{ color: 'var(--cc-orange-deep)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 2 }}>磁盘当前</div><div style={{ color: 'var(--cc-orange-deep)', fontWeight: 500 }}>{diskMtime || '—'}</div></div>
          </div>
        </div>
        <div style={{ padding: '18px 28px', background: 'var(--cc-bg-sunk)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="cc-btn" style={{ height: 32 }} onClick={onCancel}>取消保存</button>
          <button className="cc-btn primary" style={{ height: 32 }} onClick={onOverwrite}>覆盖磁盘内容</button>
        </div>
      </div>
    </div>
  );
}
