interface SidebarItem {
  id: string;
  label: string;
  icon?: string;
  count?: number | string;
  badge?: { label: string };
}

interface SidebarSection {
  label?: string | null;
  addable?: boolean;
  onAdd?: () => void;
  items: SidebarItem[];
}

interface InnerSidebarProps {
  sections: SidebarSection[];
  activeId: string;
  onPick: (item: SidebarItem) => void;
}

export function InnerSidebar({ sections, activeId, onPick }: InnerSidebarProps) {
  return (
    <aside style={{
      width: 260, background: 'var(--cc-bg-raised)', borderRight: '1px solid var(--cc-line)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px' }}>
        {sections.map((sec, si) => (
          <div key={si}>
            {sec.label && (
              <div style={{
                fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--cc-muted)', padding: '12px 12px 6px', fontWeight: 600,
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <span>{sec.label}</span>
                {sec.addable && (
                  <span
                    onClick={(e) => { e.stopPropagation(); sec.onAdd?.(); }}
                    title={`新建 ${sec.label}`}
                    style={{
                      fontSize: 14, color: 'var(--cc-muted-soft)', letterSpacing: 0,
                      textTransform: 'none', cursor: sec.onAdd ? 'pointer' : 'default',
                      lineHeight: 1, padding: '0 4px', borderRadius: 4,
                    }}
                  >＋</span>
                )}
              </div>
            )}
            {sec.items.map(it => {
              const isA = it.id === activeId;
              return (
                <div
                  key={it.id}
                  onClick={() => onPick(it)}
                  className="inner-item"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 7, fontSize: 12.5, marginBottom: 1, cursor: 'pointer',
                    color: isA ? 'var(--cc-orange-deep)' : 'var(--cc-ink-soft)',
                    background: isA ? 'var(--cc-orange-wash)' : 'transparent',
                  }}
                >
                  {it.icon && (
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, fontSize: 9, fontWeight: 600,
                      fontFamily: 'JetBrains Mono, monospace', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: isA ? 'var(--cc-orange)' : 'var(--cc-bg-sunk)',
                      color: isA ? 'white' : 'var(--cc-muted)',
                    }}>{it.icon}</span>
                  )}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.label}
                  </span>
                  {it.count != null && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                      color: isA ? 'var(--cc-orange-deep)' : 'var(--cc-muted-soft)',
                      opacity: isA ? 0.7 : 1,
                    }}>{it.count}</span>
                  )}
                  {it.badge && (
                    <span className="cc-chip" style={{ height: 16, fontSize: 9.5, padding: '0 6px' }}>
                      {it.badge.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
