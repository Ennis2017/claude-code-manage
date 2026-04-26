import { ReactNode, useEffect, useState } from 'react';
import { Rail } from '../components/Rail';
import { Topbar } from '../components/Topbar';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { writeJsonFile, revealInFinder, detectExternalChange } from '../lib/fs-bridge';
import {
  PermissionsConfig, PermissionMode, PERMISSION_MODES, PERMISSION_MODE_DESC,
  parsePermissions, serializePermissions,
} from '../lib/permissions-schema';

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

export function PermissionsScreen(props: Props) {
  const { sidebar, railKey, railProjectId, crumbs, scopeChip, filePath, settingsRaw, initialMtime, sizeBytes } = props;
  const { toast_msg } = useAppStore();
  const { scanAll } = useConfigStore();

  const initial = parsePermissions(settingsRaw.permissions);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PermissionsConfig>(initial);
  const [baseline, setBaseline] = useState<PermissionsConfig>(initial);
  const [editorMtime, setEditorMtime] = useState(initialMtime);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      const fresh = parsePermissions(settingsRaw.permissions);
      setDraft(fresh);
      setBaseline(fresh);
      setEditorMtime(initialMtime);
    }
  }, [settingsRaw, initialMtime, editing]);

  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(baseline);
  const view = editing ? draft : initial;

  const enterEdit = () => {
    setDraft(initial);
    setBaseline(initial);
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
      const serialized = serializePermissions(draft);
      if (serialized) {
        next.permissions = serialized;
      } else {
        delete next.permissions;
      }
      const text = JSON.stringify(next, null, 2) + '\n';
      const result = await writeJsonFile(filePath, text, editorMtime);
      setBaseline(draft);
      setEditorMtime(result.mtime);
      setEditing(false);
      toast_msg('已保存 · Permissions', 'success');
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

  const total = view.allow.length + view.deny.length + view.ask.length;

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
                Permissions {dirty && <span style={{ color: 'var(--cc-orange-deep)', fontWeight: 500 }}>· 未保存</span>}
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
              <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Permissions</h1>
              <span className={`cc-chip ${scopeChip.tone}`} style={{ height: 20 }}>{scopeChip.label}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span className="mono">{filePath}</span>
              <span>· {total} 条规则 · 修改于 {editorMtime || '—'} · {(sizeBytes / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          <div style={{
            background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cc-ink-soft)' }}>默认权限模式</span>
              <span style={{ fontSize: 11, color: 'var(--cc-muted)' }}>
                {view.defaultMode ? PERMISSION_MODE_DESC[view.defaultMode] : '未设置 · 使用 Claude 默认行为'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['', ...PERMISSION_MODES] as ('' | PermissionMode)[]).map(m => {
                const isActive = (m === '' && !view.defaultMode) || (m !== '' && view.defaultMode === m);
                const label = m === '' ? '（未设置）' : m;
                return (
                  <button
                    key={m || 'unset'}
                    onClick={editing ? () => setDraft(d => ({ ...d, defaultMode: m === '' ? undefined : m })) : undefined}
                    disabled={!editing}
                    style={{
                      padding: '6px 12px', borderRadius: 7, fontSize: 11.5,
                      border: '1px solid', cursor: editing ? 'pointer' : 'default',
                      background: isActive ? 'var(--cc-orange)' : 'var(--cc-bg-raised)',
                      color: isActive ? 'white' : 'var(--cc-ink-soft)',
                      borderColor: isActive ? 'var(--cc-orange-deep)' : 'var(--cc-line)',
                      fontWeight: isActive ? 500 : 400, fontFamily: 'JetBrains Mono, monospace',
                      opacity: editing ? 1 : (isActive ? 1 : 0.55),
                    }}
                  >{label}</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <RuleListCard
              title="Allow"
              tone="leaf"
              hint="自动允许的工具 / 命令"
              items={view.allow}
              editing={editing}
              onChange={items => setDraft(d => ({ ...d, allow: items }))}
            />
            <RuleListCard
              title="Ask"
              tone="orange"
              hint="始终询问确认的工具 / 命令"
              items={view.ask}
              editing={editing}
              onChange={items => setDraft(d => ({ ...d, ask: items }))}
            />
            <RuleListCard
              title="Deny"
              tone="plum"
              hint="禁止使用的工具 / 命令"
              items={view.deny}
              editing={editing}
              onChange={items => setDraft(d => ({ ...d, deny: items }))}
            />
            <RuleListCard
              title="Additional Directories"
              tone="sky"
              hint="允许 Claude 读写的额外目录（绝对路径）"
              items={view.additionalDirectories}
              editing={editing}
              onChange={items => setDraft(d => ({ ...d, additionalDirectories: items }))}
              placeholder="/Users/you/some/project"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleListCard({ title, tone, hint, items, editing, onChange, placeholder }: {
  title: string;
  tone: 'orange' | 'leaf' | 'sky' | 'plum';
  hint: string;
  items: string[];
  editing: boolean;
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const update = (i: number, v: string) => onChange(items.map((it, idx) => idx === i ? v : it));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div style={{
      background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 18px', borderBottom: items.length > 0 ? '1px solid var(--cc-line)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span className={`cc-chip ${tone}`} style={{ height: 22, fontSize: 11.5 }}>{title}</span>
          <span style={{ fontSize: 11.5, color: 'var(--cc-muted)' }}>{hint}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--cc-muted-soft)' }}>{items.length}</span>
          {editing && (
            <button className="cc-btn ghost" style={{ height: 24, fontSize: 11.5 }} onClick={add}>＋ 添加</button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        !editing ? null : (
          <div style={{ padding: '12px 18px', fontSize: 12, color: 'var(--cc-muted-soft)', fontStyle: 'italic' }}>
            暂无规则 · 点击右上角"添加"创建
          </div>
        )
      ) : (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {editing ? (
                <>
                  <input
                    value={it}
                    onChange={e => update(i, e.target.value)}
                    placeholder={placeholder || 'Bash(npm:*)、Read(*)、Edit(/path/**)…'}
                    className="mono"
                    style={{
                      flex: 1, height: 30, padding: '0 10px', fontSize: 12,
                      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                      color: 'var(--cc-ink)', background: 'var(--cc-bg)',
                      border: '1px solid var(--cc-line)', borderRadius: 6, outline: 'none',
                    }}
                  />
                  <button onClick={() => remove(i)} title="删除" style={{
                    background: 'transparent', border: 'none', color: 'var(--cc-muted)', cursor: 'pointer',
                    fontSize: 16, lineHeight: 1, padding: '2px 6px',
                  }}>×</button>
                </>
              ) : (
                <span className="mono" style={{
                  flex: 1, fontSize: 12, color: 'var(--cc-ink-soft)',
                  padding: '6px 10px', background: 'var(--cc-bg)', borderRadius: 6,
                }}>{it || <span style={{ color: 'var(--cc-muted-soft)' }}>（空）</span>}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
