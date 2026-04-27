import { open } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { Rail } from '../components/Rail';
import { Topbar } from '../components/Topbar';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function formatToday(): string {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]} · ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

// 将后端返回的 UTC 时间戳（"YYYY-MM-DD HH:mm:ss"）格式化为北京时间 HH:mm
function formatBeijingTime(utc: string): string {
  if (!utc) return '';
  // 兼容两种格式：ISO（带 T 与 Z）或 "YYYY-MM-DD HH:mm:ss"（裸 UTC 时间）
  const iso = /[TZ]/.test(utc) ? utc : utc.replace(' ', 'T') + 'Z';
  const t = new Date(iso);
  if (isNaN(t.getTime())) return utc;
  return t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' });
}

function relativeTime(mtime: string): string {
  if (!mtime) return '—';
  const t = new Date(mtime.replace(' ', 'T') + 'Z').getTime();
  if (isNaN(t)) return mtime;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return mtime;
}

export function Dashboard() {
  const { go, toast_msg } = useAppStore();
  const { snapshot, scanAll, addProject } = useConfigStore();

  const pickAndAddProject = async () => {
    const selected = await open({ directory: true, multiple: false, title: '选择项目目录' });
    if (typeof selected === 'string') {
      await addProject(selected);
      toast_msg(`已添加项目：${selected.split('/').pop()}`);
    }
  };

  const projects = (snapshot?.projects || []).map(p => ({
    id: p.id, name: p.name, alias: p.name,
    path: p.path, added: p.added_at,
    configCount: (p.settings ? 1 : 0) + (p.local_settings ? 1 : 0) + (p.memory ? 1 : 0) + p.commands.length + p.skills.length + p.agents.length,
    hasMcp: p.has_mcp, hasLocal: !!p.local_settings,
    commands: p.commands.length, skills: p.skills.length, agents: p.agents.length,
    memory: !!p.memory, lastEdit: relativeTime(p.settings?.mtime || p.memory?.mtime || ''),
    mtime: p.settings?.mtime || '',
  }));

  const userCommands = snapshot?.user_config.commands || [];
  const userSkills = snapshot?.user_config.skills || [];
  const userAgents = snapshot?.user_config.agents || [];
  const cliVersion = snapshot?.claude_code_version || '—';
  const totalFiles = snapshot
    ? (snapshot.user_config.settings ? 1 : 0) + (snapshot.user_config.memory ? 1 : 0) + snapshot.user_config.commands.length + snapshot.user_config.skills.length + snapshot.user_config.agents.length + snapshot.projects.reduce((s, p) => s + p.commands.length + p.skills.length + p.agents.length + (p.settings ? 1 : 0) + (p.memory ? 1 : 0), 0)
    : 0;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <Rail active="dashboard" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', overflow: 'hidden' }}>
        <Topbar
          crumbs={[{ label: 'Dashboard' }]}
          right={
            <>
              <button className="cc-btn ghost" onClick={() => { scanAll(); toast_msg('正在重新扫描…'); }}>↻ 重新扫描</button>
              <button className="cc-btn primary" onClick={pickAndAddProject}>＋ 添加项目</button>
            </>
          }
        />
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 36px 36px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 4 }}>欢迎回来</h1>
              <div style={{ fontSize: 12.5, color: 'var(--cc-muted)' }}>
                {formatToday()} · macOS 直接读写 <span className="mono">~/.claude</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--cc-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: snapshot ? 'var(--cc-leaf)' : 'var(--cc-muted-soft)' }} />
              <span>{snapshot ? `已扫描 · ${formatBeijingTime(snapshot.scanned_at)}` : '尚未扫描'}</span>
            </div>
          </div>

          {/* Hero stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 14, marginBottom: 24 }}>
            <div
              onClick={() => go({ name: 'global', screen: 'overview' })}
              style={{
                cursor: 'pointer', background: 'linear-gradient(135deg, #D97757 0%, #B8543A 100%)',
                borderRadius: 14, padding: '26px 30px', color: '#FFF7F1', position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.82, marginBottom: 12, fontWeight: 600 }}>已追踪配置</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                <div className="serif" style={{ fontSize: 56, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.03em' }}>{totalFiles}</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>份文件 · 5 种类型</div>
              </div>
              <div className="mono" style={{ fontSize: 12, opacity: 0.88, display: 'flex', gap: 14, marginTop: 14 }}>
                <span>~/.claude</span><span style={{ opacity: 0.6 }}>+</span><span>{projects.length} projects</span>
              </div>
              <div style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {[
              { l: 'CLI 版本', v: cliVersion, s: 'claude --version', c: 'var(--cc-leaf)', onClick: undefined as (() => void) | undefined },
            ].map((x, i) => (
              <div
                key={i}
                onClick={x.onClick}
                style={{
                  cursor: x.onClick ? 'pointer' : 'default',
                  background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)',
                  borderRadius: 14, padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cc-muted)', fontWeight: 600 }}>{x.l}</div>
                <div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: x.c, letterSpacing: '-0.01em', marginBottom: 4 }}>{x.v}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.s}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Global config summary */}
          <div
            onClick={() => go({ name: 'global', screen: 'overview' })}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>全局配置 <span style={{ color: 'var(--cc-muted-soft)', fontWeight: 400, marginLeft: 6 }}>· ~/.claude</span></h2>
            <span style={{ fontSize: 11.5, color: 'var(--cc-orange-deep)' }}>打开 →</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 28 }}>
            {[
              { l: 'Settings', v: snapshot?.user_config.settings ? Object.keys(snapshot.user_config.settings.raw as object).length + ' 字段' : '—', s: 'settings.json', m: snapshot?.user_config.settings?.mtime || '', onClick: () => go({ name: 'global', screen: 'settings' }) },
              { l: '记忆', v: snapshot?.user_config.memory ? (snapshot.user_config.memory.size_bytes / 1024).toFixed(1) + 'KB' : '—', s: 'CLAUDE.md', m: snapshot?.user_config.memory?.mtime || '', onClick: () => go({ name: 'global', screen: 'memory' }) },
              { l: '命令', v: userCommands.length, s: '斜杠', m: '.claude/commands', onClick: () => go({ name: 'global', screen: 'overview' }) },
              { l: 'Skills', v: userSkills.length, s: '技能', m: '.claude/skills', onClick: () => go({ name: 'global', screen: 'overview' }) },
              { l: 'Agents', v: userAgents.length, s: '子代理', m: '.claude/agents', onClick: () => go({ name: 'global', screen: 'overview' }) },
            ].map((x, i) => (
              <div
                key={i}
                onClick={x.onClick}
                style={{
                  cursor: 'pointer',
                  background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 10, padding: '14px 16px',
                }}
              >
                <div style={{ fontSize: 10.5, color: 'var(--cc-muted)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>{x.l}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 4 }}>
                  <div className="serif" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>{x.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--cc-muted)' }}>{x.s}</div>
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--cc-muted-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.m}</div>
              </div>
            ))}
          </div>

          {/* Projects */}
          {projects.length > 0 && (
          <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>项目 <span style={{ color: 'var(--cc-muted-soft)', fontWeight: 400, marginLeft: 6 }}>· {projects.length}</span></h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => go({ name: 'project', id: p.id, screen: 'overview' })}
                style={{
                  cursor: 'pointer', background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)',
                  borderRadius: 12, padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', gap: 11,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: p.hasMcp ? 'var(--cc-orange-wash)' : 'var(--cc-bg-sunk)',
                    color: p.hasMcp ? 'var(--cc-orange-deep)' : 'var(--cc-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
                  }}>{p.alias[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.alias}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, fontSize: 11 }}>
                  {[['配置', p.configCount], ['命令', p.commands || '—'], ['Skills', p.skills || '—'], ['Agents', p.agents || '—']].map(([k, v]) => (
                    <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cc-muted)' }}>
                      <span>{k}</span><span style={{ color: 'var(--cc-ink-soft)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 18 }}>
                  {p.hasMcp && <span className="cc-chip orange" style={{ height: 18, fontSize: 10 }}>MCP</span>}
                  {p.hasLocal && <span className="cc-chip" style={{ height: 18, fontSize: 10 }}>local</span>}
                  {p.memory && <span className="cc-chip leaf" style={{ height: 18, fontSize: 10 }}>memory</span>}
                </div>
                <div style={{ borderTop: '1px solid var(--cc-line)', paddingTop: 10, fontSize: 10.5, color: 'var(--cc-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>编辑 · {p.lastEdit}</span><span>→</span>
                </div>
              </div>
            ))}
          </div>
          </>
          )}

        </div>
      </div>
    </div>
  );
}
