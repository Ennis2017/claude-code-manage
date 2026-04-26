import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { Rail } from '../components/Rail';
import { InnerSidebar } from '../components/InnerSidebar';
import { Topbar } from '../components/Topbar';
import { ProjectMemoryScreen } from './MemoryScreen';
import { FileEditorScreen } from './FileEditorScreen';
import { McpEditorScreen } from './McpEditorScreen';
import { HooksScreen } from './HooksScreen';
import { PermissionsScreen } from './PermissionsScreen';
import { EntryDetailScreen } from './EntryDetailScreen';
import { SkillDetailScreen } from './SkillDetailScreen';
import { NewEntryDialog, EntryKind } from '../components/NewEntryDialog';
import { revealInFinder, createFile, createDir } from '../lib/fs-bridge';
import { commandTemplate, agentTemplate, skillTemplate } from '../lib/entry-templates';
import { validateSettingsJsonText } from '../lib/settings-schema';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectDetail() {
  const { route, go, set, toast_msg, activeInnerId } = useAppStore();
  const { snapshot, removeProject, scanAll } = useConfigStore();
  const projects = snapshot?.projects || [];
  const p = projects.find(x => x.id === route.id) || projects[0];
  const screen = route.screen || 'overview';
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [newKind, setNewKind] = useState<EntryKind | null>(null);

  if (!p) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <Rail active="projects" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cc-muted)', fontSize: 14 }}>
          暂无项目 · 请先在 Dashboard 添加项目
        </div>
      </div>
    );
  }

  const commands = p.commands;
  const skills = p.skills;
  const agents = p.agents;
  const rules = p.rules || [];

  const settingsRaw = (p.settings?.raw as Record<string, unknown> | undefined) || {};
  const hooksRaw = settingsRaw.hooks as Record<string, Array<{ hooks?: unknown[] }>> | undefined;
  const hookCount = hooksRaw && typeof hooksRaw === 'object'
    ? Object.values(hooksRaw).reduce((s, arr) => s + (Array.isArray(arr) ? arr.reduce((ss, g) => ss + ((g as { hooks?: unknown[] }).hooks?.length || 0), 0) : 0), 0)
    : 0;
  const permsRaw = settingsRaw.permissions as { allow?: string[]; deny?: string[]; ask?: string[] } | undefined;
  const permCount = (permsRaw?.allow?.length || 0) + (permsRaw?.deny?.length || 0) + (permsRaw?.ask?.length || 0);

  const sidebarSections = [
    { label: null, items: [{ id: 'overview', label: '概览', icon: '◆' }] },
    {
      label: '配置',
      items: [
        { id: 'settings', label: 'settings.json', icon: '{}' },
        ...(p.local_settings ? [{ id: 'local', label: 'settings.local.json', icon: '{}', badge: { label: 'local' } }] : []),
        { id: 'permissions', label: 'Permissions', icon: 'P', count: permCount > 0 ? `${permCount}` : undefined },
        { id: 'hooks', label: 'Hooks', icon: 'H', count: hookCount > 0 ? `${hookCount}` : undefined },
        ...(p.has_mcp ? [{ id: 'mcp', label: '.mcp.json', icon: 'MC' }] : []),
        { id: 'memory', label: 'CLAUDE.md', icon: 'M' },
      ],
    },
    { label: '命令', addable: true, onAdd: () => setNewKind('command'), items: commands.map(c => ({ id: `cmd-${c.name}`, label: `/${c.name}`, icon: '/' })) },
    { label: 'Skills', addable: true, onAdd: () => setNewKind('skill'), items: skills.map(s => ({ id: `skill-${s.name}`, label: s.name, icon: 'S', count: `${s.file_count}` })) },
    { label: 'Agents', addable: true, onAdd: () => setNewKind('agent'), items: agents.map(a => ({ id: `agent-${a.name}`, label: a.name, icon: 'A' })) },
    { label: 'Rules', items: rules.map(r => ({ id: `rule-${r.name}`, label: r.name, icon: 'R' })) },
  ];

  const activeId = screen === 'command' && route.cmd ? `cmd-${route.cmd}`
    : screen === 'skill' && route.cmd ? `skill-${route.cmd}`
    : screen === 'agent' && route.cmd ? `agent-${route.cmd}`
    : screen === 'rule' && route.cmd ? `rule-${route.cmd}`
    : screen === 'settings' ? 'settings'
    : screen === 'local' ? 'local'
    : screen === 'permissions' ? 'permissions'
    : screen === 'hooks' ? 'hooks'
    : screen === 'memory' ? 'memory'
    : screen === 'mcp' ? 'mcp'
    : screen === 'overview' ? 'overview'
    : (activeInnerId || 'overview');

  const sidebar = (
    <InnerSidebar
      sections={sidebarSections}
      activeId={activeId}
      onPick={(it) => {
        if (it.id === 'overview') go({ name: 'project', id: p.id, screen: 'overview' });
        else if (it.id === 'settings') go({ name: 'project', id: p.id, screen: 'settings' });
        else if (it.id === 'local') go({ name: 'project', id: p.id, screen: 'local' });
        else if (it.id === 'permissions') go({ name: 'project', id: p.id, screen: 'permissions' });
        else if (it.id === 'hooks') go({ name: 'project', id: p.id, screen: 'hooks' });
        else if (it.id === 'memory') go({ name: 'project', id: p.id, screen: 'memory' });
        else if (it.id === 'mcp') go({ name: 'project', id: p.id, screen: 'mcp' });
        else if (it.id.startsWith('cmd-')) go({ name: 'project', id: p.id, screen: 'command', cmd: it.id.slice(4) });
        else if (it.id.startsWith('skill-')) go({ name: 'project', id: p.id, screen: 'skill', cmd: it.id.slice(6) });
        else if (it.id.startsWith('agent-')) go({ name: 'project', id: p.id, screen: 'agent', cmd: it.id.slice(6) });
        else if (it.id.startsWith('rule-')) go({ name: 'project', id: p.id, screen: 'rule', cmd: it.id.slice(5) });
        else set({ activeInnerId: it.id });
      }}
    />
  );

  const handleCreate = async (kind: EntryKind, name: string) => {
    const base = `${p.path}/.claude`;
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
    if (kind === 'command') go({ name: 'project', id: p.id, screen: 'command', cmd: name });
    if (kind === 'agent') go({ name: 'project', id: p.id, screen: 'agent', cmd: name });
    if (kind === 'skill') go({ name: 'project', id: p.id, screen: 'skill', cmd: name });
  };

  if (screen === 'memory') {
    return <ProjectMemoryScreen sidebar={sidebar} projectId={p.id} />;
  }

  if (screen === 'hooks') {
    const file = p.settings;
    const filePath = file?.source_path || `${p.path}/.claude/settings.json`;
    return (
      <HooksScreen
        sidebar={sidebar}
        railKey="projects"
        railProjectId={p.id}
        crumbs={[
          { label: '项目', onClick: () => go({ name: 'dashboard' }) },
          { label: p.name, onClick: () => go({ name: 'project', id: p.id, screen: 'overview' }) },
          { label: 'Hooks' },
        ]}
        scopeChip={{ label: '项目 · settings.json', tone: 'sky' }}
        filePath={filePath}
        settingsRaw={settingsRaw}
        initialMtime={file?.mtime || ''}
        sizeBytes={file?.size_bytes || 0}
      />
    );
  }

  if (screen === 'permissions') {
    const file = p.settings;
    const filePath = file?.source_path || `${p.path}/.claude/settings.json`;
    return (
      <PermissionsScreen
        sidebar={sidebar}
        railKey="projects"
        railProjectId={p.id}
        crumbs={[
          { label: '项目', onClick: () => go({ name: 'dashboard' }) },
          { label: p.name, onClick: () => go({ name: 'project', id: p.id, screen: 'overview' }) },
          { label: 'Permissions' },
        ]}
        scopeChip={{ label: '项目 · settings.json', tone: 'sky' }}
        filePath={filePath}
        settingsRaw={settingsRaw}
        initialMtime={file?.mtime || ''}
        sizeBytes={file?.size_bytes || 0}
      />
    );
  }

  if (screen === 'rule' && route.cmd) {
    const r = rules.find(x => x.name === route.cmd);
    if (!r) return <MissingProjectEntry sidebar={sidebar} projectId={p.id} label={route.cmd} onBack={() => go({ name: 'project', id: p.id, screen: 'overview' })} />;
    return (
      <EntryDetailScreen
        sidebar={sidebar}
        railKey="projects"
        railProjectId={p.id}
        crumbs={[
          { label: '项目', onClick: () => go({ name: 'dashboard' }) },
          { label: p.name, onClick: () => go({ name: 'project', id: p.id, screen: 'overview' }) },
          { label: r.name },
        ]}
        title={r.name}
        scopeChip={{ label: '项目 · Rule', tone: 'sky' }}
        filePath={r.source_path}
        initialMtime={r.mtime}
        sizeBytes={0}
        onDeleted={() => go({ name: 'project', id: p.id, screen: 'overview' })}
      />
    );
  }

  if (screen === 'mcp') {
    return (
      <McpEditorScreen
        sidebar={sidebar}
        railKey="projects"
        railProjectId={p.id}
        crumbs={[
          { label: '项目', onClick: () => go({ name: 'dashboard' }) },
          { label: p.name, onClick: () => go({ name: 'project', id: p.id, screen: 'overview' }) },
          { label: '.mcp.json' },
        ]}
        title=".mcp.json"
        scopeChip={{ label: '项目 · MCP', tone: 'plum' }}
        filePath={`${p.path}/.mcp.json`}
      />
    );
  }

  if (screen === 'settings' || screen === 'local') {
    const file = screen === 'settings' ? p.settings : p.local_settings;
    const filePath = file?.source_path
      || (screen === 'local' ? `${p.path}/.claude/settings.local.json`
        : `${p.path}/.claude/settings.json`);
    const initial = file?.raw ? JSON.stringify(file.raw, null, 2) : '{}';
    const title = screen === 'local' ? 'settings.local.json' : 'settings.json';
    const chip = screen === 'local'
      ? { label: '项目 · local', tone: 'orange' as const }
      : { label: '项目级', tone: 'sky' as const };
    const isSettingsKind = true;
    return (
      <FileEditorScreen
        sidebar={sidebar}
        railKey="projects"
        railProjectId={p.id}
        crumbs={[
          { label: '项目', onClick: () => go({ name: 'dashboard' }) },
          { label: p.name, onClick: () => go({ name: 'project', id: p.id, screen: 'overview' }) },
          { label: title },
        ]}
        title={title}
        scopeChip={chip}
        filePath={filePath}
        initialContent={initial}
        initialMtime={file?.mtime || ''}
        language="json"
        sizeBytes={file?.size_bytes || initial.length}
        validate={isSettingsKind ? validateSettingsJsonText : undefined}
      />
    );
  }

  if (screen === 'command' && route.cmd) {
    const cmd = commands.find(c => c.name === route.cmd);
    if (!cmd) return <MissingProjectEntry sidebar={sidebar} projectId={p.id} label={`/${route.cmd}`} onBack={() => go({ name: 'project', id: p.id, screen: 'overview' })} />;
    return (
      <EntryDetailScreen
        sidebar={sidebar}
        railKey="projects"
        railProjectId={p.id}
        crumbs={[
          { label: '项目', onClick: () => go({ name: 'dashboard' }) },
          { label: p.name, onClick: () => go({ name: 'project', id: p.id, screen: 'overview' }) },
          { label: `/${cmd.name}` },
        ]}
        title={`/${cmd.name}`}
        scopeChip={{ label: '项目 · 命令', tone: 'orange' }}
        filePath={cmd.source_path}
        initialMtime={cmd.mtime}
        sizeBytes={0}
        onDeleted={() => go({ name: 'project', id: p.id, screen: 'overview' })}
      />
    );
  }

  if (screen === 'agent' && route.cmd) {
    const a = agents.find(x => x.name === route.cmd);
    if (!a) return <MissingProjectEntry sidebar={sidebar} projectId={p.id} label={route.cmd} onBack={() => go({ name: 'project', id: p.id, screen: 'overview' })} />;
    return (
      <EntryDetailScreen
        sidebar={sidebar}
        railKey="projects"
        railProjectId={p.id}
        crumbs={[
          { label: '项目', onClick: () => go({ name: 'dashboard' }) },
          { label: p.name, onClick: () => go({ name: 'project', id: p.id, screen: 'overview' }) },
          { label: a.name },
        ]}
        title={a.name}
        scopeChip={{ label: '项目 · Agent', tone: 'plum' }}
        filePath={a.source_path}
        initialMtime={a.mtime}
        sizeBytes={0}
        onDeleted={() => go({ name: 'project', id: p.id, screen: 'overview' })}
      />
    );
  }

  if (screen === 'skill' && route.cmd) {
    const s = skills.find(x => x.name === route.cmd);
    if (!s) return <MissingProjectEntry sidebar={sidebar} projectId={p.id} label={route.cmd} onBack={() => go({ name: 'project', id: p.id, screen: 'overview' })} />;
    return (
      <SkillDetailScreen
        sidebar={sidebar}
        railKey="projects"
        railProjectId={p.id}
        crumbs={[
          { label: '项目', onClick: () => go({ name: 'dashboard' }) },
          { label: p.name, onClick: () => go({ name: 'project', id: p.id, screen: 'overview' }) },
          { label: s.name },
        ]}
        title={s.name}
        skillDir={s.source_path}
        scopeChip={{ label: '项目 · Skill', tone: 'leaf' }}
        onDeleted={() => go({ name: 'project', id: p.id, screen: 'overview' })}
      />
    );
  }

  const settingsFieldCount = p.settings?.raw ? Object.keys(p.settings.raw as object).length : 0;
  const localFieldCount = p.local_settings?.raw ? Object.keys(p.local_settings.raw as object).length : 0;
  const memorySize = p.memory ? formatBytes(p.memory.size_bytes) : '—';
  const lastEdit = p.settings?.mtime || p.memory?.mtime || p.commands[0]?.mtime || '';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <Rail active="projects" projectId={p.id} />
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', overflow: 'hidden' }}>
        <Topbar
          crumbs={[{ label: '项目', onClick: () => go({ name: 'dashboard' }) }, { label: p.name }, { label: '概览' }]}
          right={
            <>
              <button className="cc-btn ghost" onClick={async () => {
                try { await revealInFinder(p.path); } catch (e) { toast_msg(`无法打开 Finder：${String(e)}`, 'error'); }
              }}>在 Finder 中显示</button>
              <button className="cc-btn ghost" style={{ color: 'var(--cc-muted)' }} onClick={() => setConfirmRemove(true)}>移除项目</button>
            </>
          }
        />
        <div style={{ flex: 1, overflow: 'auto', padding: '26px 36px 36px' }}>
          {/* Hero */}
          <div style={{ background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 14, padding: '24px 28px', marginBottom: 22, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ width: 64, height: 64, borderRadius: 14, background: 'linear-gradient(135deg, #D97757 0%, #B8543A 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
              {(p.name[0] || '?').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cc-muted)', fontWeight: 600, marginBottom: 4 }}>项目 · {p.added_at} 添加</div>
              <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 6 }}>{p.name}</h1>
              <div className="mono" style={{ fontSize: 12, color: 'var(--cc-muted)', marginBottom: 14 }}>{p.path}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.has_mcp && <span className="cc-chip orange" style={{ height: 22 }}>MCP</span>}
                {p.local_settings && <span className="cc-chip" style={{ height: 22 }}>settings.local.json</span>}
                {p.memory && <span className="cc-chip leaf" style={{ height: 22 }}>CLAUDE.md</span>}
                <span className="cc-chip" style={{ height: 22 }}>{(p.settings ? 1 : 0) + (p.local_settings ? 1 : 0) + (p.memory ? 1 : 0) + commands.length + skills.length + agents.length} 份文件</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--cc-muted)', flexShrink: 0 }}>
              <div>上次编辑</div>
              <div className="mono" style={{ marginTop: 2, color: 'var(--cc-ink-soft)', fontWeight: 500 }}>{lastEdit || '—'}</div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { l: 'settings', v: settingsFieldCount || '—', s: '字段' },
              { l: 'local', v: localFieldCount || '—', s: '覆盖' },
              { l: 'memory', v: p.memory ? memorySize : '—', s: 'CLAUDE.md' },
              { l: '命令', v: commands.length, s: '斜杠' },
              { l: 'Skills', v: skills.length, s: '技能' },
              { l: 'Agents', v: agents.length, s: '子代理' },
            ].map((x, i) => (
              <div key={i} style={{ background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--cc-muted)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>{x.l}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <div className="serif" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>{x.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--cc-muted)' }}>{x.s}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Commands */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>命令 <span style={{ color: 'var(--cc-muted-soft)', fontWeight: 400, marginLeft: 4 }}>· {commands.length}</span></h3>
              <span style={{ fontSize: 11.5, color: 'var(--cc-orange-deep)', cursor: 'pointer' }} onClick={() => setNewKind('command')}>＋ 新建</span>
            </div>
            {commands.length === 0 ? (
              <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--cc-muted)', fontStyle: 'italic' }}>暂无命令</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {commands.map((c, i) => (
                  <div key={i} onClick={() => go({ name: 'project', id: p.id, screen: 'command', cmd: c.name })} style={{ cursor: 'pointer', background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div className="mono" style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--cc-bg-sunk)', color: 'var(--cc-ink-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, flexShrink: 0 }}>/</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>/{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description || '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--cc-muted-soft)' }}>{c.mtime}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Skills + Agents */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Skills <span style={{ color: 'var(--cc-muted-soft)', fontWeight: 400, marginLeft: 4 }}>· {skills.length}</span></h3>
                <span style={{ fontSize: 11.5, color: 'var(--cc-orange-deep)', cursor: 'pointer' }} onClick={() => setNewKind('skill')}>＋ 新建</span>
              </div>
              {skills.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--cc-muted)', fontStyle: 'italic' }}>暂无 Skills</div>
              ) : skills.map((s, i) => (
                <div
                  key={i}
                  onClick={() => go({ name: 'project', id: p.id, screen: 'skill', cmd: s.name })}
                  style={{ cursor: 'pointer', background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center' }}
                >
                  <div className="mono" style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--cc-leaf-wash)', color: '#4A5B3D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11 }}>S</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 1 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description || '—'}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--cc-muted-soft)', textAlign: 'right', flexShrink: 0 }}>
                    <div>{s.file_count} 个文件</div><div>{s.mtime}</div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Agents <span style={{ color: 'var(--cc-muted-soft)', fontWeight: 400, marginLeft: 4 }}>· {agents.length}</span></h3>
              {agents.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--cc-muted)', fontStyle: 'italic', marginBottom: 8 }}>暂无 Agents</div>
              ) : agents.map((a, i) => (
                <div
                  key={i}
                  onClick={() => go({ name: 'project', id: p.id, screen: 'agent', cmd: a.name })}
                  style={{ cursor: 'pointer', background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center' }}
                >
                  <div className="mono" style={{ width: 26, height: 26, borderRadius: 7, background: '#F0E5EF', color: 'var(--cc-plum)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11 }}>A</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 1 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--cc-muted)' }}>{a.description || '—'}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--cc-muted-soft)' }}>{a.mtime}</div>
                </div>
              ))}
              <div onClick={() => setNewKind('agent')} style={{ background: 'transparent', border: '1px dashed var(--cc-line-strong)', borderRadius: 10, padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--cc-muted)', cursor: 'pointer' }}>＋ 新建 Agent</div>
            </div>
          </div>
        </div>
      </div>

      {confirmRemove && (
        <ConfirmRemoveDialog
          name={p.name}
          path={p.path}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={async () => {
            setConfirmRemove(false);
            try {
              await removeProject(p.path);
              toast_msg(`已从注册表移除 ${p.name}`, 'success');
              go({ name: 'dashboard' });
            } catch (e) {
              toast_msg(`移除失败：${String(e)}`, 'error');
            }
          }}
        />
      )}

      {newKind && (
        <NewEntryDialog
          kind={newKind}
          scopeLabel={`${p.path}/.claude`}
          onClose={() => setNewKind(null)}
          onConfirm={async (name) => { await handleCreate(newKind, name); }}
        />
      )}
    </div>
  );
}

function MissingProjectEntry({ sidebar, projectId, label, onBack }: { sidebar: React.ReactNode; projectId: string; label: string; onBack: () => void }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <Rail active="projects" projectId={projectId} />
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--cc-muted)' }}>
        <div style={{ fontSize: 13 }}>未找到 <span className="mono">{label}</span></div>
        <button className="cc-btn ghost" onClick={onBack}>返回概览</button>
      </div>
    </div>
  );
}

function ConfirmRemoveDialog({ name, path, onCancel, onConfirm }: { name: string; path: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,27,22,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 40 }}>
      <div style={{ width: 520, background: 'var(--cc-bg-raised)', borderRadius: 14, boxShadow: '0 24px 80px rgba(31,27,22,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--cc-line)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>从注册表移除项目？</div>
          <div style={{ fontSize: 12.5, color: 'var(--cc-ink-soft)', lineHeight: 1.55 }}>
            仅会从 Claude Code Manage 的项目列表移除 <span style={{ fontWeight: 600 }}>{name}</span>。
            <div className="mono" style={{ fontSize: 11, color: 'var(--cc-muted)', marginTop: 6 }}>{path}</div>
            <div style={{ marginTop: 8 }}>项目目录与 <span className="mono">.claude/</span> 文件不会被删除。</div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', background: 'var(--cc-bg-sunk)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="cc-btn" style={{ height: 32 }} onClick={onCancel}>取消</button>
          <button className="cc-btn primary" style={{ height: 32, background: '#B8543A' }} onClick={onConfirm}>确认移除</button>
        </div>
      </div>
    </div>
  );
}
