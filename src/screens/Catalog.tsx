import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { Rail } from '../components/Rail';
import { ALL_COMMANDS, CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, countByCategory } from '../data/commands';

function kindLabel(focused: { category: string; kind?: 'skill' | 'flag' }): string {
  if (focused.kind === 'skill') return 'Bundled Skill';
  if (focused.kind === 'flag') return 'CLI Flag';
  if (focused.category === 'cli') return '终端命令';
  return '会话内斜杠命令';
}

async function copyText(text: string, onDone: (msg: string, tone?: 'success' | 'error') => void): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    onDone(`已复制：${text.length > 60 ? text.slice(0, 57) + '…' : text}`, 'success');
  } catch (e) {
    onDone(`复制失败：${String(e)}`, 'error');
  }
}

export function Catalog() {
  const { catalogSelected, catalogCategory, catalogQuery, set, toast_msg } = useAppStore();
  const { snapshot } = useConfigStore();
  const cliVersion = snapshot?.claude_code_version || '未检测到 CLI';

  const filtered = ALL_COMMANDS.filter(c => {
    if (catalogCategory !== 'all' && c.category !== catalogCategory) return false;
    if (catalogQuery && !(c.name + c.desc).toLowerCase().includes(catalogQuery.toLowerCase())) return false;
    return true;
  });

  const focused = ALL_COMMANDS.find(c => c.name === catalogSelected) || filtered[0] || ALL_COMMANDS[0];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <Rail active="docs" />

      {/* Category sidebar */}
      <aside style={{ width: 240, background: 'var(--cc-bg-raised)', borderRight: '1px solid var(--cc-line)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--cc-line)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cc-muted)', fontWeight: 600, marginBottom: 6 }}>{cliVersion}</div>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>命令百科</div>
        </div>
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 10, top: 7, color: 'var(--cc-muted)', fontSize: 12 }}>⌕</div>
            <input
              value={catalogQuery}
              onChange={e => set({ catalogQuery: e.target.value })}
              placeholder="搜索命令…"
              style={{ width: '100%', height: 30, border: '1px solid var(--cc-line-strong)', borderRadius: 7, padding: '0 10px 0 28px', background: 'var(--cc-bg-sunk)', fontSize: 12, fontFamily: 'inherit' }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cc-muted)', padding: '12px 12px 6px', fontWeight: 600 }}>斜杠分类</div>
          {CATEGORIES.map(c => {
            const isA = catalogCategory === c.id;
            const dotColor = c.id === 'all' ? undefined : c.color;
            const count = countByCategory(c.id);
            return (
              <div key={c.id} onClick={() => set({ catalogCategory: c.id })} className="inner-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, fontSize: 12.5, marginBottom: 1, cursor: 'pointer', color: isA ? 'var(--cc-orange-deep)' : 'var(--cc-ink-soft)', background: isA ? 'var(--cc-orange-wash)' : 'transparent' }}>
                {dotColor && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor === 'leaf' ? 'var(--cc-leaf)' : dotColor === 'sky' ? 'var(--cc-sky)' : dotColor === 'plum' ? 'var(--cc-plum)' : dotColor === 'ink' ? 'var(--cc-ink-soft)' : 'var(--cc-orange)', flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{c.label}</span>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: isA ? 'var(--cc-orange-deep)' : 'var(--cc-muted-soft)', opacity: isA ? 0.7 : 1 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* List + detail */}
      <div style={{ flex: 1, display: 'flex', background: 'var(--cc-bg)', overflow: 'hidden' }}>
        {/* Command list */}
        <div style={{ flex: '0 0 360px', borderRight: '1px solid var(--cc-line)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--cc-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>斜杠命令 <span style={{ color: 'var(--cc-muted-soft)', fontWeight: 400 }}>· {filtered.length}</span></div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filtered.map((cmd, i) => {
              const isActive = cmd.name === focused?.name;
              return (
                <div key={cmd.name} onClick={() => set({ catalogSelected: cmd.name })} style={{ cursor: 'pointer', padding: '12px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--cc-line)' : 'none', background: isActive ? 'var(--cc-orange-wash)' : 'transparent', borderLeft: isActive ? '2px solid var(--cc-orange)' : '2px solid transparent', paddingLeft: isActive ? 18 : 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--cc-orange-deep)' : 'var(--cc-ink)' }}>{cmd.name}</div>
                    <span style={{ fontSize: 10, color: isActive ? 'var(--cc-orange-deep)' : 'var(--cc-muted-soft)' }}>{CATEGORY_LABEL[cmd.category]}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cmd.desc}</div>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 20, fontSize: 12, color: 'var(--cc-muted)', textAlign: 'center' }}>没有匹配项</div>}
          </div>
        </div>

        {/* Detail panel */}
        {focused && (() => {
          const exampleText = focused.example || focused.usage;
          const showExample = !!focused.example && focused.example !== focused.usage;
          return (
          <div style={{ flex: 1, overflow: 'auto', padding: '30px 36px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className={`cc-chip ${CATEGORY_COLOR[focused.category] || ''}`} style={{ height: 20 }}>{CATEGORY_LABEL[focused.category]}</span>
              {focused.kind === 'skill' && <span className="cc-chip leaf" style={{ height: 20 }}>Skill</span>}
              {focused.kind === 'flag' && <span className="cc-chip" style={{ height: 20 }}>Flag</span>}
              <span style={{ fontSize: 11, color: 'var(--cc-muted)' }}>{kindLabel(focused)}</span>
              {focused.aliases && focused.aliases.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--cc-muted)' }}>
                  · 别名 <span className="mono" style={{ color: 'var(--cc-ink-soft)' }}>{focused.aliases.join(' · ')}</span>
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h1 className="mono" style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em' }}>{focused.name}</h1>
              <button
                onClick={() => copyText(focused.name, toast_msg)}
                title="复制命令名"
                style={iconBtnStyle}
              >📋 复制名称</button>
            </div>
            <div className="serif" style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--cc-ink-soft)', marginBottom: 22, maxWidth: 640 }}>{focused.desc}</div>
            <div style={{ background: 'var(--cc-ink)', borderRadius: 12, padding: '18px 22px', marginBottom: 22, color: '#F7E9E0', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B8178', fontWeight: 600 }}>用法</div>
                <button
                  onClick={() => copyText(focused.usage, toast_msg)}
                  style={darkIconBtnStyle}
                  title="复制 usage"
                >复制</button>
              </div>
              <div style={{ marginBottom: showExample ? 14 : 0, wordBreak: 'break-all' }}><span style={{ color: '#8B8178' }}>$</span> <span style={{ color: '#F7B97D' }}>{focused.usage}</span></div>
              {showExample && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingTop: 14, borderTop: '1px solid #2D2822' }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B8178', fontWeight: 600 }}>示例</div>
                    <button
                      onClick={() => copyText(exampleText, toast_msg)}
                      style={darkIconBtnStyle}
                      title="复制示例"
                    >复制</button>
                  </div>
                  <div style={{ wordBreak: 'break-all' }}>{exampleText}</div>
                </>
              )}
            </div>
            {focused.notes && (
              <div style={{ background: '#FFF9F3', border: '1px solid #EDD6C5', borderRadius: 10, padding: '14px 18px', fontSize: 12.5, color: 'var(--cc-ink-soft)', lineHeight: 1.55 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cc-orange-deep)', marginRight: 6, letterSpacing: '0.05em' }}>NOTE</span>
                {focused.notes}
              </div>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  height: 26, padding: '0 10px', borderRadius: 6,
  background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line-strong)',
  fontSize: 11.5, cursor: 'pointer', color: 'var(--cc-ink-soft)',
  fontFamily: 'inherit',
};

const darkIconBtnStyle: React.CSSProperties = {
  height: 22, padding: '0 8px', borderRadius: 5,
  background: 'rgba(255,255,255,0.08)', border: '1px solid #3D3833',
  fontSize: 10.5, cursor: 'pointer', color: '#F7E9E0',
  fontFamily: 'inherit',
};
