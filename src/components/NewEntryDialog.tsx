import { useState } from 'react';
import { Dialog } from './Dialog';

export type EntryKind = 'command' | 'skill' | 'agent';

interface NewEntryDialogProps {
  kind: EntryKind;
  scopeLabel: string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}

const CONFIG: Record<EntryKind, { title: string; placeholder: string; hint: string }> = {
  command: {
    title: '新建命令',
    placeholder: '例如：commit',
    hint: '会在 commands/ 目录下创建 <name>.md',
  },
  skill: {
    title: '新建 Skill',
    placeholder: '例如：my-skill',
    hint: '会创建 skills/<name>/ 目录并生成 SKILL.md',
  },
  agent: {
    title: '新建 Agent',
    placeholder: '例如：code-helper',
    hint: '会在 agents/ 目录下创建 <name>.md',
  },
};

const NAME_RE = /^[a-zA-Z0-9_\-.]+$/;

export function NewEntryDialog({ kind, scopeLabel, onClose, onConfirm }: NewEntryDialogProps) {
  const cfg = CONFIG[kind];
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setErr('名称不能为空'); return; }
    if (!NAME_RE.test(trimmed)) { setErr('仅支持字母数字 . _ -'); return; }
    setErr(null);
    setBusy(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={cfg.title}
      onClose={onClose}
      footer={
        <>
          <button className="cc-btn" onClick={onClose} disabled={busy}>取消</button>
          <button className="cc-btn primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? '创建中…' : '创建'}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginBottom: 12 }}>
        作用域：<span className="mono">{scopeLabel}</span>
      </div>
      <label style={{ fontSize: 12, color: 'var(--cc-ink-soft)', fontWeight: 500, display: 'block', marginBottom: 6 }}>
        名称
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder={cfg.placeholder}
        className="mono"
        style={{
          width: '100%', height: 34, borderRadius: 7,
          border: '1px solid var(--cc-line-strong)', padding: '0 10px',
          fontSize: 13, background: 'var(--cc-bg)', color: 'var(--cc-ink)',
          outline: 'none',
        }}
      />
      <div style={{ fontSize: 11, color: 'var(--cc-muted)', marginTop: 8, lineHeight: 1.55 }}>
        {cfg.hint}
      </div>
      {err && (
        <div style={{
          marginTop: 12, padding: '8px 10px', borderRadius: 7,
          background: '#FCEAEA', color: '#6B1F1F', fontSize: 12,
        }}>{err}</div>
      )}
    </Dialog>
  );
}

interface ConfirmDeleteDialogProps {
  title: string;
  body: string;
  pathHint?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({ title, body, pathHint, onCancel, onConfirm }: ConfirmDeleteDialogProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="cc-btn" onClick={onCancel} disabled={busy}>取消</button>
          <button
            className="cc-btn primary"
            style={{ background: '#B8543A' }}
            onClick={run}
            disabled={busy}
          >{busy ? '删除中…' : '确认删除'}</button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: 'var(--cc-ink-soft)', lineHeight: 1.6, marginBottom: 10 }}>
        {body}
      </div>
      {pathHint && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--cc-muted)', marginBottom: 10 }}>
          {pathHint}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--cc-muted)' }}>删除前会自动备份到 <span className="mono">~/.claude/.backups/</span></div>
      {err && (
        <div style={{
          marginTop: 12, padding: '8px 10px', borderRadius: 7,
          background: '#FCEAEA', color: '#6B1F1F', fontSize: 12,
        }}>{err}</div>
      )}
    </Dialog>
  );
}
