import { ReactNode } from 'react';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}

export function Dialog({ title, onClose, children, width = 520, footer }: DialogProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(31,27,22,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width, background: 'var(--cc-bg-raised)', borderRadius: 14,
          boxShadow: '0 24px 80px rgba(31,27,22,0.25)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', maxHeight: '80vh',
        }}
      >
        <div style={{ padding: '22px 26px 16px', borderBottom: '1px solid var(--cc-line)' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        </div>
        <div style={{ padding: '20px 26px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: '14px 22px', background: 'var(--cc-bg-sunk)',
              display: 'flex', justifyContent: 'flex-end', gap: 8,
              borderTop: '1px solid var(--cc-line)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
