import { CSSProperties, DragEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  FileTab, LeafPane, PaneNode, ScopeId, SplitEdge, SplitPane, TabContent,
  WORKSPACE_MAX_LEAVES, useWorkspaceStore,
} from '../../store/workspace-store';
import { useAppStore } from '../../store/app-store';

const DRAG_MIME = 'application/x-ccm-tab';

interface DragPayload {
  paneId: string;
  tabId: string;
}

/** 上层屏幕（GlobalConfig / ProjectDetail）注入的内容渲染器 */
export interface WorkspaceRenderers {
  /** 给定 tab 内容，返回标题（用于 tab 上的文字） */
  tabTitle: (content: TabContent) => string;
  /** 给定 tab 内容，返回内容区 React 节点 */
  renderContent: (content: TabContent) => ReactNode;
  /** "+" 行为；不传则用 store 默认（settings.json） */
  onPlus?: () => void;
}

interface WorkspaceProps {
  scopeId: ScopeId;
  renderers: WorkspaceRenderers;
}

export function Workspace({ scopeId, renderers }: WorkspaceProps) {
  const paneTree = useWorkspaceStore(s => s.scopes[scopeId]?.paneTree);
  if (!paneTree) {
    return <div style={{ flex: 1, background: 'var(--cc-bg)' }} />;
  }
  return (
    <div style={{
      flex: 1, minWidth: 0, minHeight: 0, background: 'var(--cc-bg)',
      display: 'flex', overflow: 'hidden',
    }}>
      <PaneNodeView node={paneTree} scopeId={scopeId} renderers={renderers} />
    </div>
  );
}

function PaneNodeView({ node, scopeId, renderers }: {
  node: PaneNode; scopeId: ScopeId; renderers: WorkspaceRenderers;
}) {
  if (node.type === 'leaf') {
    return <LeafPaneView pane={node} scopeId={scopeId} renderers={renderers} />;
  }
  return <SplitPaneView split={node} scopeId={scopeId} renderers={renderers} />;
}

function SplitPaneView({ split, scopeId, renderers }: {
  split: SplitPane; scopeId: ScopeId; renderers: WorkspaceRenderers;
}) {
  const setSplitRatio = useWorkspaceStore(s => s.setSplitRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = split.direction === 'vertical'
        ? (ev.clientX - rect.left) / rect.width
        : (ev.clientY - rect.top) / rect.height;
      setSplitRatio(scopeId, split.id, ratio);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const isVertical = split.direction === 'vertical';
  const ratio = split.ratio;
  return (
    <div
      ref={containerRef}
      style={{
        flex: 1, minWidth: 0, minHeight: 0, display: 'flex',
        flexDirection: isVertical ? 'row' : 'column',
      }}
    >
      <div style={{ flex: ratio, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <PaneNodeView node={split.a} scopeId={scopeId} renderers={renderers} />
      </div>
      <div
        onMouseDown={onMouseDown}
        style={{
          flex: '0 0 4px',
          background: 'var(--cc-line)',
          cursor: isVertical ? 'col-resize' : 'row-resize',
          userSelect: 'none',
        }}
      />
      <div style={{ flex: 1 - ratio, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <PaneNodeView node={split.b} scopeId={scopeId} renderers={renderers} />
      </div>
    </div>
  );
}

function LeafPaneView({ pane, scopeId, renderers }: {
  pane: LeafPane; scopeId: ScopeId; renderers: WorkspaceRenderers;
}) {
  const tabs = useWorkspaceStore(s => s.scopes[scopeId]?.tabs ?? {});
  const activePaneId = useWorkspaceStore(s => s.scopes[scopeId]?.activePaneId);
  const focusPane = useWorkspaceStore(s => s.focusPane);
  const splitOrMove = useWorkspaceStore(s => s.splitOrMove);
  const leafCount = useWorkspaceStore(s => {
    const ws = s.scopes[scopeId];
    if (!ws) return 1;
    const cnt = (n: PaneNode): number => n.type === 'leaf' ? 1 : cnt(n.a) + cnt(n.b);
    return cnt(ws.paneTree);
  });
  const isFocused = pane.id === activePaneId;
  const [dragHover, setDragHover] = useState<SplitEdge | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const activeTab: FileTab | undefined = pane.activeTabId ? tabs[pane.activeTabId] : undefined;
  const canSplit = leafCount < WORKSPACE_MAX_LEAVES;

  // 根据光标在 overlay 内的相对位置算出最近边：top/right/bottom/left（不再支持 center）
  const computeEdge = (e: DragEvent<HTMLDivElement>): SplitEdge => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const dTop = y;
    const dBottom = 1 - y;
    const dLeft = x;
    const dRight = 1 - x;
    const min = Math.min(dTop, dBottom, dLeft, dRight);
    if (min === dTop) return 'top';
    if (min === dBottom) return 'bottom';
    if (min === dLeft) return 'left';
    return 'right';
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!canSplit) return;
    const edge = computeEdge(e);
    if (edge !== dragHover) {
      // eslint-disable-next-line no-console
      console.log('[ccm-drag] dragover edge=', edge);
      setDragHover(edge);
    }
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // 只在真的离开 overlay 边界时清空（避免子元素冒泡造成闪烁）
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX >= rect.right ||
      e.clientY < rect.top || e.clientY >= rect.bottom
    ) {
      setDragHover(null);
    }
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragHover(null);
    if (!canSplit) return;
    const edge = computeEdge(e);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    // eslint-disable-next-line no-console
    console.log('[ccm-drag] drop edge=', edge, 'raw=', raw);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      // eslint-disable-next-line no-console
      console.log('[ccm-drag] splitOrMove', { target: pane.id, edge, payload });
      splitOrMove(scopeId, pane.id, edge, payload.paneId, payload.tabId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ccm-drag] drop parse error', err);
    }
  };

  // 用 ref 直接监听 store —— 拖拽开始时同步翻转 pointer-events，绕开 React reconciliation
  useEffect(() => {
    const apply = (dragging: boolean) => {
      const el = overlayRef.current;
      if (!el) return;
      el.style.pointerEvents = dragging ? 'auto' : 'none';
      el.style.visibility = dragging ? 'visible' : 'hidden';
      // eslint-disable-next-line no-console
      console.log('[ccm-drag] overlay applied dragging=', dragging, 'pane=', pane.id);
    };
    apply(useWorkspaceStore.getState().isDragging);
    return useWorkspaceStore.subscribe((s, prev) => {
      if (s.isDragging !== prev.isDragging) apply(s.isDragging);
    });
  }, [pane.id]);

  return (
    <div
      onClick={() => focusPane(scopeId, pane.id)}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
        outline: isFocused && leafCount > 1 ? '1px solid var(--cc-orange)' : 'none',
        position: 'relative',
      }}
    >
      <TabBar pane={pane} scopeId={scopeId} renderers={renderers} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        {activeTab ? (
          <div key={activeTab.id} style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {renderers.renderContent(activeTab.content)}
          </div>
        ) : (
          <EmptyPane />
        )}

        {/* 单一 drop overlay：用 ref 同步切换 pointer-events，避开 React 重渲染时序 */}
        <div
          ref={overlayRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={{
            position: 'absolute', inset: 0, zIndex: 100,
            pointerEvents: 'none', visibility: 'hidden',
          }}
        >
          <DropHighlight edge={dragHover} canSplit={canSplit} />
        </div>
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--cc-muted-soft)', fontSize: 12.5,
    }}>
      把 tab 拖到这里，或点击侧边的条目打开
    </div>
  );
}

function TabBar({ pane, scopeId, renderers }: {
  pane: LeafPane; scopeId: ScopeId; renderers: WorkspaceRenderers;
}) {
  const tabs = useWorkspaceStore(s => s.scopes[scopeId]?.tabs ?? {});
  const activateTab = useWorkspaceStore(s => s.activateTab);
  const closeTab = useWorkspaceStore(s => s.closeTab);
  const splitOrMove = useWorkspaceStore(s => s.splitOrMove);
  const setDragging = useWorkspaceStore(s => s.setDragging);
  const isDragging = useWorkspaceStore(s => s.isDragging);
  const plusOpen = useWorkspaceStore(s => s.plusOpen);
  const [dragOver, setDragOver] = useState(false);

  const onDragStart = (e: DragEvent<HTMLDivElement>, tabId: string) => {
    const payload: DragPayload = { paneId: pane.id, tabId };
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
    // eslint-disable-next-line no-console
    console.log('[ccm-drag] dragstart', { paneId: pane.id, tabId });
  };
  const onDragEnd = () => {
    setDragging(false);
    // eslint-disable-next-line no-console
    console.log('[ccm-drag] dragend');
  };

  const onStripDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };
  const onStripDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      if (payload.paneId === pane.id) return;
      splitOrMove(scopeId, pane.id, 'center', payload.paneId, payload.tabId);
    } catch {/* ignore */}
  };

  const handlePlus = () => {
    if (renderers.onPlus) renderers.onPlus();
    else plusOpen(scopeId);
  };

  const innerCollapsed = useAppStore(s => s.innerCollapsed);
  const toggleInner = useAppStore(s => s.toggleInner);

  return (
    <div
      onDragOver={onStripDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onStripDrop}
      style={{
        height: 38, flexShrink: 0, display: 'flex', alignItems: 'stretch',
        background: dragOver ? 'var(--cc-orange-wash)' : 'var(--cc-bg-sunk)',
        borderBottom: '1px solid var(--cc-line)',
        // 内部 6px 缓冲：让 tab 可点击区从 y=6 起，避开 macOS 全屏顶部菜单触发带
        paddingTop: 6,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={toggleInner}
        title={innerCollapsed ? '展开侧栏' : '折叠侧栏'}
        style={{
          alignSelf: 'center', flexShrink: 0,
          height: 24, width: 24, marginLeft: 6, marginRight: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--cc-muted)', fontSize: 13, lineHeight: 1, padding: 0,
          borderRadius: 4,
        }}
      >{innerCollapsed ? '»' : '«'}</button>

      {pane.tabIds.map(tid => {
        const t = tabs[tid];
        if (!t) return null;
        const active = pane.activeTabId === tid;
        const title = renderers.tabTitle(t.content);
        return (
          <div
            key={tid}
            draggable
            onDragStart={e => onDragStart(e, tid)}
            onDragEnd={onDragEnd}
            onClick={() => activateTab(scopeId, pane.id, tid)}
            title={title}
            className="ccm-tab"
            data-active={active ? '1' : '0'}
            style={tabStyle(active)}
          >
            {/* 顶部 active 指示条 */}
            {active && <span style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: 'var(--cc-orange)', pointerEvents: 'none',
            }} />}
            <span style={{
              flex: 1, fontSize: 12,
              color: active ? 'var(--cc-ink)' : 'var(--cc-ink-soft)',
              fontWeight: active ? 500 : 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}>{title}</span>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); closeTab(scopeId, pane.id, tid); }}
              title="关闭"
              className="ccm-tab-close"
              style={{
                flexShrink: 0,
                width: 16, height: 16, marginLeft: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none',
                color: 'var(--cc-muted)', fontSize: 13, lineHeight: 1, padding: 0,
                borderRadius: 4, cursor: 'pointer',
                opacity: active ? 0.7 : 0,
                transition: 'opacity 0.12s ease, background 0.12s ease',
              }}
            >×</button>
          </div>
        );
      })}
      <button
        title="新建 Tab（默认概览页）"
        onMouseDown={e => e.stopPropagation()}
        onClick={handlePlus}
        style={{
          alignSelf: 'center', flexShrink: 0,
          height: 22, width: 22, marginLeft: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--cc-muted)', fontSize: 16, lineHeight: 1, borderRadius: 4,
        }}
      >+</button>
      <div style={{ flex: 1, minWidth: 0 }} />
    </div>
  );
}

function tabStyle(active: boolean): CSSProperties {
  return {
    height: '100%',
    // Chrome 风格：宽度按可用空间均分，min 80 max 200
    flex: '1 1 0',
    minWidth: 80, maxWidth: 200,
    padding: '0 10px 0 12px',
    display: 'flex', alignItems: 'center', gap: 4,
    background: active ? 'var(--cc-bg)' : 'transparent',
    cursor: 'grab', position: 'relative',
    userSelect: 'none',
    WebkitUserDrag: 'element',
    WebkitUserSelect: 'none',
    transition: 'background 0.1s ease',
  } as CSSProperties;
}

function DropHighlight({ edge, canSplit }: {
  edge: SplitEdge | null;
  canSplit: boolean;
}) {
  if (!edge || !canSplit) return null;
  const base: CSSProperties = {
    background: 'rgba(217,119,87,0.18)',
    border: '2px solid var(--cc-orange)',
    pointerEvents: 'none', position: 'absolute',
    transition: 'all 80ms ease-out',
  };
  if (edge === 'top') return <div style={{ ...base, top: 0, left: 0, right: 0, height: '50%' }} />;
  if (edge === 'bottom') return <div style={{ ...base, bottom: 0, left: 0, right: 0, height: '50%' }} />;
  if (edge === 'left') return <div style={{ ...base, top: 0, bottom: 0, left: 0, width: '50%' }} />;
  return <div style={{ ...base, top: 0, bottom: 0, right: 0, width: '50%' }} />;
}

/** 全局 drag 事件监听：兜底设置 / 复位 isDragging */
export function useWorkspaceDragWatcher() {
  const setDragging = useWorkspaceStore(s => s.setDragging);
  useEffect(() => {
    const onStart = (e: globalThis.DragEvent) => {
      // dragstart 阶段 dataTransfer.types 是可读的，用来识别是否是 tab 拖拽
      const types = e.dataTransfer ? Array.from(e.dataTransfer.types) : [];
      if (types.includes(DRAG_MIME)) setDragging(true);
    };
    const onEnd = () => setDragging(false);
    const onDrop = () => setDragging(false);
    window.addEventListener('dragstart', onStart, true);
    window.addEventListener('dragend', onEnd, true);
    window.addEventListener('drop', onDrop, true);
    return () => {
      window.removeEventListener('dragstart', onStart, true);
      window.removeEventListener('dragend', onEnd, true);
      window.removeEventListener('drop', onDrop, true);
    };
  }, [setDragging]);
}
