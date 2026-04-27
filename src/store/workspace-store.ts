import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ───────────────── 类型 ───────────────── */

export type SplitEdge = 'top' | 'bottom' | 'left' | 'right';

/** 每个 InnerSidebar 条目对应一种"内置视图"，Tab 选中其中之一时第三列就渲染对应屏幕 */
export type InnerEntry =
  | { entry: 'overview' }
  | { entry: 'settings' }
  | { entry: 'local' }
  | { entry: 'permissions' }
  | { entry: 'hooks' }
  | { entry: 'mcp' }
  | { entry: 'keybindings' }
  | { entry: 'memory' }
  | { entry: 'command'; name: string }
  | { entry: 'skill'; name: string }
  | { entry: 'agent'; name: string }
  | { entry: 'rule'; name: string };

/** Tab 内容：要么是 InnerSidebar 中的一个条目，要么是任意文本文件（如 sh） */
export type TabContent =
  | { kind: 'inner'; inner: InnerEntry }
  | { kind: 'file'; path: string; name: string; language: string };

export interface FileTab {
  id: string;
  content: TabContent;
}

export interface LeafPane {
  type: 'leaf';
  id: string;
  tabIds: string[];
  activeTabId: string | null;
}

export interface SplitPane {
  type: 'split';
  id: string;
  /** horizontal = 上下；vertical = 左右 */
  direction: 'horizontal' | 'vertical';
  ratio: number;
  a: PaneNode;
  b: PaneNode;
}

export type PaneNode = LeafPane | SplitPane;

export interface ScopeWorkspace {
  paneTree: PaneNode;
  activePaneId: string;
  tabs: Record<string, FileTab>;
}

/** scope = 'user' 或 project 的 id（与 useAppStore.route.id 对齐） */
export type ScopeId = string;

/* ───────────────── 工具 ───────────────── */

const MAX_LEAVES = 4;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function newLeaf(tabIds: string[] = []): LeafPane {
  return { type: 'leaf', id: uid('p'), tabIds, activeTabId: tabIds[0] ?? null };
}

function countLeaves(node: PaneNode): number {
  return node.type === 'leaf' ? 1 : countLeaves(node.a) + countLeaves(node.b);
}

function findLeaf(node: PaneNode, id: string): LeafPane | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  return findLeaf(node.a, id) || findLeaf(node.b, id);
}


function replaceNode(tree: PaneNode, id: string, next: PaneNode): PaneNode {
  if (tree.id === id) return next;
  if (tree.type === 'leaf') return tree;
  const a = replaceNode(tree.a, id, next);
  const b = replaceNode(tree.b, id, next);
  if (a === tree.a && b === tree.b) return tree;
  return { ...tree, a, b };
}

function collapseEmptyLeaves(tree: PaneNode): PaneNode {
  if (tree.type === 'leaf') return tree;
  const a = collapseEmptyLeaves(tree.a);
  const b = collapseEmptyLeaves(tree.b);
  if (a.type === 'leaf' && a.tabIds.length === 0) return b;
  if (b.type === 'leaf' && b.tabIds.length === 0) return a;
  if (a === tree.a && b === tree.b) return tree;
  return { ...tree, a, b };
}

function firstLeafId(node: PaneNode): string {
  return node.type === 'leaf' ? node.id : firstLeafId(node.a);
}

function leafRemoveTab(leaf: LeafPane, tabId: string): LeafPane {
  const i = leaf.tabIds.indexOf(tabId);
  if (i < 0) return leaf;
  const tabIds = leaf.tabIds.filter(id => id !== tabId);
  let activeTabId: string | null = leaf.activeTabId;
  if (leaf.activeTabId === tabId) {
    activeTabId = tabIds[i] ?? tabIds[i - 1] ?? null;
  }
  return { ...leaf, tabIds, activeTabId };
}

function freshScope(): ScopeWorkspace {
  const leaf = newLeaf();
  return { paneTree: leaf, activePaneId: leaf.id, tabs: {} };
}

/** 比较两个 TabContent 是否指向同一份内容 */
export function sameContent(a: TabContent, b: TabContent): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'file' && b.kind === 'file') return a.path === b.path;
  if (a.kind === 'inner' && b.kind === 'inner') {
    if (a.inner.entry !== b.inner.entry) return false;
    const an = (a.inner as { name?: string }).name;
    const bn = (b.inner as { name?: string }).name;
    return an === bn;
  }
  return false;
}

/* ───────────────── store ───────────────── */

export interface WorkspaceState {
  scopes: Record<ScopeId, ScopeWorkspace>;
  isDragging: boolean;

  /** 取一个 scope 的工作区；不存在则创建空 */
  getScope: (scopeId: ScopeId) => ScopeWorkspace;
  /** 确保 scope 存在，且至少有一个 tab；若空则用 fallback 内容创建 */
  ensureInitialTab: (scopeId: ScopeId, fallback: TabContent) => void;
  /** 把 active pane 的 active tab 指向 content；若 active pane 没有 tab，则新建一个 tab */
  setActiveTabContent: (scopeId: ScopeId, content: TabContent) => void;
  /** 在 active pane 新增一个 tab */
  openTab: (scopeId: ScopeId, content: TabContent, opts?: { activate?: boolean }) => void;
  /** "+" 按钮：默认 settings.json；若当前 active tab 已经是 settings.json，则复制当前 tab */
  plusOpen: (scopeId: ScopeId) => void;
  closeTab: (scopeId: ScopeId, paneId: string, tabId: string) => void;
  activateTab: (scopeId: ScopeId, paneId: string, tabId: string) => void;
  focusPane: (scopeId: ScopeId, paneId: string) => void;
  splitOrMove: (
    scopeId: ScopeId,
    targetPaneId: string,
    edge: SplitEdge | 'center',
    srcPaneId: string,
    srcTabId: string,
  ) => void;
  setSplitRatio: (scopeId: ScopeId, splitId: string, ratio: number) => void;
  setDragging: (b: boolean) => void;
  /** 清理 scope：保留 keep 列表（一般是 ['user', 当前项目id]），其余非 user scope 全部移除 */
  clearScopesExcept: (keep: ScopeId[]) => void;
}

function patchScope(
  state: WorkspaceState,
  scopeId: ScopeId,
  fn: (ws: ScopeWorkspace) => ScopeWorkspace,
): Partial<WorkspaceState> {
  const cur = state.scopes[scopeId] ?? freshScope();
  const next = fn(cur);
  if (next === cur) return {};
  return { scopes: { ...state.scopes, [scopeId]: next } };
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      scopes: {},
      isDragging: false,

      getScope: (scopeId) => {
        const cur = get().scopes[scopeId];
        if (cur) return cur;
        const fresh = freshScope();
        set(s => ({ scopes: { ...s.scopes, [scopeId]: fresh } }));
        return fresh;
      },

      ensureInitialTab: (scopeId, fallback) => {
        set(s => patchScope(s, scopeId, ws => {
          if (Object.keys(ws.tabs).length > 0) return ws;
          const tab: FileTab = { id: uid('t'), content: fallback };
          const leaf = ws.paneTree.type === 'leaf'
            ? { ...ws.paneTree, tabIds: [tab.id], activeTabId: tab.id }
            : ws.paneTree;
          return {
            ...ws,
            tabs: { ...ws.tabs, [tab.id]: tab },
            paneTree: leaf,
            activePaneId: leaf.type === 'leaf' ? leaf.id : firstLeafId(leaf),
          };
        }));
      },

      setActiveTabContent: (scopeId, content) => {
        set(s => patchScope(s, scopeId, ws => {
          const leaf = findLeaf(ws.paneTree, ws.activePaneId);
          if (!leaf) return ws;
          // 优先检查 active tab：若 active 已经匹配 → 直接 no-op（避免跨 tab 切换）
          if (leaf.activeTabId) {
            const activeT = ws.tabs[leaf.activeTabId];
            if (activeT && sameContent(activeT.content, content)) return ws;
          }
          // 否则查找 pane 内是否有相同内容的 tab，激活它
          for (const tid of leaf.tabIds) {
            const t = ws.tabs[tid];
            if (t && sameContent(t.content, content)) {
              if (leaf.activeTabId === tid) return ws;
              return {
                ...ws,
                paneTree: replaceNode(ws.paneTree, leaf.id, { ...leaf, activeTabId: tid }),
              };
            }
          }
          // 当前 active tab 是 inner 类型 → 直接替换内容（侧栏切换时不无限增加 tab）
          // 当前 active tab 是 file（如 sh 编辑器）→ 不替换，新开 tab 避免误关 sh
          if (leaf.activeTabId) {
            const t = ws.tabs[leaf.activeTabId];
            if (t && t.content.kind === 'inner') {
              return {
                ...ws,
                tabs: { ...ws.tabs, [t.id]: { ...t, content } },
              };
            }
          }
          // active 为空 / 是 file：新建一个 tab
          const newTab: FileTab = { id: uid('t'), content };
          const leafUpd: LeafPane = { ...leaf, tabIds: [...leaf.tabIds, newTab.id], activeTabId: newTab.id };
          return {
            ...ws,
            tabs: { ...ws.tabs, [newTab.id]: newTab },
            paneTree: replaceNode(ws.paneTree, leaf.id, leafUpd),
          };
        }));
      },

      openTab: (scopeId, content, opts) => {
        const activate = opts?.activate ?? true;
        set(s => patchScope(s, scopeId, ws => {
          const leaf = findLeaf(ws.paneTree, ws.activePaneId);
          if (!leaf) return ws;
          // 同 pane 已存在相同内容 → 激活
          for (const tid of leaf.tabIds) {
            const t = ws.tabs[tid];
            if (t && sameContent(t.content, content)) {
              return {
                ...ws,
                paneTree: replaceNode(ws.paneTree, leaf.id, { ...leaf, activeTabId: tid }),
              };
            }
          }
          const newTab: FileTab = { id: uid('t'), content };
          const leafUpd: LeafPane = {
            ...leaf,
            tabIds: [...leaf.tabIds, newTab.id],
            activeTabId: activate ? newTab.id : leaf.activeTabId,
          };
          return {
            ...ws,
            tabs: { ...ws.tabs, [newTab.id]: newTab },
            paneTree: replaceNode(ws.paneTree, leaf.id, leafUpd),
          };
        }));
      },

      plusOpen: (scopeId) => {
        set(s => patchScope(s, scopeId, ws => {
          const leaf = findLeaf(ws.paneTree, ws.activePaneId);
          if (!leaf) return ws;
          // 默认开概览页（user / project 共用 'overview' 入口）
          const content: TabContent = { kind: 'inner', inner: { entry: 'overview' } };
          const newTab: FileTab = { id: uid('t'), content };
          const leafUpd: LeafPane = {
            ...leaf,
            tabIds: [...leaf.tabIds, newTab.id],
            activeTabId: newTab.id,
          };
          return {
            ...ws,
            tabs: { ...ws.tabs, [newTab.id]: newTab },
            paneTree: replaceNode(ws.paneTree, leaf.id, leafUpd),
          };
        }));
      },

      closeTab: (scopeId, paneId, tabId) => {
        set(s => patchScope(s, scopeId, ws => {
          const leaf = findLeaf(ws.paneTree, paneId);
          if (!leaf) return ws;
          const leafUpd = leafRemoveTab(leaf, tabId);
          let nextTree: PaneNode = replaceNode(ws.paneTree, leaf.id, leafUpd);
          nextTree = collapseEmptyLeaves(nextTree);
          const { [tabId]: _drop, ...restTabs } = ws.tabs;
          const stillExists = findLeaf(nextTree, ws.activePaneId);
          return {
            ...ws,
            paneTree: nextTree,
            tabs: restTabs,
            activePaneId: stillExists ? ws.activePaneId : firstLeafId(nextTree),
          };
        }));
      },

      activateTab: (scopeId, paneId, tabId) => {
        set(s => patchScope(s, scopeId, ws => {
          const leaf = findLeaf(ws.paneTree, paneId);
          if (!leaf || !leaf.tabIds.includes(tabId)) return ws;
          if (leaf.activeTabId === tabId && ws.activePaneId === paneId) return ws;
          return {
            ...ws,
            paneTree: replaceNode(ws.paneTree, leaf.id, { ...leaf, activeTabId: tabId }),
            activePaneId: paneId,
          };
        }));
      },

      focusPane: (scopeId, paneId) => {
        set(s => patchScope(s, scopeId, ws => {
          if (ws.activePaneId === paneId) return ws;
          if (!findLeaf(ws.paneTree, paneId)) return ws;
          return { ...ws, activePaneId: paneId };
        }));
      },

      splitOrMove: (scopeId, targetPaneId, edge, srcPaneId, srcTabId) => {
        set(s => patchScope(s, scopeId, ws => {
          const target = findLeaf(ws.paneTree, targetPaneId);
          const src = findLeaf(ws.paneTree, srcPaneId);
          if (!target || !src || !ws.tabs[srcTabId]) return ws;

          if (edge === 'center') {
            if (target.id === src.id) return ws; // 同 pane 内 noop
            const srcUpdated = leafRemoveTab(src, srcTabId);
            const targetUpdated: LeafPane = {
              ...target,
              tabIds: [...target.tabIds, srcTabId],
              activeTabId: srcTabId,
            };
            let next: PaneNode = replaceNode(ws.paneTree, src.id, srcUpdated);
            next = replaceNode(next, target.id, targetUpdated);
            next = collapseEmptyLeaves(next);
            return {
              ...ws,
              paneTree: next,
              activePaneId: findLeaf(next, target.id) ? target.id : firstLeafId(next),
            };
          }

          // 拆分
          if (src.id === target.id && src.tabIds.length === 1) return ws;
          if (countLeaves(ws.paneTree) >= MAX_LEAVES) {
            // 超上限：降级为移动
            if (target.id === src.id) return ws;
            const srcUpdated = leafRemoveTab(src, srcTabId);
            const targetUpdated: LeafPane = {
              ...target,
              tabIds: [...target.tabIds, srcTabId],
              activeTabId: srcTabId,
            };
            let next: PaneNode = replaceNode(ws.paneTree, src.id, srcUpdated);
            next = replaceNode(next, target.id, targetUpdated);
            next = collapseEmptyLeaves(next);
            return { ...ws, paneTree: next, activePaneId: target.id };
          }
          const srcUpdated = leafRemoveTab(src, srcTabId);
          const newLeafForTab = newLeaf([srcTabId]);
          // 同 pane 拆分时，留在原地的那一半要用「移除了 srcTab 的 srcUpdated」，否则同一 tab 会出现在两边
          const targetForSplit: LeafPane = src.id === target.id ? srcUpdated : target;
          const direction: 'horizontal' | 'vertical' =
            edge === 'top' || edge === 'bottom' ? 'horizontal' : 'vertical';
          const newSplit: SplitPane = {
            type: 'split',
            id: uid('s'),
            direction,
            ratio: 0.5,
            a: edge === 'top' || edge === 'left' ? newLeafForTab : targetForSplit,
            b: edge === 'top' || edge === 'left' ? targetForSplit : newLeafForTab,
          };
          let next: PaneNode = ws.paneTree;
          if (src.id !== target.id) next = replaceNode(next, src.id, srcUpdated);
          next = replaceNode(next, target.id, newSplit);
          next = collapseEmptyLeaves(next);
          return { ...ws, paneTree: next, activePaneId: newLeafForTab.id };
        }));
      },

      setSplitRatio: (scopeId, splitId, ratio) => {
        const clamp = Math.max(0.15, Math.min(0.85, ratio));
        set(s => patchScope(s, scopeId, ws => {
          const apply = (n: PaneNode): PaneNode => {
            if (n.type === 'leaf') return n;
            if (n.id === splitId) return { ...n, ratio: clamp };
            const a = apply(n.a);
            const b = apply(n.b);
            if (a === n.a && b === n.b) return n;
            return { ...n, a, b };
          };
          return { ...ws, paneTree: apply(ws.paneTree) };
        }));
      },

      setDragging: (b) => set({ isDragging: b }),

      clearScopesExcept: (keep) => {
        const keepSet = new Set(keep);
        set(s => {
          const next: Record<ScopeId, ScopeWorkspace> = {};
          let changed = false;
          for (const [k, v] of Object.entries(s.scopes)) {
            if (keepSet.has(k)) next[k] = v;
            else changed = true;
          }
          if (!changed) return {};
          return { scopes: next };
        });
      },
    }),
    {
      name: 'ccm-workspace-v2',
      // 仅持久化 user scope，项目 scope 切走即丢
      partialize: (s) => ({
        scopes: s.scopes['user'] ? { user: s.scopes['user'] } : {},
      }),
    }
  )
);

export const WORKSPACE_MAX_LEAVES = MAX_LEAVES;

// 调试用：暴露 store 到 window，方便在 DevTools 控制台查看 / 改动状态
if (typeof window !== 'undefined') {
  (window as unknown as { useWorkspaceStore: typeof useWorkspaceStore }).useWorkspaceStore = useWorkspaceStore;
}
