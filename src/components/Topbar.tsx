import { ReactNode } from 'react';

interface Crumb {
  label: string;
  onClick?: () => void;
}

interface TopbarProps {
  crumbs: (Crumb | string)[];
  right?: ReactNode;
}

export function Topbar({ crumbs, right }: TopbarProps) {
  return (
    <div style={{
      height: 52, padding: '0 28px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', background: 'var(--cc-bg)',
      borderBottom: '1px solid var(--cc-line)', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--cc-muted)' }}>
        {crumbs.map((c, i) => {
          const crumb = typeof c === 'string' ? { label: c } : c;
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {i > 0 && <span style={{ color: 'var(--cc-muted-soft)' }}>/</span>}
              <span
                onClick={crumb.onClick}
                style={{
                  color: isLast ? 'var(--cc-ink)' : 'var(--cc-muted)',
                  fontWeight: isLast ? 500 : 400,
                  cursor: crumb.onClick ? 'pointer' : 'default',
                }}
              >{crumb.label}</span>
            </span>
          );
        })}
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>}
    </div>
  );
}
