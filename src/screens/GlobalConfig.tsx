import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { Rail } from '../components/Rail';
import { InnerSidebar } from '../components/InnerSidebar';
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GlobalConfig() {
  const { route, go, set, toast_msg, activeInnerId } = useAppStore();
  const { snapshot, userClaudeDir, scanAll } = useConfigStore();
  const uc = snapshot?.user_config;

  const commands = uc?.commands || [];
  const skills = uc?.skills || [];
  const agents = uc?.agents || [];

  const [newKind, setNewKind] = useState<EntryKind | null>(null);

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
    if (kind === 'command') go({ name: 'global', screen: 'command', cmd: name });
    if (kind === 'agent') go({ name: 'global', screen: 'agent', cmd: name });
    if (kind === 'skill') go({ name: 'global', screen: 'skill', cmd: name });
  };
  const settingsFieldCount = uc?.settings?.raw ? Object.keys(uc.settings.raw as object).length : 0;
  const memorySize = uc?.memory ? formatBytes(uc.memory.size_bytes) : '未找到';
  const keybindingsSize = uc?.keybindings ? formatBytes(uc.keybindings.size_bytes) : '未找到';
  const totalFiles = (uc?.settings ? 1 : 0) + (uc?.memory ? 1 : 0) + (uc?.keybindings ? 1 : 0) + commands.length + skills.length + agents.length;

  const screen = route.screen || 'overview';
  const activeId = screen === 'overview' ? 'overview'
    : screen === 'settings' ? 'settings'
    : screen === 'permissions' ? 'permissions'
    : screen === 'hooks' ? 'hooks'
    : screen === 'usermcp' ? 'usermcp'
    : screen === 'memory' ? 'memory'
    : screen === 'keybindings' ? 'keybindings'
    : screen === 'command' && route.cmd ? `cmd-${route.cmd}`
    : screen === 'skill' && route.cmd ? `skill-${route.cmd}`
    : screen === 'agent' && route.cmd ? `agent-${route.cmd}`
    : screen === 'rule' && route.cmd ? `rule-${route.cmd}`
    : activeInnerId;

  const settingsRawObj = (uc?.settings?.raw as Record<string, unknown> | undefined) || {};
  const hooksField = settingsRawObj.hooks as Record<string, Array<{ hooks?: unknown[] }>> | undefined;
  const hookCount = hooksField && typeof hooksField === 'object'
    ? Object.values(hooksField).reduce((s, arr) => s + (Array.isArray(arr) ? arr.reduce((ss: number, g) => ss + ((g as { hooks?: unknown[] }).hooks?.length || 0), 0) : 0), 0)
    : 0;
  const permsField = settingsRawObj.permissions as { allow?: string[]; deny?: string[]; ask?: string[] } | undefined;
  const permCount = (permsField?.allow?.length || 0) + (permsField?.deny?.length || 0) + (permsField?.ask?.length || 0);
  const userMcpCount = uc?.mcp?.server_count || 0;
  const rules = uc?.rules || [];

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

  const sidebar = (
    <InnerSidebar
      sections={sidebarSections}
      activeId={activeId}
      onPick={(it) => {
        if (it.id === 'overview') go({ name: 'global', screen: 'overview' });
        else if (it.id === 'settings') go({ name: 'global', screen: 'settings' });
        else if (it.id === 'permissions') go({ name: 'global', screen: 'permissions' });
        else if (it.id === 'hooks') go({ name: 'global', screen: 'hooks' });
        else if (it.id === 'usermcp') go({ name: 'global', screen: 'usermcp' });
        else if (it.id === 'memory') go({ name: 'global', screen: 'memory' });
        else if (it.id === 'keybindings') go({ name: 'global', screen: 'keybindings' });
        else if (it.id.startsWith('cmd-')) go({ name: 'global', screen: 'command', cmd: it.id.slice(4) });
        else if (it.id.startsWith('skill-')) go({ name: 'global', screen: 'skill', cmd: it.id.slice(6) });
        else if (it.id.startsWith('agent-')) go({ name: 'global', screen: 'agent', cmd: it.id.slice(6) });
        else if (it.id.startsWith('rule-')) go({ name: 'global', screen: 'rule', cmd: it.id.slice(5) });
        else set({ activeInnerId: it.id });
      }}
    />
  );

  if (screen === 'settings') return <SettingsScreen sidebar={sidebar} />;
  if (screen === 'memory') return <GlobalMemoryScreen sidebar={sidebar} />;
  if (screen === 'keybindings') return <KeybindingsScreen sidebar={sidebar} />;

  if (screen === 'hooks') {
    const file = uc?.settings;
    const filePath = file?.source_path || `${userClaudeDir || '~/.claude'}/settings.json`;
    return (
      <HooksScreen
        sidebar={sidebar}
        railKey="user"
        crumbs={[
          { label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: 'Hooks' },
        ]}
        scopeChip={{ label: '用户级 · settings.json', tone: 'orange' }}
        filePath={filePath}
        settingsRaw={(file?.raw as Record<string, unknown>) || {}}
        initialMtime={file?.mtime || ''}
        sizeBytes={file?.size_bytes || 0}
      />
    );
  }

  if (screen === 'permissions') {
    const file = uc?.settings;
    const filePath = file?.source_path || `${userClaudeDir || '~/.claude'}/settings.json`;
    return (
      <PermissionsScreen
        sidebar={sidebar}
        railKey="user"
        crumbs={[
          { label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: 'Permissions' },
        ]}
        scopeChip={{ label: '用户级 · settings.json', tone: 'orange' }}
        filePath={filePath}
        settingsRaw={(file?.raw as Record<string, unknown>) || {}}
        initialMtime={file?.mtime || ''}
        sizeBytes={file?.size_bytes || 0}
      />
    );
  }

  if (screen === 'usermcp') {
    return (
      <UserMcpScreen
        sidebar={sidebar}
        crumbs={[
          { label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: '用户级 MCP' },
        ]}
      />
    );
  }

  if (screen === 'rule' && route.cmd) {
    const r = rules.find(x => x.name === route.cmd) as { name: string; source_path: string; mtime: string } | undefined;
    if (!r) return <MissingEntryView sidebar={sidebar} onBack={() => go({ name: 'global', screen: 'overview' })} label={route.cmd} />;
    return (
      <EntryDetailScreen
        sidebar={sidebar}
        railKey="user"
        crumbs={[
          { label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: 'Rules', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: r.name },
        ]}
        title={r.name}
        scopeChip={{ label: '用户级 · Rule', tone: 'sky' }}
        filePath={r.source_path}
        initialMtime={r.mtime}
        sizeBytes={0}
        onDeleted={() => go({ name: 'global', screen: 'overview' })}
      />
    );
  }

  if (screen === 'command' && route.cmd) {
    const c = commands.find(x => x.name === route.cmd);
    if (!c) return <MissingEntryView sidebar={sidebar} onBack={() => go({ name: 'global', screen: 'overview' })} label={`/${route.cmd}`} />;
    return (
      <EntryDetailScreen
        sidebar={sidebar}
        railKey="user"
        crumbs={[
          { label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: '命令', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: `/${c.name}` },
        ]}
        title={`/${c.name}`}
        scopeChip={{ label: '用户级 · 命令', tone: 'orange' }}
        filePath={c.source_path}
        initialMtime={c.mtime}
        sizeBytes={0}
        onDeleted={() => go({ name: 'global', screen: 'overview' })}
      />
    );
  }

  if (screen === 'agent' && route.cmd) {
    const a = agents.find(x => x.name === route.cmd);
    if (!a) return <MissingEntryView sidebar={sidebar} onBack={() => go({ name: 'global', screen: 'overview' })} label={route.cmd} />;
    return (
      <EntryDetailScreen
        sidebar={sidebar}
        railKey="user"
        crumbs={[
          { label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: 'Agents', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: a.name },
        ]}
        title={a.name}
        scopeChip={{ label: '用户级 · Agent', tone: 'plum' }}
        filePath={a.source_path}
        initialMtime={a.mtime}
        sizeBytes={0}
        onDeleted={() => go({ name: 'global', screen: 'overview' })}
      />
    );
  }

  if (screen === 'skill' && route.cmd) {
    const s = skills.find(x => x.name === route.cmd);
    if (!s) return <MissingEntryView sidebar={sidebar} onBack={() => go({ name: 'global', screen: 'overview' })} label={route.cmd} />;
    return (
      <SkillDetailScreen
        sidebar={sidebar}
        railKey="user"
        crumbs={[
          { label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: 'Skills', onClick: () => go({ name: 'global', screen: 'overview' }) },
          { label: s.name },
        ]}
        title={s.name}
        skillDir={s.source_path}
        scopeChip={{ label: '用户级 · Skill', tone: 'leaf' }}
        onDeleted={() => go({ name: 'global', screen: 'overview' })}
      />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <Rail active="user" />
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', overflow: 'hidden' }}>
        <Topbar
          crumbs={[{ label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) }, { label: '概览' }]}
          right={
            <>
              <button className="cc-btn ghost" onClick={async () => {
                const anyPath = uc?.settings?.source_path || uc?.memory?.source_path || uc?.keybindings?.source_path;
                if (!anyPath) { toast_msg('未找到 ~/.claude 任何文件', 'error'); return; }
                try { await revealInFinder(anyPath); } catch (e) { toast_msg(`无法打开 Finder：${String(e)}`, 'error'); }
              }}>在 Finder 中显示</button>
            </>
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
              { l: 'settings.json', v: settingsFieldCount > 0 ? `${settingsFieldCount} 字段` : '未找到', s: '权限 · 模型 · 环境变量', icon: '{}', color: 'orange', onClick: () => go({ name: 'global', screen: 'settings' }) },
              { l: 'CLAUDE.md', v: memorySize, s: '用户级记忆 / 系统提示', icon: 'M', color: 'leaf', onClick: () => go({ name: 'global', screen: 'memory' }) },
              { l: 'keybindings.json', v: keybindingsSize, s: '全局快捷键', icon: '⌨', color: 'sky', onClick: () => go({ name: 'global', screen: 'keybindings' }) },
            ].map((x, i) => (
              <div key={i} onClick={x.onClick} style={{
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
                      onClick={() => go({ name: 'global', screen: g.kind, cmd: it.name })}
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
                          {(it as any).badge && <span>· {(it as any).badge}</span>}
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

      {newKind && (
        <NewEntryDialog
          kind={newKind}
          scopeLabel={userClaudeDir || '~/.claude'}
          onClose={() => setNewKind(null)}
          onConfirm={async (name) => { await handleCreate(newKind, name); }}
        />
      )}
    </div>
  );
}

function MissingEntryView({ sidebar, onBack, label }: { sidebar: React.ReactNode; onBack: () => void; label: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <Rail active="user" />
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--cc-muted)' }}>
        <div style={{ fontSize: 13 }}>未找到 <span className="mono">{label}</span></div>
        <button className="cc-btn ghost" onClick={onBack}>返回概览</button>
      </div>
    </div>
  );
}
