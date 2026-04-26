import { ToastTone } from '../store/app-store';

interface ToastProps {
  msg: string | null;
  tone?: ToastTone;
}

const TONE_STYLES: Record<ToastTone, { bg: string; dot: string; fg: string }> = {
  info: { bg: 'var(--cc-ink)', dot: 'var(--cc-leaf)', fg: '#F7E9E0' },
  success: { bg: '#2F4A32', dot: '#A8D49B', fg: '#E9F3E4' },
  error: { bg: '#6B1F1F', dot: '#F1A8A8', fg: '#FCEAEA' },
};

export function Toast({ msg, tone = 'info' }: ToastProps) {
  if (!msg) return null;
  const s = TONE_STYLES[tone];
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: s.bg, color: s.fg, padding: '10px 18px',
      borderRadius: 8, fontSize: 12.5, boxShadow: '0 8px 24px rgba(31,27,22,0.25)',
      zIndex: 50, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 640,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      <span style={{ whiteSpace: 'pre-wrap' }}>{msg}</span>
    </div>
  );
}
