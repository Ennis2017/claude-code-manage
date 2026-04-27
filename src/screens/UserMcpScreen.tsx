import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Rail } from '../components/Rail';
import { Topbar } from '../components/Topbar';
import { CodeEditor } from '../components/CodeEditor';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { readUserMcpServers, writeUserMcpServers, revealInFinder, getUserClaudeDir } from '../lib/fs-bridge';
import { McpVisual } from './mcp/McpVisual';
import { McpIntro } from './mcp/McpIntro';
import { validateMcpJsonText } from '../lib/mcp-schema';

interface Props {
  sidebar?: ReactNode;
  crumbs: { label: string; onClick?: () => void }[];
  embedded?: boolean;
}

type Tab = 'intro' | 'visual' | 'source';

const SCOPE_PATH = '~/.claude.json · mcpServers';

export function UserMcpScreen({ sidebar, crumbs, embedded }: Props) {
  const { toast_msg } = useAppStore();
  const { scanAll } = useConfigStore();

  const [tab, setTab] = useState<Tab>('visual');
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(true);
  const [baseline, setBaseline] = useState('');
  const [draft, setDraft] = useState('');
  const [mtime, setMtime] = useState('');
  const [size, setSize] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filePath, setFilePath] = useState('~/.claude.json');

  const reload = async () => {
    try {
      const meta = await readUserMcpServers();
      setExists(meta.exists);
      setBaseline(meta.content);
      setDraft(meta.content);
      setMtime(meta.mtime);
      setSize(meta.size_bytes);
      setLoaded(true);
    } catch (e) {
      toast_msg(`读取 ~/.claude.json 失败：${String(e)}`, 'error');
      setLoaded(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dir = await getUserClaudeDir().catch(() => '~/.claude');
      if (cancelled) return;
      const home = dir.replace(/\/\.claude$/, '');
      setFilePath(`${home}/.claude.json`);
      await reload();
    })();
    return () => { cancelled = true; };
  }, []);

  const validation = useMemo(() => validateMcpJsonText(editing ? draft : baseline), [editing ? draft : baseline]);
  const dirty = editing && draft !== baseline;
  const serverCount = useMemo(() => {
    if (!validation.ok) return 0;
    const ms = (validation.value as { mcpServers?: Record<string, unknown> })?.mcpServers;
    return ms ? Object.keys(ms).length : 0;
  }, [validation]);

  const enterEdit = () => { setDraft(baseline); setEditing(true); };
  const cancelEdit = () => { setDraft(baseline); setEditing(false); };

  const doSave = async () => {
    setSaving(true);
    try {
      const result = await writeUserMcpServers(draft, exists ? mtime : null);
      setBaseline(draft);
      setMtime(result.mtime);
      setSize(result.size_bytes);
      setExists(true);
      setEditing(false);
      toast_msg('已保存 · 用户级 MCP', 'success');
      scanAll();
    } catch (e) {
      const msg = String(e);
      if (msg.includes('编辑期间被修改')) {
        toast_msg('~/.claude.json 已被外部修改，请刷新后重试', 'error');
      } else {
        toast_msg(`保存失败：${msg}`, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const onReveal = async () => {
    try { await revealInFinder(filePath); } catch (e) { toast_msg(`无法打开 Finder：${String(e)}`, 'error'); }
  };

  const tabToggle = (
    <div style={{ display: 'inline-flex', background: 'var(--cc-bg-sunk)', borderRadius: 8, padding: 3, gap: 2 }}>
      {([['intro', '介绍'], ['visual', '可视化'], ['source', '源文件']] as [Tab, string][]).map(([id, label]) => (
        <div key={id} onClick={() => setTab(id)} style={{
          cursor: 'pointer', padding: '4px 12px', borderRadius: 6, fontSize: 11.5,
          fontWeight: tab === id ? 500 : 400,
          background: tab === id ? 'var(--cc-bg-raised)' : 'transparent',
          color: tab === id ? 'var(--cc-ink)' : 'var(--cc-muted)',
        }}>{label}</div>
      ))}
    </div>
  );

  const inner = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
        {editing ? (
          <div style={{ height: 52, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF4EC', borderBottom: '1px solid #EDD6C5', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, background: 'var(--cc-orange)', color: 'white', fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                <span>编辑中</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--cc-ink-soft)' }}>
                用户级 MCP {dirty && <span style={{ color: 'var(--cc-orange-deep)', fontWeight: 500 }}>· 未保存</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {tabToggle}
              <button className="cc-btn ghost" onClick={cancelEdit} disabled={saving}>取消</button>
              <button
                className="cc-btn primary"
                onClick={doSave}
                disabled={saving || !dirty || !validation.ok}
                title={!validation.ok ? 'JSON 或 schema 有错误，请修复' : undefined}
              >{saving ? '保存中…' : '保存'}</button>
            </div>
          </div>
        ) : (
          <Topbar
            crumbs={crumbs}
            right={
              <>
                <div style={{ fontSize: 11, color: 'var(--cc-muted)', display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: exists ? 'var(--cc-muted-soft)' : 'var(--cc-orange)' }} />
                  <span>{exists ? '只读' : '未创建'}</span>
                </div>
                {tabToggle}
                <button className="cc-btn ghost" onClick={onReveal} disabled={!exists}>在 Finder 中显示</button>
                <button className="cc-btn primary" onClick={enterEdit}>✎ 编辑</button>
              </>
            }
          />
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>用户级 MCP</h1>
              <span className="cc-chip orange" style={{ height: 20 }}>{SCOPE_PATH}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span className="mono">{filePath}</span>
              <span>· {serverCount} 个 server · {(size / 1024).toFixed(1)} KB · 修改于 {mtime || '—'}</span>
              {!validation.ok && <span style={{ color: 'var(--cc-orange-deep)' }}>· {validation.parseError ? 'JSON 解析失败' : `Schema 错误 ${validation.issues.length}`}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--cc-muted-soft)', marginTop: 6 }}>
              仅编辑 mcpServers 段，~/.claude.json 中的其他字段会原样保留。
            </div>
          </div>

          {!loaded ? (
            <div style={{ fontSize: 12, color: 'var(--cc-muted)' }}>读取中…</div>
          ) : tab === 'intro' ? (
            <McpIntro exists={exists} filePath={filePath} />
          ) : tab === 'visual' ? (
            <McpVisual
              jsonText={editing ? draft : baseline}
              editing={editing}
              onChange={next => setDraft(next)}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', minHeight: 420 }}>
              <CodeEditor
                value={editing ? draft : baseline}
                onChange={editing ? setDraft : undefined}
                language="json"
                readOnly={!editing}
              />
            </div>
          )}
        </div>
    </div>
  );

  if (embedded) return inner;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
      <Rail active="user" />
      {sidebar}
      {inner}
    </div>
  );
}
