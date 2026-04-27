import { ReactNode, useEffect } from 'react';
import {
  InnerEntry, PaneNode, ScopeId, TabContent, useWorkspaceStore,
} from '../../store/workspace-store';
import { InnerSidebar } from '../InnerSidebar';
import { Workspace, useWorkspaceDragWatcher } from './Workspace';
import { ShEditor } from './ShEditor';

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

export interface TabbedConfigShellProps {
  /** 工作区 scope（user 全局或 project id） */
  scopeId: ScopeId;
  /** 左侧 Rail（已经按业务配置好） */
  rail: ReactNode;
  /** InnerSidebar 内容分组 */
  sidebarSections: SidebarSection[];
  /** 首次进入 scope 时回填的 tab */
  initialFallback: TabContent;
  /** 把当前 active tab 内容映射回 sidebar 高亮 id；非 inner 内容返回空字符串 */
  contentToActiveId: (content: TabContent | undefined) => string;
  /** sidebar 点击 → InnerEntry */
  pickToInner: (id: string) => InnerEntry;
  /** 渲染 inner 类型 tab */
  renderInner: (inner: InnerEntry) => ReactNode;
  /** inner 类型 tab 的标题 */
  tabTitleForInner: (inner: InnerEntry) => string;
  /** 自定义 + 按钮；默认走 store.plusOpen（新建 overview tab） */
  onPlus?: () => void;
}

function findLeaf(node: PaneNode, id: string): PaneNode | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  return findLeaf(node.a, id) || findLeaf(node.b, id);
}

/**
 * 通用「Rail + InnerSidebar + Workspace（多 tab/分屏）」布局壳。
 * GlobalConfig / ProjectDetail 都走这一套，只通过 props 注入业务差异。
 */
export function TabbedConfigShell(p: TabbedConfigShellProps) {
  useWorkspaceDragWatcher();

  const ensureInitialTab = useWorkspaceStore(s => s.ensureInitialTab);
  const setActiveTabContent = useWorkspaceStore(s => s.setActiveTabContent);
  const plusOpen = useWorkspaceStore(s => s.plusOpen);
  const scope = useWorkspaceStore(s => s.scopes[p.scopeId]);

  // scopeId 变化（切到另一个项目）时也要保证有初始 tab
  useEffect(() => {
    ensureInitialTab(p.scopeId, p.initialFallback);
    // initialFallback 在切 scope 时由父组件给出
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.scopeId]);

  let activeContent: TabContent | undefined;
  if (scope) {
    const leaf = findLeaf(scope.paneTree, scope.activePaneId);
    if (leaf && leaf.type === 'leaf' && leaf.activeTabId) {
      activeContent = scope.tabs[leaf.activeTabId]?.content;
    }
  }
  const activeId = p.contentToActiveId(activeContent);

  const renderContent = (content: TabContent): ReactNode => {
    if (content.kind === 'file') {
      return <ShEditor path={content.path} language={content.language || 'shell'} />;
    }
    return p.renderInner(content.inner);
  };

  const tabTitle = (content: TabContent): string => {
    if (content.kind === 'file') return content.name;
    return p.tabTitleForInner(content.inner);
  };

  const onSidebarPick = (it: SidebarItem) => {
    setActiveTabContent(p.scopeId, { kind: 'inner', inner: p.pickToInner(it.id) });
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      {p.rail}
      <InnerSidebar sections={p.sidebarSections} activeId={activeId} onPick={onSidebarPick} />
      <Workspace
        scopeId={p.scopeId}
        renderers={{
          tabTitle,
          renderContent,
          onPlus: p.onPlus ?? (() => plusOpen(p.scopeId)),
        }}
      />
    </div>
  );
}
