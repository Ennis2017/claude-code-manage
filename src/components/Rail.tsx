import { open } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';

type ActiveSection = 'dashboard' | 'user' | 'projects' | 'docs';

interface RailProps {
  active: ActiveSection;
  projectId?: string;
}

export function Rail({ active, projectId }: RailProps) {
  const { go, toast_msg, railCollapsed, toggleRail } = useAppStore();
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
  const displayName = snapshot?.user_config.oauth_account?.display_name?.trim() || 'User';
  const userInitial = (displayName[0] || '?').toUpperCase();

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
  const shortcutHint = isMac ? '⌘K' : 'Ctrl+K';

  type RailItem = { id: ActiveSection; label: string; icon: string; onClick: () => void };
  const items: RailItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '◆', onClick: () => go({ name: 'dashboard' }) },
    { id: 'user', label: '全局配置', icon: '⚙', onClick: () => go({ name: 'global', screen: 'overview' }) },
    { id: 'docs', label: '命令百科', icon: '☰', onClick: () => go({ name: 'catalog' }) },
  ];

  if (railCollapsed) {
    return (
      <aside style={{
        width: 52, background: 'var(--cc-bg-sunk)', borderRight: '1px solid var(--cc-line)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '14px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img
            src="/icon.png"
            alt="Claude Code Manage"
            onClick={() => go({ name: 'dashboard' })}
            style={{ width: 26, height: 26, borderRadius: 7, cursor: 'pointer', display: 'block' }}
          />
          <button
            onClick={toggleRail}
            title="展开侧栏"
            style={collapseBtnStyle}
          >»</button>
        </div>

        <div style={{ height: 1, background: 'var(--cc-line)', margin: '4px 10px 8px' }} />

        <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            onClick={() => window.dispatchEvent(new CustomEvent('ccm:open-palette'))}
            title={`搜索 (${shortcutHint})`}
            className="rail-item"
            style={collapsedItemStyle(false)}
          >⌕</div>
          {items.map(it => (
            <div
              key={it.id}
              onClick={it.onClick}
              title={it.label}
              className="rail-item"
              style={collapsedItemStyle(active === it.id)}
            >{it.icon}</div>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--cc-line)', margin: '10px 10px' }} />

        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {projects.map(p => {
            const isA = projectId === p.id;
            const initial = (p.name[0] || '?').toUpperCase();
            return (
              <div
                key={p.id}
                onClick={() => go({ name: 'project', id: p.id, screen: 'overview' })}
                title={p.name}
                className="rail-item"
                style={{
                  ...collapsedItemStyle(isA),
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 11,
                }}
              >{initial}</div>
            );
          })}
          <div
            onClick={pickAndAddProject}
            title="添加项目"
            className="rail-item"
            style={{ ...collapsedItemStyle(false), color: 'var(--cc-orange-deep)' }}
          >+</div>
        </nav>

        <div
          title={`${displayName} · ${cliVersion || 'v?'}`}
          style={{
            padding: '12px 0', borderTop: '1px solid var(--cc-line)',
            display: 'flex', justifyContent: 'center',
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: '50%', background: 'var(--cc-orange-wash)',
            color: 'var(--cc-orange-deep)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11, fontWeight: 600,
          }}>{userInitial}</div>
        </div>
      </aside>
    );
  }

  return (
    <aside style={{
      width: 208, background: 'var(--cc-bg-sunk)', borderRight: '1px solid var(--cc-line)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ padding: '20px 12px 16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src="/icon.png"
          alt="Claude Code Manage"
          onClick={() => go({ name: 'dashboard' })}
          style={{ width: 26, height: 26, borderRadius: 7, display: 'block', flexShrink: 0, cursor: 'pointer' }}
        />
        <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => go({ name: 'dashboard' })}>
          <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em' }}>Claude Code</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--cc-muted)' }}>配置管理器</div>
        </div>
        <button onClick={toggleRail} title="折叠侧栏" style={collapseBtnStyle}>«</button>
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
        }}>{userInitial}</div>
        <div style={{ flex: 1, fontSize: 11.5, color: 'var(--cc-ink-soft)', overflow: 'hidden' }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
          <div className="mono" style={{ color: 'var(--cc-muted)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cliVersion || 'v?'}
          </div>
        </div>
      </div>
    </aside>
  );
}

const collapseBtnStyle: React.CSSProperties = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: '1px solid var(--cc-line)', borderRadius: 5,
  color: 'var(--cc-muted)', fontSize: 12, lineHeight: 1, cursor: 'pointer', padding: 0,
};

function collapsedItemStyle(active: boolean): React.CSSProperties {
  return {
    width: 36, height: 32, borderRadius: 7,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, cursor: 'pointer',
    color: active ? 'var(--cc-orange-deep)' : 'var(--cc-ink-soft)',
    background: active ? 'var(--cc-orange-wash)' : 'transparent',
    fontWeight: active ? 600 : 400,
  };
}
