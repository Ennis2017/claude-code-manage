import { ReactNode, useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { Rail } from '../components/Rail';
import { Topbar } from '../components/Topbar';
import { SettingsScreen } from './Settings';
import { GlobalMemoryScreen } from './MemoryScreen';
import { KeybindingsScreen } from './KeybindingsScreen';
import { HooksScreen } from './HooksScreen';
import { PermissionsScreen } from './PermissionsScreen';
import { UserMcpScreen } from './UserMcpScreen';
import { EntryDetailScreen } from './EntryDetailScreen';
import { SkillDetailScreen } from './SkillDetailScreen';
import { NewEntryDialog, EntryKind } from '../components/NewEntryDialog';
import { revealInFinder, createFile, createDir } from '../lib/fs-bridge';
import { commandTemplate, agentTemplate, skillTemplate } from '../lib/entry-templates';
import { TabbedConfigShell } from '../components/workspace/TabbedConfigShell';
import {
  InnerEntry, ScopeId, TabContent, useWorkspaceStore,
} from '../store/workspace-store';

const SCOPE: ScopeId = 'user';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** route.screen / route.cmd → InnerEntry */
function routeToInnerEntry(screen: string | undefined, cmd: string | undefined): InnerEntry {
  if (!screen || screen === 'overview') return { entry: 'overview' };
  if (screen === 'settings') return { entry: 'settings' };
  if (screen === 'permissions') return { entry: 'permissions' };
  if (screen === 'hooks') return { entry: 'hooks' };
  if (screen === 'usermcp') return { entry: 'mcp' };
  if (screen === 'memory') return { entry: 'memory' };
  if (screen === 'keybindings') return { entry: 'keybindings' };
  if (screen === 'command' && cmd) return { entry: 'command', name: cmd };
  if (screen === 'skill' && cmd) return { entry: 'skill', name: cmd };
  if (screen === 'agent' && cmd) return { entry: 'agent', name: cmd };
  if (screen === 'rule' && cmd) return { entry: 'rule', name: cmd };
  return { entry: 'overview' };
}

export function GlobalConfig() {
  const { route, go, toast_msg } = useAppStore();
  const { snapshot, userClaudeDir, scanAll } = useConfigStore();
  const uc = snapshot?.user_config;

  const setActiveTabContent = useWorkspaceStore(s => s.setActiveTabContent);
  const plusOpen = useWorkspaceStore(s => s.plusOpen);

  const [newKind, setNewKind] = useState<EntryKind | null>(null);

  // route.screen 变化（如从 Dashboard 卡片跳转）→ 同步到当前 active tab
  useEffect(() => {
    if (route.name !== 'global') return;
    if (!route.screen) return;
    const next: TabContent = { kind: 'inner', inner: routeToInnerEntry(route.screen, route.cmd) };
    setActiveTabContent(SCOPE, next);
  }, [route.screen, route.cmd, route.name, setActiveTabContent]);

  const commands = uc?.commands || [];
  const skills = uc?.skills || [];
  const agents = uc?.agents || [];
  const rules = uc?.rules || [];

  const handleCreate = async (kind: EntryKind, name: string) => {
    if (!userClaudeDir) throw new Error('未获取到 ~/.claude 路径');
    const base = userClaudeDir;
    if (kind === 'command') {
      await createFile(`${base}/commands/${name}.md`, commandTemplate(name));
    } else if (kind === 'agent') {
      await createFile(`${base}/agents/${name}.md`, agentTemplate(name));
    } else {
      await createDir(`${base}/skills/${name}`);
      await createFile(`${base}/skills/${name}/SKILL.md`, skillTemplate(name));
    }
    await scanAll();
    toast_msg(`已创建 ${name}`, 'success');
    if (kind === 'command') setActiveTabContent(SCOPE, { kind: 'inner', inner: { entry: 'command', name } });
    if (kind === 'agent') setActiveTabContent(SCOPE, { kind: 'inner', inner: { entry: 'agent', name } });
    if (kind === 'skill') setActiveTabContent(SCOPE, { kind: 'inner', inner: { entry: 'skill', name } });
  };

  const settingsFieldCount = uc?.settings?.raw ? Object.keys(uc.settings.raw as object).length : 0;
  const memorySize = uc?.memory ? formatBytes(uc.memory.size_bytes) : '未找到';
  const settingsRawObj = (uc?.settings?.raw as Record<string, unknown> | undefined) || {};
  const hooksField = settingsRawObj.hooks as Record<string, Array<{ hooks?: unknown[] }>> | undefined;
  const hookCount = hooksField && typeof hooksField === 'object'
    ? Object.values(hooksField).reduce((s, arr) => s + (Array.isArray(arr) ? arr.reduce((ss: number, g) => ss + ((g as { hooks?: unknown[] }).hooks?.length || 0), 0) : 0), 0)
    : 0;
  const permsField = settingsRawObj.permissions as { allow?: string[]; deny?: string[]; ask?: string[] } | undefined;
  const permCount = (permsField?.allow?.length || 0) + (permsField?.deny?.length || 0) + (permsField?.ask?.length || 0);
  const userMcpCount = uc?.mcp?.server_count || 0;

  const sidebarSections = [
    { label: null, items: [{ id: 'overview', label: '概览', icon: '◆' }] },
    {
      label: '配置',
      items: [
        { id: 'settings', label: 'settings.json', icon: '{}', count: settingsFieldCount > 0 ? `${settingsFieldCount}` : undefined },
        { id: 'permissions', label: 'Permissions', icon: 'P', count: permCount > 0 ? `${permCount}` : undefined },
        { id: 'hooks', label: 'Hooks', icon: 'H', count: hookCount > 0 ? `${hookCount}` : undefined },
        { id: 'usermcp', label: 'MCP', icon: 'MC', count: userMcpCount > 0 ? `${userMcpCount}` : undefined },
        { id: 'keybindings', label: 'keybindings.json', icon: '⌨' },
        { id: 'memory', label: 'CLAUDE.md', icon: 'M', count: uc?.memory ? memorySize : undefined },
      ],
    },
    { label: '命令', addable: true, onAdd: () => setNewKind('command'), items: commands.map(c => ({ id: `cmd-${c.name}`, label: `/${c.name}`, icon: '/' })) },
    { label: 'Skills', addable: true, onAdd: () => setNewKind('skill'), items: skills.map(s => ({ id: `skill-${s.name}`, label: s.name, icon: 'S', count: `${s.file_count}` })) },
    { label: 'Agents', addable: true, onAdd: () => setNewKind('agent'), items: agents.map(a => ({ id: `agent-${a.name}`, label: a.name, icon: 'A' })) },
    { label: 'Rules', items: rules.map(r => ({ id: `rule-${r.name}`, label: r.name, icon: 'R' })) },
  ];

  const pickToInner = (id: string): InnerEntry => {
    if (id === 'overview') return { entry: 'overview' };
    if (id === 'settings') return { entry: 'settings' };
    if (id === 'permissions') return { entry: 'permissions' };
    if (id === 'hooks') return { entry: 'hooks' };
    if (id === 'usermcp') return { entry: 'mcp' };
    if (id === 'memory') return { entry: 'memory' };
    if (id === 'keybindings') return { entry: 'keybindings' };
    if (id.startsWith('cmd-')) return { entry: 'command', name: id.slice(4) };
    if (id.startsWith('skill-')) return { entry: 'skill', name: id.slice(6) };
    if (id.startsWith('agent-')) return { entry: 'agent', name: id.slice(6) };
    if (id.startsWith('rule-')) return { entry: 'rule', name: id.slice(5) };
    return { entry: 'overview' };
  };

  const contentToActiveId = (content: TabContent | undefined): string => {
    if (!content || content.kind === 'file') return '';
    const e = content.inner;
    if (e.entry === 'command') return `cmd-${e.name}`;
    if (e.entry === 'skill') return `skill-${e.name}`;
    if (e.entry === 'agent') return `agent-${e.name}`;
    if (e.entry === 'rule') return `rule-${e.name}`;
    if (e.entry === 'mcp') return 'usermcp';
    return e.entry;
  };

  const tabTitleForInner = (e: InnerEntry): string => {
    if (e.entry === 'overview') return '概览';
    if (e.entry === 'settings') return 'settings.json';
    if (e.entry === 'local') return 'settings.local.json';
    if (e.entry === 'permissions') return 'Permissions';
    if (e.entry === 'hooks') return 'Hooks';
    if (e.entry === 'mcp') return 'MCP';
    if (e.entry === 'keybindings') return 'keybindings.json';
    if (e.entry === 'memory') return 'CLAUDE.md';
    if (e.entry === 'command') return `/${e.name}`;
    return e.name;
  };

  const renderInner = (inner: InnerEntry): ReactNode => (
    <InnerEntryView
      inner={inner}
      commands={commands}
      skills={skills}
      agents={agents}
      rules={rules}
      userClaudeDir={userClaudeDir || ''}
      uc={uc}
      toast_msg={toast_msg}
      go={go}
      setNewKind={setNewKind}
    />
  );

  return (
    <>
      <TabbedConfigShell
        scopeId={SCOPE}
        rail={<Rail active="user" />}
        sidebarSections={sidebarSections}
        initialFallback={{ kind: 'inner', inner: routeToInnerEntry(route.screen, route.cmd) }}
        contentToActiveId={contentToActiveId}
        pickToInner={pickToInner}
        renderInner={renderInner}
        tabTitleForInner={tabTitleForInner}
        onPlus={() => {
          plusOpen(SCOPE);
          if (route.screen !== 'overview') {
            go({ name: 'global', screen: 'overview' });
          }
        }}
      />
      {newKind && (
        <NewEntryDialog
          kind={newKind}
          scopeLabel={userClaudeDir || '~/.claude'}
          onClose={() => setNewKind(null)}
          onConfirm={async (name) => { await handleCreate(newKind, name); }}
        />
      )}
    </>
  );
}

/* ─────────── Inner entry 渲染 ─────────── */

interface InnerEntryViewProps {
  inner: InnerEntry;
  commands: { name: string; description: string; mtime: string; source_path: string }[];
  skills: { name: string; description: string; mtime: string; source_path: string; file_count: number }[];
  agents: { name: string; description: string; mtime: string; source_path: string }[];
  rules: { name: string; source_path: string; mtime: string }[];
  userClaudeDir: string;
  uc: ReturnType<typeof useConfigStore.getState>['snapshot'] extends infer T
    ? T extends { user_config: infer U } ? U : undefined : undefined;
  toast_msg: (msg: string, tone?: 'info' | 'success' | 'error') => void;
  go: (route: { name: 'global'; screen?: string; cmd?: string }) => void;
  setNewKind: (k: EntryKind | null) => void;
}

function InnerEntryView(p: InnerEntryViewProps) {
  const e = p.inner;
  const file = p.uc?.settings;
  const filePath = file?.source_path || `${p.userClaudeDir || '~/.claude'}/settings.json`;
  const settingsRaw = (file?.raw as Record<string, unknown>) || {};
  const settingsMtime = file?.mtime || '';
  const settingsSize = file?.size_bytes || 0;

  const baseCrumbs = (label: string) => [
    { label: '全局配置' },
    { label },
  ];

  const setActive = useWorkspaceStore(s => s.setActiveTabContent);

  if (e.entry === 'overview') {
    return (
      <OverviewView
        uc={p.uc}
        commands={p.commands}
        skills={p.skills}
        agents={p.agents}
        toast_msg={p.toast_msg}
        setNewKind={p.setNewKind}
        onJump={(content) => setActive(SCOPE, content)}
      />
    );
  }

  if (e.entry === 'settings') {
    return (
      <SettingsScreen embedded sidebar={null} />
    );
  }

  if (e.entry === 'permissions') {
    return (
      <PermissionsScreen
        embedded
        railKey="user"
        crumbs={baseCrumbs('Permissions')}
        scopeChip={{ label: '用户级 · settings.json', tone: 'orange' }}
        filePath={filePath}
        settingsRaw={settingsRaw}
        initialMtime={settingsMtime}
        sizeBytes={settingsSize}
      />
    );
  }

  if (e.entry === 'hooks') {
    return (
      <HooksScreen
        embedded
        railKey="user"
        crumbs={baseCrumbs('Hooks')}
        scopeChip={{ label: '用户级 · settings.json', tone: 'orange' }}
        filePath={filePath}
        settingsRaw={settingsRaw}
        initialMtime={settingsMtime}
        sizeBytes={settingsSize}
      />
    );
  }

  if (e.entry === 'mcp') {
    return (
      <UserMcpScreen embedded crumbs={baseCrumbs('用户级 MCP')} />
    );
  }

  if (e.entry === 'memory') {
    return <GlobalMemoryScreen embedded sidebar={null} />;
  }

  if (e.entry === 'keybindings') {
    return <KeybindingsScreen embedded sidebar={null} />;
  }

  if (e.entry === 'command' || e.entry === 'agent' || e.entry === 'rule') {
    const list = e.entry === 'command' ? p.commands : e.entry === 'agent' ? p.agents : p.rules;
    const item = list.find(x => x.name === e.name);
    if (!item) return <MissingView label={e.name} onBack={() => setActive(SCOPE, { kind: 'inner', inner: { entry: 'overview' } })} />;
    const tone: 'orange' | 'plum' | 'sky' = e.entry === 'command' ? 'orange' : e.entry === 'agent' ? 'plum' : 'sky';
    const scopeLabel = e.entry === 'command' ? '用户级 · 命令' : e.entry === 'agent' ? '用户级 · Agent' : '用户级 · Rule';
    const desc = (item as { description?: string }).description || '';
    const sizeBytes = (item as { size_bytes?: number }).size_bytes || 0;
    return (
      <EntryDetailScreen
        embedded
        railKey="user"
        crumbs={[
          { label: '全局配置' },
          { label: e.entry === 'command' ? '命令' : e.entry === 'agent' ? 'Agents' : 'Rules' },
          { label: e.entry === 'command' ? `/${item.name}` : item.name },
        ]}
        title={e.entry === 'command' ? `/${item.name}` : item.name}
        scopeChip={{ label: scopeLabel, tone }}
        filePath={item.source_path}
        initialMtime={item.mtime}
        sizeBytes={sizeBytes || desc.length}
        onDeleted={() => setActive(SCOPE, { kind: 'inner', inner: { entry: 'overview' } })}
      />
    );
  }

  if (e.entry === 'skill') {
    const item = p.skills.find(x => x.name === e.name);
    if (!item) return <MissingView label={e.name} onBack={() => setActive(SCOPE, { kind: 'inner', inner: { entry: 'overview' } })} />;
    return (
      <SkillDetailScreen
        embedded
        railKey="user"
        crumbs={[{ label: '全局配置' }, { label: 'Skills' }, { label: item.name }]}
        title={item.name}
        skillDir={item.source_path}
        scopeChip={{ label: '用户级 · Skill', tone: 'leaf' }}
        onDeleted={() => setActive(SCOPE, { kind: 'inner', inner: { entry: 'overview' } })}
      />
    );
  }

  return null;
}

function MissingView({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--cc-muted)' }}>
      <div style={{ fontSize: 13 }}>未找到 <span className="mono">{label}</span></div>
      <button className="cc-btn ghost" onClick={onBack}>返回概览</button>
    </div>
  );
}

/* ─────────── 概览视图 ─────────── */

function OverviewView({
  uc, commands, skills, agents, toast_msg, setNewKind, onJump,
}: {
  uc: InnerEntryViewProps['uc'];
  commands: InnerEntryViewProps['commands'];
  skills: InnerEntryViewProps['skills'];
  agents: InnerEntryViewProps['agents'];
  toast_msg: InnerEntryViewProps['toast_msg'];
  setNewKind: (k: EntryKind | null) => void;
  onJump: (c: TabContent) => void;
}) {
  const settingsFieldCount = uc?.settings?.raw ? Object.keys(uc.settings.raw as object).length : 0;
  const memorySize = uc?.memory ? formatBytes(uc.memory.size_bytes) : '未找到';
  const keybindingsSize = uc?.keybindings ? formatBytes(uc.keybindings.size_bytes) : '未找到';
  const totalFiles = (uc?.settings ? 1 : 0) + (uc?.memory ? 1 : 0) + (uc?.keybindings ? 1 : 0) + commands.length + skills.length + agents.length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
      <Topbar
        crumbs={[{ label: '全局配置' }, { label: '概览' }]}
        right={
          <button className="cc-btn ghost" onClick={async () => {
            const anyPath = uc?.settings?.source_path || uc?.memory?.source_path || uc?.keybindings?.source_path;
            if (!anyPath) { toast_msg('未找到 ~/.claude 任何文件', 'error'); return; }
            try { await revealInFinder(anyPath); } catch (e) { toast_msg(`无法打开 Finder：${String(e)}`, 'error'); }
          }}>在 Finder 中显示</button>
        }
      />
      <div style={{ flex: 1, overflow: 'auto', padding: '26px 36px 36px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cc-muted)', fontWeight: 600, marginBottom: 6 }}>用户级 · 对所有项目生效</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>全局配置</h1>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--cc-muted)' }}>~/.claude · {totalFiles} 份文件</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { l: 'settings.json', v: settingsFieldCount > 0 ? `${settingsFieldCount} 字段` : '未找到', s: '权限 · 模型 · 环境变量', icon: '{}', color: 'orange', target: { entry: 'settings' as const } },
            { l: 'CLAUDE.md', v: memorySize, s: '用户级记忆 / 系统提示', icon: 'M', color: 'leaf', target: { entry: 'memory' as const } },
            { l: 'keybindings.json', v: keybindingsSize, s: '全局快捷键', icon: '⌨', color: 'sky', target: { entry: 'keybindings' as const } },
          ].map((x, i) => (
            <div key={i} onClick={() => onJump({ kind: 'inner', inner: x.target })} style={{
              cursor: 'pointer',
              background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)',
              borderRadius: 12, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div className="mono" style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: `var(--cc-${x.color}-wash)`,
                color: x.color === 'leaf' ? '#4A5B3D' : x.color === 'sky' ? '#3F5A6E' : 'var(--cc-orange-deep)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14,
              }}>{x.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{x.l}</div>
                <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', marginBottom: 8 }}>{x.s}</div>
                <div style={{ fontSize: 11, color: 'var(--cc-ink-soft)', fontWeight: 500 }}>{x.v}</div>
              </div>
            </div>
          ))}
        </div>

        {([
          { title: '命令', kind: 'command' as const, items: commands.map(c => ({ name: c.name, description: c.description, mtime: c.mtime })), path: '~/.claude/commands/', icon: '/' },
          { title: 'Skills', kind: 'skill' as const, items: skills.map(s => ({ name: s.name, description: s.description, mtime: s.mtime, badge: `${s.file_count} 文件` })), path: '~/.claude/skills/', icon: 'S' },
          { title: 'Agents', kind: 'agent' as const, items: agents.map(a => ({ name: a.name, description: a.description, mtime: a.mtime })), path: '~/.claude/agents/', icon: 'A' },
        ]).map(g => (
          <div key={g.title} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>{g.title} <span style={{ color: 'var(--cc-muted-soft)', fontWeight: 400, marginLeft: 4 }}>· {g.items.length}</span></h3>
                <span className="mono" style={{ fontSize: 11, color: 'var(--cc-muted)' }}>{g.path}</span>
              </div>
              <span
                style={{ fontSize: 11.5, color: 'var(--cc-orange-deep)', cursor: 'pointer' }}
                onClick={() => setNewKind(g.title === '命令' ? 'command' : g.title === 'Skills' ? 'skill' : 'agent')}
              >＋ 新建</span>
            </div>
            {g.items.length === 0 ? (
              <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--cc-muted)', fontStyle: 'italic' }}>暂无{g.title}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {g.items.map((it, i) => (
                  <div
                    key={i}
                    onClick={() => onJump({ kind: 'inner', inner: { entry: g.kind, name: it.name } })}
                    style={{ cursor: 'pointer', background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}
                  >
                    <div className="mono" style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--cc-bg-sunk)', color: 'var(--cc-ink-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, flexShrink: 0 }}>
                      {g.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.icon === '/' ? `/${it.name}` : it.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                        {it.description || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--cc-muted-soft)', display: 'flex', gap: 8 }}>
                        <span>{it.mtime}</span>
                        {(it as { badge?: string }).badge && <span>· {(it as { badge?: string }).badge}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
