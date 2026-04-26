import { useMemo, useState } from 'react';
import { detectTransport, McpTransport } from '../../lib/mcp-schema';
import { McpServerForm } from './McpServerForm';

interface Props {
  jsonText: string;
  editing: boolean;
  onChange: (next: string) => void;
}

export function McpVisual({ jsonText, editing, onChange }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const parsed = useMemo(() => safeParse(jsonText), [jsonText]);
  const servers: Record<string, Record<string, unknown>> = useMemo(() => {
    if (!parsed.ok) return {};
    const ms = (parsed.value as Record<string, unknown>).mcpServers;
    if (ms && typeof ms === 'object' && !Array.isArray(ms)) {
      return ms as Record<string, Record<string, unknown>>;
    }
    return {};
  }, [parsed]);

  const names = Object.keys(servers);
  const activeName = selected && names.includes(selected) ? selected : names[0] || null;
  const active = activeName ? servers[activeName] : null;

  const writeServers = (next: Record<string, Record<string, unknown>>) => {
    const base = parsed.ok ? { ...(parsed.value as Record<string, unknown>) } : {};
    base.mcpServers = next;
    onChange(JSON.stringify(base, null, 2) + '\n');
  };

  const updateServer = (name: string, patch: Record<string, unknown>) => {
    writeServers({ ...servers, [name]: patch });
  };
  const renameServer = (oldName: string, newName: string) => {
    if (!newName || newName === oldName || newName in servers) return;
    const next: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of Object.entries(servers)) {
      if (k === oldName) next[newName] = v;
      else next[k] = v;
    }
    writeServers(next);
    setSelected(newName);
  };
  const removeServer = (name: string) => {
    const next = { ...servers };
    delete next[name];
    writeServers(next);
    if (selected === name) setSelected(null);
  };
  const addServer = (transport: McpTransport) => {
    let name = `new-server`;
    let i = 1;
    while (name in servers) name = `new-server-${i++}`;
    const tpl: Record<string, unknown> = transport === 'stdio'
      ? { command: '' }
      : { type: transport, url: '' };
    writeServers({ ...servers, [name]: tpl });
    setSelected(name);
  };

  if (!parsed.ok) {
    return (
      <div style={{
        background: '#FFF9F3', border: '1px solid #EDD6C5', borderRadius: 10,
        padding: '14px 18px', fontSize: 12.5, color: 'var(--cc-orange-deep)',
      }}>
        无法以可视化方式打开：<span className="mono">{parsed.error}</span>
        <div style={{ marginTop: 6, color: 'var(--cc-ink-soft)' }}>请切换到「源文件」标签修复 JSON 后再回到此处。</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
      <aside style={{ background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cc-line)', fontSize: 11, color: 'var(--cc-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          MCP Servers · {names.length}
        </div>
        {names.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--cc-muted)', fontStyle: 'italic' }}>暂无服务器</div>
        )}
        {names.map(n => {
          const t = detectTransport(servers[n]);
          const isActive = n === activeName;
          return (
            <div key={n} onClick={() => setSelected(n)} style={{
              cursor: 'pointer', padding: '10px 14px', borderBottom: '1px solid var(--cc-line)',
              background: isActive ? 'var(--cc-orange-wash)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--cc-orange)' : '2px solid transparent',
              paddingLeft: isActive ? 12 : 14,
            }}>
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? 'var(--cc-orange-deep)' : 'var(--cc-ink)' }}>{n}</div>
              <div style={{ fontSize: 10.5, color: 'var(--cc-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t}</div>
            </div>
          );
        })}
        {editing && (
          <div style={{ padding: 12, display: 'grid', gap: 6 }}>
            <button onClick={() => addServer('stdio')} style={addBtn}>＋ stdio</button>
            <button onClick={() => addServer('http')} style={addBtn}>＋ http</button>
            <button onClick={() => addServer('sse')} style={addBtn}>＋ sse</button>
          </div>
        )}
      </aside>

      {active && activeName ? (
        <McpServerForm
          name={activeName}
          server={active}
          editing={editing}
          onRename={newName => renameServer(activeName, newName)}
          onChange={patch => updateServer(activeName, patch)}
          onRemove={() => removeServer(activeName)}
          existingNames={names.filter(n => n !== activeName)}
        />
      ) : (
        <div style={{
          background: 'var(--cc-bg-raised)', border: '1px dashed var(--cc-line-strong)',
          borderRadius: 12, padding: 32, textAlign: 'center', fontSize: 12.5, color: 'var(--cc-muted)',
        }}>
          {editing ? '左侧选择或新增一个 MCP server。' : '没有可显示的 MCP server。'}
        </div>
      )}
    </div>
  );
}

function safeParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: text.trim() === '' ? { mcpServers: {} } : JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const addBtn: React.CSSProperties = {
  height: 28, borderRadius: 6, fontSize: 11.5,
  background: 'var(--cc-bg-sunk)', border: '1px solid var(--cc-line-strong)',
  cursor: 'pointer', color: 'var(--cc-ink-soft)', fontFamily: 'inherit',
};
