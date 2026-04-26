import { ReactNode, useEffect, useState } from 'react';
import { Rail } from '../components/Rail';
import { Topbar } from '../components/Topbar';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { writeJsonFile, revealInFinder, detectExternalChange } from '../lib/fs-bridge';
import {
  HOOK_EVENTS, HOOK_EVENT_DESC, SUPPORTS_MATCHER,
  HookEvent, HookGroup, HookCommand, HooksConfig,
  parseHooks, serializeHooks, emptyGroup,
} from '../lib/hooks-schema';

type RailKey = 'user' | 'projects';

interface Props {
  sidebar: ReactNode;
  railKey: RailKey;
  railProjectId?: string;
  crumbs: { label: string; onClick?: () => void }[];
  scopeChip: { label: string; tone: 'orange' | 'leaf' | 'sky' | 'plum' };
  filePath: string;
  settingsRaw: Record<string, unknown>;
  initialMtime: string;
  sizeBytes: number;
}

export function HooksScreen(props: Props) {
  const { sidebar, railKey, railProjectId, crumbs, scopeChip, filePath, settingsRaw, initialMtime, sizeBytes } = props;
  const { toast_msg } = useAppStore();
  const { scanAll } = useConfigStore();

  const initialHooks = parseHooks(settingsRaw.hooks);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HooksConfig>(initialHooks);
  const [baseline, setBaseline] = useState<HooksConfig>(initialHooks);
  const [editorMtime, setEditorMtime] = useState(initialMtime);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      const fresh = parseHooks(settingsRaw.hooks);
      setDraft(fresh);
      setBaseline(fresh);
      setEditorMtime(initialMtime);
    }
  }, [settingsRaw, initialMtime, editing]);

  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(baseline);
  const view = editing ? draft : initialHooks;

  const updateEvent = (ev: HookEvent, groups: HookGroup[]) => {
    setDraft(prev => ({ ...prev, [ev]: groups }));
  };

  const enterEdit = () => {
    setDraft(initialHooks);
    setBaseline(initialHooks);
    setEditorMtime(initialMtime);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft(baseline);
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const changed = await detectExternalChange(filePath, editorMtime).catch(() => false);
      if (changed) {
        toast_msg('settings.json 已被外部修改，请刷新后重试', 'error');
        setSaving(false);
        return;
      }
      const next = { ...settingsRaw };
      const serialized = serializeHooks(draft);
      if (serialized && Object.keys(serialized).length > 0) {
        next.hooks = serialized;
      } else {
        delete next.hooks;
      }
      const text = JSON.stringify(next, null, 2) + '\n';
      const result = await writeJsonFile(filePath, text, editorMtime);
      setBaseline(draft);
      setEditorMtime(result.mtime);
      setEditing(false);
      toast_msg('已保存 · Hooks', 'success');
      scanAll();
    } catch (e) {
      toast_msg(`保存失败：${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const onReveal = async () => {
    try { await revealInFinder(filePath); } catch (e) { toast_msg(`无法打开 Finder：${String(e)}`, 'error'); }
  };

  const totalHooks = HOOK_EVENTS.reduce((sum, ev) => {
    const groups = view[ev] || [];
    return sum + groups.reduce((s, g) => s + g.hooks.length, 0);
  }, 0);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
      <Rail active={railKey} projectId={railProjectId} />
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', overflow: 'hidden' }}>
        {editing ? (
          <div style={{ height: 52, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF4EC', borderBottom: '1px solid #EDD6C5', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, background: 'var(--cc-orange)', color: 'white', fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                <span>编辑中</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--cc-ink-soft)' }}>
                Hooks {dirty && <span style={{ color: 'var(--cc-orange-deep)', fontWeight: 500 }}>· 未保存</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="cc-btn ghost" onClick={cancelEdit} disabled={saving}>取消</button>
              <button className="cc-btn primary" onClick={doSave} disabled={saving || !dirty}>{saving ? '保存中…' : '保存'}</button>
            </div>
          </div>
        ) : (
          <Topbar
            crumbs={crumbs}
            right={
              <>
                <div style={{ fontSize: 11, color: 'var(--cc-muted)', display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cc-muted-soft)' }} />
                  <span>只读</span>
                </div>
                <button className="cc-btn ghost" onClick={onReveal}>在 Finder 中显示</button>
                <button className="cc-btn primary" onClick={enterEdit}>✎ 编辑</button>
              </>
            }
          />
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px 32px' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Hooks</h1>
              <span className={`cc-chip ${scopeChip.tone}`} style={{ height: 20 }}>{scopeChip.label}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span className="mono">{filePath}</span>
              <span>· {totalHooks} 个 hook · 修改于 {editorMtime || '—'} · {(sizeBytes / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {HOOK_EVENTS.map(ev => (
              <EventCard
                key={ev}
                event={ev}
                groups={view[ev] || []}
                editing={editing}
                onChange={(g) => updateEvent(ev, g)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, groups, editing, onChange }: {
  event: HookEvent; groups: HookGroup[]; editing: boolean; onChange: (g: HookGroup[]) => void;
}) {
  const tone = eventTone(event);
  const supportsMatcher = SUPPORTS_MATCHER[event];

  const updateGroup = (i: number, g: HookGroup) => {
    onChange(groups.map((it, idx) => idx === i ? g : it));
  };
  const removeGroup = (i: number) => onChange(groups.filter((_, idx) => idx !== i));
  const addGroup = () => onChange([...groups, emptyGroup(event)]);

  const totalHooks = groups.reduce((s, g) => s + g.hooks.length, 0);

  return (
    <div style={{
      background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: groups.length > 0 ? '1px solid var(--cc-line)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span className={`cc-chip ${tone}`} style={{ height: 22, fontSize: 11.5 }}>{event}</span>
          <span style={{ fontSize: 11.5, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {HOOK_EVENT_DESC[event]}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--cc-muted-soft)' }}>{totalHooks}</span>
          {editing && (
            <button className="cc-btn ghost" style={{ height: 24, fontSize: 11.5 }} onClick={addGroup}>＋ 添加</button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        !editing ? null : (
          <div style={{ padding: '14px 18px', fontSize: 12, color: 'var(--cc-muted-soft)', fontStyle: 'italic' }}>
            暂无配置 · 点击右上角"添加"创建新组
          </div>
        )
      ) : (
        <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map((g, i) => (
            <GroupCard
              key={i}
              group={g}
              editing={editing}
              supportsMatcher={supportsMatcher}
              onChange={(next) => updateGroup(i, next)}
              onRemove={() => removeGroup(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, editing, supportsMatcher, onChange, onRemove }: {
  group: HookGroup; editing: boolean; supportsMatcher: boolean;
  onChange: (g: HookGroup) => void; onRemove: () => void;
}) {
  const updateHook = (i: number, h: HookCommand) => {
    onChange({ ...group, hooks: group.hooks.map((it, idx) => idx === i ? h : it) });
  };
  const removeHook = (i: number) => {
    onChange({ ...group, hooks: group.hooks.filter((_, idx) => idx !== i) });
  };
  const addHook = () => {
    onChange({ ...group, hooks: [...group.hooks, { type: 'command', command: '' }] });
  };

  return (
    <div style={{
      background: 'var(--cc-bg)', border: '1px solid var(--cc-line)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      {supportsMatcher && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--cc-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 64 }}>Matcher</span>
          {editing ? (
            <>
              <input
                value={group.matcher || ''}
                onChange={e => onChange({ ...group, matcher: e.target.value })}
                placeholder="Edit|Write|Bash …"
                className="mono"
                style={inputStyle()}
              />
              <button className="cc-btn ghost" style={{ height: 24, fontSize: 11.5, color: 'var(--cc-orange-deep)' }} onClick={onRemove}>移除组</button>
            </>
          ) : (
            <span className="mono" style={{ fontSize: 12, color: 'var(--cc-ink-soft)' }}>
              {group.matcher || <span style={{ color: 'var(--cc-muted-soft)' }}>（匹配所有工具）</span>}
            </span>
          )}
        </div>
      )}
      {!supportsMatcher && editing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="cc-btn ghost" style={{ height: 24, fontSize: 11.5, color: 'var(--cc-orange-deep)' }} onClick={onRemove}>移除组</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {group.hooks.map((h, i) => (
          <HookRow
            key={i}
            hook={h}
            editing={editing}
            onChange={(next) => updateHook(i, next)}
            onRemove={() => removeHook(i)}
          />
        ))}
        {editing && (
          <button className="cc-btn ghost" style={{ alignSelf: 'flex-start', height: 26, fontSize: 11.5, color: 'var(--cc-orange-deep)' }} onClick={addHook}>＋ 添加 Hook</button>
        )}
      </div>
    </div>
  );
}

function HookRow({ hook, editing, onChange, onRemove }: {
  hook: HookCommand; editing: boolean;
  onChange: (h: HookCommand) => void; onRemove: () => void;
}) {
  return (
    <div style={{
      background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)',
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: editing ? 8 : 0 }}>
        <span style={{
          width: 36, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 600,
          background: 'var(--cc-bg-sunk)', color: 'var(--cc-muted)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace',
        }}>cmd</span>
        {editing ? (
          <textarea
            value={hook.command}
            onChange={e => onChange({ ...hook, command: e.target.value })}
            placeholder="echo &quot;hello&quot; >> /tmp/log"
            className="mono"
            rows={Math.min(6, Math.max(1, hook.command.split('\n').length))}
            style={{ ...inputStyle(), flex: 1, minHeight: 28, padding: '6px 10px', resize: 'vertical', lineHeight: 1.55 }}
          />
        ) : (
          <pre className="mono" style={{
            flex: 1, fontSize: 12, color: 'var(--cc-ink-soft)', whiteSpace: 'pre-wrap',
            wordBreak: 'break-all', margin: 0, lineHeight: 1.55,
          }}>{hook.command || <span style={{ color: 'var(--cc-muted-soft)' }}>（空）</span>}</pre>
        )}
        {editing && (
          <button onClick={onRemove} title="删除" style={{
            background: 'transparent', border: 'none', color: 'var(--cc-muted)', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, padding: '2px 6px',
          }}>×</button>
        )}
      </div>
      {(editing || typeof hook.timeout === 'number') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 44 }}>
          <span style={{ fontSize: 10.5, color: 'var(--cc-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Timeout</span>
          {editing ? (
            <input
              type="number"
              min={0}
              value={hook.timeout ?? ''}
              onChange={e => {
                const v = e.target.value === '' ? undefined : Number(e.target.value);
                onChange({ ...hook, timeout: v });
              }}
              placeholder="—"
              className="mono"
              style={{ ...inputStyle(), width: 72, textAlign: 'center' }}
            />
          ) : (
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--cc-ink-soft)' }}>{hook.timeout}</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--cc-muted)' }}>秒</span>
        </div>
      )}
    </div>
  );
}

function eventTone(ev: HookEvent): 'orange' | 'leaf' | 'sky' | 'plum' {
  if (ev === 'PreToolUse' || ev === 'PostToolUse') return 'orange';
  if (ev === 'Stop' || ev === 'SubagentStop') return 'leaf';
  if (ev === 'UserPromptSubmit') return 'sky';
  return 'plum';
}

function inputStyle(): React.CSSProperties {
  return {
    flex: 1,
    height: 28,
    padding: '0 10px',
    fontSize: 12,
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    color: 'var(--cc-ink)',
    background: 'var(--cc-bg-raised)',
    border: '1px solid var(--cc-line)',
    borderRadius: 6,
    outline: 'none',
  };
}
