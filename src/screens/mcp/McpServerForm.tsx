import { useState } from 'react';
import { detectTransport, McpTransport } from '../../lib/mcp-schema';

interface Props {
  name: string;
  server: Record<string, unknown>;
  editing: boolean;
  existingNames: string[];
  onRename: (newName: string) => void;
  onChange: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function McpServerForm({ name, server, editing, existingNames, onRename, onChange, onRemove }: Props) {
  const transport = detectTransport(server);
  const [renameDraft, setRenameDraft] = useState(name);

  const setTransport = (t: McpTransport) => {
    if (t === transport) return;
    const next: Record<string, unknown> = {};
    if (t === 'stdio') {
      const command = (server.command as string) ?? '';
      next.command = command;
      if (Array.isArray(server.args)) next.args = server.args;
      if (server.env) next.env = server.env;
    } else {
      next.type = t;
      next.url = (server.url as string) ?? '';
      if (server.headers) next.headers = server.headers;
    }
    onChange(next);
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header style={{ background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>基本信息</div>
          {editing && (
            <button onClick={onRemove} style={dangerBtn}>移除此 server</button>
          )}
        </div>
        <Field label="name" hint="server 在 mcpServers 中的唯一键">
          {editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={renameDraft}
                onChange={e => setRenameDraft(e.target.value)}
                style={textInput(true)}
              />
              <button
                onClick={() => onRename(renameDraft.trim())}
                disabled={renameDraft === name || renameDraft.trim() === '' || existingNames.includes(renameDraft.trim())}
                style={smallBtn}
              >重命名</button>
            </div>
          ) : (
            <div className="mono" style={{ fontSize: 12.5 }}>{name}</div>
          )}
        </Field>
        <Field label="transport" hint="stdio / sse / http">
          {editing ? (
            <div style={{ display: 'inline-flex', background: 'var(--cc-bg-sunk)', borderRadius: 8, padding: 3, gap: 2 }}>
              {(['stdio', 'sse', 'http'] as McpTransport[]).map(t => (
                <div key={t} onClick={() => setTransport(t)} style={{
                  cursor: 'pointer', padding: '4px 12px', borderRadius: 6, fontSize: 11.5,
                  fontWeight: transport === t ? 500 : 400,
                  background: transport === t ? 'var(--cc-bg-raised)' : 'transparent',
                  color: transport === t ? 'var(--cc-ink)' : 'var(--cc-muted)',
                }}>{t}</div>
              ))}
            </div>
          ) : (
            <span className="mono" style={{ fontSize: 12.5, textTransform: 'uppercase' }}>{transport}</span>
          )}
        </Field>
      </header>

      {transport === 'stdio' ? (
        <StdioFields server={server} editing={editing} onChange={onChange} />
      ) : (
        <RemoteFields server={server} editing={editing} onChange={onChange} transport={transport} />
      )}
    </div>
  );
}

function StdioFields({ server, editing, onChange }: { server: Record<string, unknown>; editing: boolean; onChange: (p: Record<string, unknown>) => void }) {
  const command = typeof server.command === 'string' ? server.command : '';
  const args = Array.isArray(server.args) ? (server.args as unknown[]).map(a => String(a)) : [];
  const env = (server.env && typeof server.env === 'object' && !Array.isArray(server.env))
    ? (server.env as Record<string, string>) : {};

  const updateArgs = (next: string[]) => onChange({ ...server, args: next.length ? next : undefined });
  const updateEnv = (next: Record<string, string>) => onChange({ ...server, env: Object.keys(next).length ? next : undefined });

  return (
    <section style={card}>
      <div style={cardTitle}>stdio · 子进程参数</div>
      <Field label="command" hint="可执行文件或命令名（npx / node / python ...）">
        <input
          value={command}
          disabled={!editing}
          placeholder="npx"
          onChange={e => onChange({ ...server, command: e.target.value })}
          style={textInput(editing)}
        />
      </Field>
      <Field label="args" hint="一行一个参数">
        <ListEditor value={args} editing={editing} placeholder="-y" onChange={updateArgs} />
      </Field>
      <Field label="env" hint="子进程额外的环境变量">
        <KvEditor value={env} editing={editing} onChange={updateEnv} sensitive />
      </Field>
    </section>
  );
}

function RemoteFields({ server, editing, onChange, transport }: { server: Record<string, unknown>; editing: boolean; onChange: (p: Record<string, unknown>) => void; transport: McpTransport }) {
  const url = typeof server.url === 'string' ? server.url : '';
  const headers = (server.headers && typeof server.headers === 'object' && !Array.isArray(server.headers))
    ? (server.headers as Record<string, string>) : {};
  const updateHeaders = (next: Record<string, string>) => onChange({ ...server, headers: Object.keys(next).length ? next : undefined });

  return (
    <section style={card}>
      <div style={cardTitle}>{transport} · 远程端点</div>
      <Field label="url" hint={transport === 'sse' ? 'SSE 端点（流式）' : 'HTTP 端点（streamable-http）'}>
        <input
          value={url}
          disabled={!editing}
          placeholder="https://mcp.example.com/mcp"
          onChange={e => onChange({ ...server, url: e.target.value })}
          style={textInput(editing)}
        />
      </Field>
      <Field label="headers" hint="附加 HTTP 头（如 Authorization: Bearer ...）">
        <KvEditor value={headers} editing={editing} onChange={updateHeaders} sensitive />
      </Field>
    </section>
  );
}

// ----- primitives -----

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'start', marginBottom: 12 }}>
      <div>
        <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--cc-muted)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ListEditor({ value, editing, placeholder, onChange }: { value: string[]; editing: boolean; placeholder?: string; onChange: (next: string[]) => void }) {
  const set = (i: number, v: string) => onChange(value.map((x, idx) => idx === i ? v : x));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, '']);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {value.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input value={v} disabled={!editing} placeholder={placeholder} onChange={e => set(i, e.target.value)} style={textInput(editing)} />
          {editing && <button onClick={() => remove(i)} style={smallBtn}>×</button>}
        </div>
      ))}
      {editing && <button onClick={add} style={{ ...smallBtn, color: 'var(--cc-orange-deep)', justifySelf: 'start' }}>＋ 新增</button>}
    </div>
  );
}

const SENSITIVE = /(KEY|TOKEN|SECRET|PASSWORD|PASS|PWD|AUTH)/i;

function KvEditor({ value, editing, onChange, sensitive }: { value: Record<string, string>; editing: boolean; onChange: (next: Record<string, string>) => void; sensitive?: boolean }) {
  const entries = Object.entries(value);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const rename = (oldKey: string, newKey: string) => {
    if (!newKey || newKey === oldKey) return;
    const next: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (k === oldKey) next[newKey] = v;
      else next[k] = v;
    }
    onChange(next);
  };
  const setVal = (k: string, v: string) => onChange({ ...value, [k]: v });
  const remove = (k: string) => {
    const next = { ...value };
    delete next[k];
    onChange(next);
  };
  const add = () => {
    let key = 'KEY';
    let i = 1;
    while (key in value) key = `KEY_${i++}`;
    onChange({ ...value, [key]: '' });
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {entries.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', fontStyle: 'italic' }}>无</div>}
      {entries.map(([k, v]) => {
        const isSensitive = sensitive && SENSITIVE.test(k);
        const show = revealed[k] || !isSensitive;
        return (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 6 }}>
            <input value={k} disabled={!editing} onChange={e => rename(k, e.target.value)} style={textInput(editing)} />
            <input
              value={show ? v : (v ? '•'.repeat(Math.min(v.length, 12)) : '')}
              disabled={!editing || !show}
              onChange={e => setVal(k, e.target.value)}
              style={textInput(editing)}
            />
            {isSensitive ? (
              <button onClick={() => setRevealed(r => ({ ...r, [k]: !r[k] }))} style={smallBtn}>{show ? '隐藏' : '显示'}</button>
            ) : <span style={{ width: 48 }} />}
            {editing ? <button onClick={() => remove(k)} style={smallBtn}>×</button> : <span style={{ width: 32 }} />}
          </div>
        );
      })}
      {editing && <button onClick={add} style={{ ...smallBtn, color: 'var(--cc-orange-deep)', justifySelf: 'start' }}>＋ 新增</button>}
    </div>
  );
}

function textInput(editing: boolean): React.CSSProperties {
  return {
    width: '100%', height: 30, borderRadius: 6,
    border: '1px solid var(--cc-line-strong)',
    background: editing ? 'var(--cc-bg)' : 'var(--cc-bg-sunk)',
    padding: '0 10px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
    color: 'var(--cc-ink)',
  };
}

const card: React.CSSProperties = { background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 12, padding: '16px 20px' };
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 12 };
const smallBtn: React.CSSProperties = { height: 30, padding: '0 10px', borderRadius: 6, background: 'transparent', border: '1px solid var(--cc-line-strong)', cursor: 'pointer', fontSize: 11.5, color: 'var(--cc-ink-soft)', fontFamily: 'inherit' };
const dangerBtn: React.CSSProperties = { ...smallBtn, color: '#B8543A', borderColor: '#EDD6C5' };
