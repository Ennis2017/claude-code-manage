import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { searchAll, SearchHit, SearchHitKind } from '../lib/fs-bridge';
import { useAppStore, Route } from '../store/app-store';

interface Props {
  open: boolean;
  onClose: () => void;
}

const KIND_LABEL: Record<SearchHitKind, string> = {
  settings: 'settings',
  settings_local: 'settings.local',
  keybindings: 'keybindings',
  memory: 'CLAUDE.md',
  mcp: '.mcp.json',
  command: '命令',
  skill: 'Skill',
  agent: 'Agent',
  other: '文件',
};

const KIND_TONE: Record<SearchHitKind, string> = {
  settings: 'orange',
  settings_local: 'orange',
  keybindings: 'sky',
  memory: 'leaf',
  mcp: 'plum',
  command: 'orange',
  skill: 'leaf',
  agent: 'plum',
  other: '',
};

function routeForHit(hit: SearchHit): Route | null {
  const isUser = hit.scope === 'user';
  switch (hit.kind) {
    case 'settings':
      return isUser
        ? { name: 'global', screen: 'settings' }
        : { name: 'project', id: hit.scope, screen: 'settings' };
    case 'settings_local':
      return { name: 'project', id: hit.scope, screen: 'local' };
    case 'keybindings':
      return { name: 'global', screen: 'keybindings' };
    case 'memory':
      return isUser
        ? { name: 'global', screen: 'memory' }
        : { name: 'project', id: hit.scope, screen: 'memory' };
    case 'mcp':
      return { name: 'project', id: hit.scope, screen: 'mcp' };
    case 'command':
      if (!hit.entry_name) return null;
      return isUser
        ? { name: 'global', screen: 'command', cmd: hit.entry_name }
        : { name: 'project', id: hit.scope, screen: 'command', cmd: hit.entry_name };
    case 'skill':
      if (!hit.entry_name) return null;
      return isUser
        ? { name: 'global', screen: 'skill', cmd: hit.entry_name }
        : { name: 'project', id: hit.scope, screen: 'skill', cmd: hit.entry_name };
    case 'agent':
      if (!hit.entry_name) return null;
      return isUser
        ? { name: 'global', screen: 'agent', cmd: hit.entry_name }
        : { name: 'project', id: hit.scope, screen: 'agent', cmd: hit.entry_name };
    case 'other':
      return null;
  }
}

function highlight(text: string, query: string, caseSensitive: boolean): ReactNode[] {
  if (!query) return [text];
  const q = caseSensitive ? query : query.toLowerCase();
  const probe = caseSensitive ? text : text.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const found = probe.indexOf(q, i);
    if (found === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (found > i) parts.push(text.slice(i, found));
    parts.push(
      <mark
        key={key++}
        style={{ background: 'var(--cc-orange-wash)', color: 'var(--cc-orange-deep)', padding: 0, borderRadius: 2 }}
      >
        {text.slice(found, found + q.length)}
      </mark>
    );
    i = found + q.length;
  }
  return parts;
}

export function CommandPalette({ open, onClose }: Props) {
  const { go } = useAppStore();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setError(null);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const results = await searchAll(q, { caseSensitive });
        if (!cancelled) {
          setHits(results);
          setActive(0);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setHits([]);
          setError(String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, caseSensitive]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-hit-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: { hit: SearchHit; idx: number }[] }>();
    hits.forEach((hit, idx) => {
      const key = hit.scope;
      if (!map.has(key)) map.set(key, { label: hit.scope_label, items: [] });
      map.get(key)!.items.push({ hit, idx });
    });
    return Array.from(map.values());
  }, [hits]);

  if (!open) return null;

  const pick = (idx: number) => {
    const hit = hits[idx];
    if (!hit) return;
    const route = routeForHit(hit);
    if (!route) return;
    go(route);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(31,27,22,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 96,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(a => Math.min(a + 1, hits.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(a => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(active);
          }
        }}
        style={{
          width: 680, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          background: 'var(--cc-bg-raised)', borderRadius: 14,
          boxShadow: '0 24px 80px rgba(31,27,22,0.35)',
          overflow: 'hidden',
        }}
      >
        {/* Input */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--cc-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, color: 'var(--cc-muted)' }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索文件名 / 文件内容…"
            style={{
              flex: 1, height: 28, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 14, fontFamily: 'inherit',
              color: 'var(--cc-ink)',
            }}
          />
          {loading && (
            <span style={{ fontSize: 11, color: 'var(--cc-muted)' }}>搜索中…</span>
          )}
          <button
            onClick={() => setCaseSensitive(v => !v)}
            title={caseSensitive ? '区分大小写（点击关闭）' : '不区分大小写（点击开启）'}
            style={{
              border: '1px solid var(--cc-line)', borderRadius: 4,
              padding: '2px 7px', fontSize: 11, fontFamily: 'inherit',
              cursor: 'pointer',
              background: caseSensitive ? 'var(--cc-orange-wash)' : 'transparent',
              color: caseSensitive ? 'var(--cc-orange-deep)' : 'var(--cc-muted)',
            }}
          >Aa</button>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--cc-muted-soft)', border: '1px solid var(--cc-line)', borderRadius: 4, padding: '2px 6px' }}>esc</span>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflow: 'auto' }}>
          {error && (
            <div style={{ padding: '20px 22px', fontSize: 12.5, color: '#B8543A' }}>搜索失败：{error}</div>
          )}
          {!error && query.trim().length === 0 && (
            <div style={{ padding: '32px 22px', fontSize: 12.5, color: 'var(--cc-muted)', textAlign: 'center' }}>
              输入关键字以搜索 <span className="mono">~/.claude</span> 与所有项目的文件名与内容
            </div>
          )}
          {!error && query.trim().length > 0 && !loading && hits.length === 0 && (
            <div style={{ padding: '32px 22px', fontSize: 12.5, color: 'var(--cc-muted)', textAlign: 'center' }}>未找到匹配项</div>
          )}
          {grouped.map(group => (
            <div key={group.label}>
              <div style={{
                padding: '10px 18px 6px', fontSize: 10.5, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--cc-muted)', fontWeight: 600,
                background: 'var(--cc-bg-sunk)',
              }}>{group.label}</div>
              {group.items.map(({ hit, idx }) => {
                const isActive = idx === active;
                const tone = KIND_TONE[hit.kind];
                return (
                  <div
                    key={`${hit.path}-${hit.line_number ?? 'name'}-${idx}`}
                    data-hit-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => pick(idx)}
                    style={{
                      cursor: 'pointer', padding: '10px 18px',
                      borderLeft: isActive ? '2px solid var(--cc-orange)' : '2px solid transparent',
                      background: isActive ? 'var(--cc-orange-wash)' : 'transparent',
                      paddingLeft: isActive ? 16 : 18,
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}
                  >
                    <span
                      className={`cc-chip${tone ? ' ' + tone : ''}`}
                      style={{ height: 18, fontSize: 10, flexShrink: 0, marginTop: 2 }}
                    >
                      {KIND_LABEL[hit.kind]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? 'var(--cc-orange-deep)' : 'var(--cc-ink-soft)' }}>
                        {hit.entry_name && hit.kind === 'command' ? `/${hit.entry_name}  ` : hit.entry_name ? `${hit.entry_name}  ` : ''}
                        <span style={{ color: 'var(--cc-muted)', fontWeight: 400 }}>{hit.display_path}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: hit.match_type === 'content' ? 'JetBrains Mono, monospace' : 'inherit' }}>
                        {hit.match_type === 'content' && hit.line_number != null && (
                          <span style={{ color: 'var(--cc-muted-soft)', marginRight: 8 }}>L{hit.line_number}</span>
                        )}
                        {highlight(hit.snippet, query, caseSensitive)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        {hits.length > 0 && (
          <div style={{
            padding: '8px 18px', borderTop: '1px solid var(--cc-line)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 10.5, color: 'var(--cc-muted)',
            background: 'var(--cc-bg-sunk)',
          }}>
            <span>{hits.length} 个结果</span>
            <span style={{ display: 'flex', gap: 12 }}>
              <span><span className="mono" style={{ border: '1px solid var(--cc-line)', borderRadius: 3, padding: '1px 5px' }}>↑↓</span> 选择</span>
              <span><span className="mono" style={{ border: '1px solid var(--cc-line)', borderRadius: 3, padding: '1px 5px' }}>↵</span> 打开</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
