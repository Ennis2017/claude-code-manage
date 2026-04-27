import './index.css';
import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from './store/app-store';
import { useConfigStore } from './store/config-store';
import { useWorkspaceStore } from './store/workspace-store';
import { Toast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/CommandPalette';
import { Dashboard } from './screens/Dashboard';
import { GlobalConfig } from './screens/GlobalConfig';
import { ProjectDetail } from './screens/ProjectDetail';
import { Catalog } from './screens/Catalog';

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  const { route, toast, toastTone } = useAppStore();
  const { scanAll, error, loading, snapshot } = useConfigStore();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    scanAll();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listen<string[]>('config-changed', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => scanAll(), 200);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unlisten.then(fn => fn()).catch(() => {});
    };
  }, []);

  // 路由切换 → 清理非当前项目的 workspace scope（user scope 始终保留）
  useEffect(() => {
    const keep: string[] = ['user'];
    if (route.name === 'project' && route.id) keep.push(route.id);
    useWorkspaceStore.getState().clearScopesExcept(keep);
  }, [route.name, route.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isPaletteShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isPaletteShortcut) {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    const onOpenEvent = () => setPaletteOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('ccm:open-palette', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ccm:open-palette', onOpenEvent);
    };
  }, []);

  let screen;
  if (route.name === 'dashboard') screen = <Dashboard />;
  else if (route.name === 'global') screen = <GlobalConfig />;
  else if (route.name === 'project') screen = <ProjectDetail />;
  else if (route.name === 'catalog') screen = <Catalog />;
  else screen = <Dashboard />;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        {screen}
      </div>
      <Toast msg={toast} tone={toastTone} />
      {error && <ErrorBanner message={error} />}
      {loading && snapshot && <LoadingPulse />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function LoadingPulse() {
  return (
    <div style={{
      position: 'fixed', top: 12, left: 12, zIndex: 70,
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--cc-bg-raised)', color: 'var(--cc-muted)',
      padding: '5px 10px', borderRadius: 20, fontSize: 11,
      border: '1px solid var(--cc-line)',
      boxShadow: '0 4px 14px rgba(31,27,22,0.08)',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--cc-orange)',
        animation: 'cc-pulse 1s ease-in-out infinite',
      }} />
      <span>扫描中…</span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  const { scanAll } = useConfigStore();
  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, maxWidth: 420, zIndex: 80,
      background: '#6B1F1F', color: '#FCEAEA', padding: '10px 14px', borderRadius: 8,
      fontSize: 12, boxShadow: '0 6px 18px rgba(31,27,22,0.25)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F1A8A8', flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>扫描失败：{message}</span>
      <button
        onClick={() => scanAll()}
        style={{ background: 'transparent', color: '#FCEAEA', border: '1px solid #8F3030', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}
      >重试</button>
    </div>
  );
}
