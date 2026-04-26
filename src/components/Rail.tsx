import { open } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';

type ActiveSection = 'dashboard' | 'user' | 'projects' | 'docs';

interface RailProps {
  active: ActiveSection;
  projectId?: string;
}

export function Rail({ active, projectId }: RailProps) {
  const { go, toast_msg } = useAppStore();
  const { snapshot, addProject } = useConfigStore();

  const pickAndAddProject = async () => {
    const selected = await open({ directory: true, multiple: false, title: '选择项目目录' });
    if (typeof selected === 'string') {
      await addProject(selected);
      toast_msg(`已添加项目：${selected.split('/').pop()}`);
    }
  };
  const projects = snapshot?.projects || [];
  const cliVersion = snapshot?.claude_code_version;

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
  const shortcutHint = isMac ? '⌘K' : 'Ctrl+K';

  const items = [
    { id: 'dashboard', label: 'Dashboard', onClick: () => go({ name: 'dashboard' }) },
    { id: 'user', label: '全局配置', onClick: () => go({ name: 'global', screen: 'overview' }) },
    {
      id: 'projects', label: '项目', count: projects.length,
      onClick: () => projects.length > 0 ? go({ name: 'project', id: projects[0].id, screen: 'overview' }) : toast_msg('暂无项目，请先添加'),
    },
    { id: 'docs', label: '命令百科', onClick: () => go({ name: 'catalog' }) },
  ];

  return (
    <aside style={{
      width: 208, background: 'var(--cc-bg-sunk)', borderRight: '1px solid var(--cc-line)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div
        onClick={() => go({ name: 'dashboard' })}
        style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      >
        <img
          src="/icon.png"
          alt="Claude Code Manage"
          style={{ width: 26, height: 26, borderRadius: 7, display: 'block', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em' }}>Claude Code</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--cc-muted)' }}>配置管理器</div>
        </div>
      </div>

      <div style={{ padding: '0 10px 8px' }}>
        <div
          onClick={() => window.dispatchEvent(new CustomEvent('ccm:open-palette'))}
          className="rail-item"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            border: '1px solid var(--cc-line)', borderRadius: 7,
            background: 'var(--cc-bg-raised)', cursor: 'pointer',
            fontSize: 12, color: 'var(--cc-muted)',
          }}
        >
          <span style={{ fontSize: 13 }}>⌕</span>
          <span style={{ flex: 1 }}>搜索</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--cc-muted-soft)', border: '1px solid var(--cc-line)', borderRadius: 4, padding: '1px 5px' }}>{shortcutHint}</span>
        </div>
      </div>

      <nav style={{ padding: '6px 10px', flex: 1, overflow: 'auto' }}>
        {items.map(it => {
          const isActive = active === it.id;
          return (
            <div
              key={it.id}
              onClick={it.onClick}
              className="rail-item"
              style={{
                display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: 7,
                fontSize: 12.5, color: isActive ? 'var(--cc-orange-deep)' : 'var(--cc-ink-soft)',
                background: isActive ? 'var(--cc-orange-wash)' : 'transparent',
                marginBottom: 2, fontWeight: isActive ? 500 : 400, cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.count != null && (
                <span className="mono" style={{
                  fontSize: 10.5, color: isActive ? 'var(--cc-orange-deep)' : 'var(--cc-muted-soft)',
                  opacity: isActive ? 0.7 : 1,
                }}>{it.count}</span>
              )}
            </div>
          );
        })}

        <div style={{ height: 1, background: 'var(--cc-line)', margin: '14px 8px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 8px' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cc-muted)', fontWeight: 600 }}>项目</div>
          <span
            style={{ fontSize: 16, color: 'var(--cc-orange-deep)', cursor: 'pointer', lineHeight: 1, paddingBottom: 2 }}
            onClick={pickAndAddProject}
          >+</span>
        </div>

        {projects.map(p => {
          const isA = projectId === p.id;
          const initial = (p.name[0] || '?').toUpperCase();
          return (
            <div
              key={p.id}
              onClick={() => go({ name: 'project', id: p.id, screen: 'overview' })}
              className="rail-item"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                borderRadius: 7, fontSize: 12, marginBottom: 1, cursor: 'pointer',
                color: isA ? 'var(--cc-orange-deep)' : 'var(--cc-ink-soft)',
                background: isA ? 'var(--cc-orange-wash)' : 'transparent',
                fontWeight: isA ? 500 : 400,
              }}
            >
              <span style={{
                width: 14, height: 14, borderRadius: 4, fontSize: 9, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontWeight: 600,
                fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
                background: isA ? 'var(--cc-orange)' : (p.has_mcp ? 'var(--cc-orange-wash)' : 'var(--cc-bg-sunk)'),
                color: isA ? 'white' : (p.has_mcp ? 'var(--cc-orange-deep)' : 'var(--cc-muted)'),
                border: isA ? 'none' : '1px solid var(--cc-line)',
              }}>{initial}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div style={{ padding: '8px 12px', fontSize: 11.5, color: 'var(--cc-muted)', fontStyle: 'italic' }}>暂无项目</div>
        )}
      </nav>

      <div style={{
        padding: '14px 18px', borderTop: '1px solid var(--cc-line)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', background: 'var(--cc-orange-wash)',
          color: 'var(--cc-orange-deep)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, fontWeight: 600,
        }}>M</div>
        <div style={{ flex: 1, fontSize: 11.5, color: 'var(--cc-ink-soft)', overflow: 'hidden' }}>
          <div>micky</div>
          <div className="mono" style={{ color: 'var(--cc-muted)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cliVersion || 'v?'}
          </div>
        </div>
      </div>
    </aside>
  );
}
