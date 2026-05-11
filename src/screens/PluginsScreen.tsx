import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/app-store';
import {
  useConfigStore,
  InstalledPlugin,
  MarketplaceInfo,
} from '../store/config-store';
import { Rail } from '../components/Rail';
import { Topbar } from '../components/Topbar';
import { revealInFinder, readTextFileMeta } from '../lib/fs-bridge';
import { FileEditorScreen } from './FileEditorScreen';
import { SkillDetailScreen } from './SkillDetailScreen';

type Tab = 'installed' | 'marketplaces';

interface OpenFile {
  source: 'agent' | 'command';
  pluginKey: string;
  filePath: string;
  fileName: string;
}

interface OpenSkill {
  pluginKey: string;
  skillDir: string;
  skillName: string;
}

export function PluginsScreen() {
  const { snapshot, scanAll } = useConfigStore();
  const { toast_msg } = useAppStore();
  const plugins = snapshot?.plugins;

  const [tab, setTab] = useState<Tab>('installed');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [openSkill, setOpenSkill] = useState<OpenSkill | null>(null);

  const installed = plugins?.installed ?? [];
  const marketplaces = plugins?.marketplaces ?? [];

  // 默认选中第一项
  useEffect(() => {
    if (tab === 'installed' && !selectedKey && installed.length > 0) {
      setSelectedKey(installed[0].key);
    }
    if (tab === 'marketplaces' && !selectedMarketplace && marketplaces.length > 0) {
      setSelectedMarketplace(marketplaces[0].id);
    }
  }, [tab, installed, marketplaces, selectedKey, selectedMarketplace]);

  // 选中的 plugin / marketplace 可能因为重新扫描而消失
  useEffect(() => {
    if (selectedKey && !installed.find((p) => p.key === selectedKey)) {
      setSelectedKey(installed[0]?.key ?? null);
      setOpenFile(null);
      setOpenSkill(null);
    }
  }, [installed, selectedKey]);

  // openFile / openSkill 优先(嵌入式 detail 视图)
  if (openSkill) {
    return (
      <SkillDetailScreen
        railKey="user"
        crumbs={[
          { label: 'Plugins', onClick: () => { setOpenSkill(null); } },
          { label: openSkill.pluginKey, onClick: () => { setOpenSkill(null); } },
          { label: openSkill.skillName },
        ]}
        title={openSkill.skillName}
        skillDir={openSkill.skillDir}
        scopeChip={{ label: `Plugin · ${openSkill.pluginKey}`, tone: 'plum' }}
        onDeleted={() => setOpenSkill(null)}
      />
    );
  }
  if (openFile) {
    return (
      <PluginFileViewer
        file={openFile}
        onBack={() => setOpenFile(null)}
      />
    );
  }

  const selectedPlugin = installed.find((p) => p.key === selectedKey) ?? null;
  const selectedMP = marketplaces.find((m) => m.id === selectedMarketplace) ?? null;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <Rail active="plugins" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', minWidth: 0, minHeight: 0 }}>
        <Topbar
          crumbs={[{ label: 'Plugins' }]}
          right={
            <button
              className="cc-btn ghost"
              onClick={async () => {
                if (!plugins?.plugins_dir) return;
                try {
                  await revealInFinder(plugins.plugins_dir);
                } catch (e) {
                  toast_msg(`无法打开 Finder：${String(e)}`, 'error');
                }
              }}
            >在 Finder 中显示</button>
          }
        />
        <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'center', gap: 18, borderBottom: '1px solid var(--cc-line)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Plugin 管理</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            <TabButton active={tab === 'installed'} onClick={() => setTab('installed')} label={`已安装 · ${installed.length}`} />
            <TabButton active={tab === 'marketplaces'} onClick={() => setTab('marketplaces')} label={`Marketplaces · ${marketplaces.length}`} />
          </div>
          <div style={{ flex: 1 }} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--cc-muted)' }}>{plugins?.plugins_dir || '~/.claude/plugins/'}</div>
        </div>

        {plugins?.warnings && plugins.warnings.length > 0 && (
          <div style={{ padding: '8px 28px', background: '#FFF8E6', borderBottom: '1px solid #F0E0B0', fontSize: 11.5, color: '#7A5C00' }}>
            {plugins.warnings.length} 条解析警告 · 详见控制台
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {tab === 'installed' ? (
            <>
              <PluginList
                plugins={installed}
                selectedKey={selectedKey}
                onSelect={(k) => { setSelectedKey(k); setOpenFile(null); setOpenSkill(null); }}
              />
              {selectedPlugin ? (
                <PluginDetail
                  plugin={selectedPlugin}
                  onTogglePlugin={async (next) => {
                    try {
                      await useConfigStore.getState().setPluginEnabled(selectedPlugin.key, next);
                      toast_msg(`${next ? '已启用' : '已禁用'} ${selectedPlugin.name}`, 'success');
                    } catch (e) {
                      toast_msg(`切换失败：${String(e)}`, 'error');
                      await scanAll();
                    }
                  }}
                  onOpenSkill={(skillName, skillDir) => {
                    setOpenSkill({ pluginKey: selectedPlugin.key, skillName, skillDir });
                  }}
                  onOpenFile={(kind, filePath, fileName) => {
                    setOpenFile({ source: kind, pluginKey: selectedPlugin.key, filePath, fileName });
                  }}
                  onReveal={async (path) => {
                    try { await revealInFinder(path); }
                    catch (e) { toast_msg(`无法打开 Finder：${String(e)}`, 'error'); }
                  }}
                  onCopy={async (text) => {
                    try {
                      await navigator.clipboard.writeText(text);
                      toast_msg(`已复制：${text.length > 60 ? text.slice(0, 57) + '…' : text}`, 'success');
                    } catch (e) {
                      toast_msg(`复制失败：${String(e)}`, 'error');
                    }
                  }}
                />
              ) : (
                <EmptyDetail label="尚未安装任何 plugin" hint="使用 claude /plugin marketplace add ... 与 /plugin install ... 在 CLI 中安装" />
              )}
            </>
          ) : (
            <>
              <MarketplaceList
                marketplaces={marketplaces}
                selectedId={selectedMarketplace}
                onSelect={setSelectedMarketplace}
              />
              {selectedMP ? (
                <MarketplaceDetail
                  marketplace={selectedMP}
                  onReveal={async (path) => {
                    try { await revealInFinder(path); }
                    catch (e) { toast_msg(`无法打开 Finder：${String(e)}`, 'error'); }
                  }}
                />
              ) : (
                <EmptyDetail label="尚未添加任何 marketplace" hint="使用 claude /plugin marketplace add owner/repo 在 CLI 中添加" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── 子组件 ───────── */

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 30,
        padding: '0 12px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--cc-orange)' : '2px solid transparent',
        marginBottom: -1,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--cc-orange-deep)' : 'var(--cc-ink-soft)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >{label}</button>
  );
}

function PluginList({
  plugins, selectedKey, onSelect,
}: {
  plugins: InstalledPlugin[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  if (plugins.length === 0) {
    return (
      <div style={{ flex: '0 0 320px', borderRight: '1px solid var(--cc-line)', padding: 24, color: 'var(--cc-muted)', fontSize: 12.5 }}>
        暂无已安装 plugin
      </div>
    );
  }
  return (
    <div style={{ flex: '0 0 320px', borderRight: '1px solid var(--cc-line)', overflow: 'auto' }}>
      {plugins.map((p, i) => {
        const isA = p.key === selectedKey;
        return (
          <div
            key={p.key}
            onClick={() => onSelect(p.key)}
            style={{
              cursor: 'pointer',
              padding: '12px 18px',
              borderBottom: i < plugins.length - 1 ? '1px solid var(--cc-line)' : 'none',
              background: isA ? 'var(--cc-orange-wash)' : 'transparent',
              borderLeft: isA ? '2px solid var(--cc-orange)' : '2px solid transparent',
              paddingLeft: isA ? 16 : 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: p.enabled ? 'var(--cc-leaf)' : 'var(--cc-muted-soft)',
                flexShrink: 0,
              }} />
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: isA ? 'var(--cc-orange-deep)' : 'var(--cc-ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </div>
              <span style={{ fontSize: 10, color: 'var(--cc-muted)' }}>{p.version || '—'}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
              {p.manifest.description || '无描述'}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--cc-muted-soft)', display: 'flex', gap: 8 }}>
              <span>@{p.marketplace || '?'}</span>
              <span>·</span>
              <span>{summarizeContents(p)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function summarizeContents(p: InstalledPlugin): string {
  const parts: string[] = [];
  if (p.contents.skills.length > 0) parts.push(`${p.contents.skills.length} skills`);
  if (p.contents.agents.length > 0) parts.push(`${p.contents.agents.length} agents`);
  if (p.contents.commands.length > 0) parts.push(`${p.contents.commands.length} cmds`);
  if (p.contents.hooks_count > 0) parts.push(`${p.contents.hooks_count} hooks`);
  if (parts.length === 0) return '无内容';
  return parts.join(' · ');
}

function PluginDetail({
  plugin, onTogglePlugin, onOpenSkill, onOpenFile, onReveal, onCopy,
}: {
  plugin: InstalledPlugin;
  onTogglePlugin: (next: boolean) => Promise<void>;
  onOpenSkill: (skillName: string, skillDir: string) => void;
  onOpenFile: (kind: 'agent' | 'command', filePath: string, fileName: string) => void;
  onReveal: (path: string) => void;
  onCopy: (text: string) => void;
}) {
  const uninstallCmd = `claude /plugin uninstall ${plugin.key}`;
  const updateCmd = `claude /plugin update ${plugin.key}`;
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '26px 36px 36px', minWidth: 0 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h1 className="mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{plugin.name}</h1>
            <span className="cc-chip plum" style={{ height: 20 }}>Plugin</span>
            {plugin.scope && <span className="cc-chip" style={{ height: 20 }}>{plugin.scope}</span>}
            <span style={{ fontSize: 12, color: 'var(--cc-muted)' }}>v{plugin.version || '?'} · @{plugin.marketplace || '?'}</span>
          </div>
          <div className="serif" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--cc-ink-soft)', maxWidth: 640 }}>
            {plugin.manifest.description || '此 plugin 未提供描述'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--cc-muted)' }}>{plugin.enabled ? '已启用' : '已禁用'}</span>
          <ToggleSwitch checked={plugin.enabled} onChange={onTogglePlugin} />
        </div>
      </div>

      {/* 警告:install_path 不存在 */}
      {!plugin.install_path_exists && (
        <div style={{ padding: '10px 14px', background: '#FCEAEA', color: '#6B1F1F', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
          安装目录不存在（可能已被外部删除）：<span className="mono">{plugin.install_path}</span>
        </div>
      )}

      {/* Manifest 区 */}
      <Section title="Manifest">
        <KvTable rows={[
          ['Name', plugin.manifest.name || plugin.name],
          ['Version', plugin.manifest.version || plugin.version || '—'],
          ['Author', plugin.manifest.author || '—'],
          ['License', plugin.manifest.license || '—'],
          ['Homepage', plugin.manifest.homepage || '—'],
          ['Keywords', plugin.manifest.keywords.length > 0 ? plugin.manifest.keywords.join(', ') : '—'],
          ['Install Path', plugin.install_path],
          ['Git SHA', plugin.git_commit_sha || '—'],
          ['Installed At', plugin.installed_at || '—'],
        ]} />
      </Section>

      {/* Skills */}
      {plugin.contents.skills.length > 0 && (
        <Section title={`Skills · ${plugin.contents.skills.length}`}>
          <ContentGrid>
            {plugin.contents.skills.map((s) => (
              <ContentCard
                key={s.source_path}
                badge="S"
                color="leaf"
                name={s.name}
                desc={s.description}
                meta={`${s.file_count} 文件 · ${s.mtime}`}
                onClick={() => onOpenSkill(s.name, s.source_path)}
              />
            ))}
          </ContentGrid>
        </Section>
      )}

      {/* Agents */}
      {plugin.contents.agents.length > 0 && (
        <Section title={`Agents · ${plugin.contents.agents.length}`}>
          <ContentGrid>
            {plugin.contents.agents.map((a) => (
              <ContentCard
                key={a.source_path}
                badge="A"
                color="plum"
                name={a.name}
                desc={a.description}
                meta={a.mtime}
                onClick={() => onOpenFile('agent', a.source_path, a.name)}
              />
            ))}
          </ContentGrid>
        </Section>
      )}

      {/* Commands */}
      {plugin.contents.commands.length > 0 && (
        <Section title={`Commands · ${plugin.contents.commands.length}`}>
          <ContentGrid>
            {plugin.contents.commands.map((c) => (
              <ContentCard
                key={c.source_path}
                badge="/"
                color="orange"
                name={`/${c.name}`}
                desc={c.description}
                meta={c.mtime}
                onClick={() => onOpenFile('command', c.source_path, c.name)}
              />
            ))}
          </ContentGrid>
        </Section>
      )}

      {/* Hooks / MCP / LSP 占位 */}
      {(plugin.contents.hooks_count > 0 || plugin.contents.has_mcp || plugin.contents.has_lsp) && (
        <Section title="其它">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {plugin.contents.hooks_count > 0 && <span className="cc-chip">Hooks · {plugin.contents.hooks_count}</span>}
            {plugin.contents.has_mcp && <span className="cc-chip">MCP servers</span>}
            {plugin.contents.has_lsp && <span className="cc-chip">LSP</span>}
          </div>
        </Section>
      )}

      {/* 操作区 */}
      <Section title="操作">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="cc-btn ghost" onClick={() => onReveal(plugin.install_path)} disabled={!plugin.install_path_exists}>在 Finder 中显示</button>
          <button className="cc-btn ghost" onClick={() => onCopy(updateCmd)}>复制升级命令</button>
          <button className="cc-btn ghost" style={{ color: '#B8543A' }} onClick={() => onCopy(uninstallCmd)}>复制卸载命令</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--cc-muted)', lineHeight: 1.6 }}>
          为避免与 Claude Code 的包管理器抢锅,本工具不直接执行 install / uninstall / update。请把上述命令贴回 CLI 里跑。
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--cc-ink-soft)' }}>{title}</h3>
      {children}
    </div>
  );
}

function KvTable({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 10, overflow: 'hidden' }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{
          display: 'flex',
          padding: '8px 14px',
          borderBottom: i < rows.length - 1 ? '1px solid var(--cc-line)' : 'none',
          fontSize: 12,
        }}>
          <div style={{ width: 110, color: 'var(--cc-muted)', flexShrink: 0 }}>{k}</div>
          <div className="mono" style={{ flex: 1, color: 'var(--cc-ink-soft)', wordBreak: 'break-all' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function ContentGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {children}
    </div>
  );
}

function ContentCard({
  badge, color, name, desc, meta, onClick,
}: {
  badge: string;
  color: 'leaf' | 'plum' | 'orange';
  name: string;
  desc: string;
  meta: string;
  onClick: () => void;
}) {
  const wash = color === 'leaf' ? 'var(--cc-leaf-wash)' : color === 'plum' ? 'var(--cc-plum-wash)' : 'var(--cc-orange-wash)';
  const ink = color === 'leaf' ? '#4A5B3D' : color === 'plum' ? '#5C3D5B' : 'var(--cc-orange-deep)';
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)',
        borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
      }}
    >
      <div className="mono" style={{
        width: 26, height: 26, borderRadius: 7,
        background: wash, color: ink,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, flexShrink: 0,
      }}>{badge}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
          {desc || '—'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--cc-muted-soft)' }}>{meta}</div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try { await onChange(!checked); } finally { setBusy(false); }
      }}
      disabled={busy}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? 'var(--cc-leaf)' : 'var(--cc-line-strong)',
        position: 'relative', cursor: busy ? 'wait' : 'pointer',
        border: 'none', padding: 0, transition: 'background 0.15s',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.15s',
      }} />
    </button>
  );
}

function MarketplaceList({
  marketplaces, selectedId, onSelect,
}: {
  marketplaces: MarketplaceInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (marketplaces.length === 0) {
    return (
      <div style={{ flex: '0 0 320px', borderRight: '1px solid var(--cc-line)', padding: 24, color: 'var(--cc-muted)', fontSize: 12.5 }}>
        暂无已添加 marketplace
      </div>
    );
  }
  return (
    <div style={{ flex: '0 0 320px', borderRight: '1px solid var(--cc-line)', overflow: 'auto' }}>
      {marketplaces.map((m, i) => {
        const isA = m.id === selectedId;
        const sourceLabel = m.source_repo
          ? `github:${m.source_repo}`
          : m.source_url || m.source_kind;
        return (
          <div
            key={m.id}
            onClick={() => onSelect(m.id)}
            style={{
              cursor: 'pointer',
              padding: '12px 18px',
              borderBottom: i < marketplaces.length - 1 ? '1px solid var(--cc-line)' : 'none',
              background: isA ? 'var(--cc-orange-wash)' : 'transparent',
              borderLeft: isA ? '2px solid var(--cc-orange)' : '2px solid transparent',
              paddingLeft: isA ? 16 : 18,
            }}
          >
            <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: isA ? 'var(--cc-orange-deep)' : 'var(--cc-ink)', marginBottom: 4 }}>
              {m.id}
            </div>
            <div style={{ fontSize: 11, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
              {sourceLabel}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--cc-muted-soft)' }}>
              {m.advertised.length} plugins
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarketplaceDetail({ marketplace, onReveal }: {
  marketplace: MarketplaceInfo;
  onReveal: (path: string) => void;
}) {
  const sourceUrl = marketplace.source_repo
    ? `https://github.com/${marketplace.source_repo}`
    : marketplace.source_url || '';
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '26px 36px 36px', minWidth: 0 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <h1 className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{marketplace.id}</h1>
          <span className="cc-chip orange" style={{ height: 20 }}>Marketplace</span>
        </div>
        {marketplace.description && (
          <div className="serif" style={{ fontSize: 14, color: 'var(--cc-ink-soft)', maxWidth: 640, marginBottom: 8 }}>
            {marketplace.description}
          </div>
        )}
        {marketplace.owner_name && (
          <div style={{ fontSize: 11.5, color: 'var(--cc-muted)' }}>by {marketplace.owner_name}</div>
        )}
      </div>

      <Section title="来源">
        <KvTable rows={[
          ['Kind', marketplace.source_kind],
          ['Repo', marketplace.source_repo || marketplace.source_url || '—'],
          ['Install Location', marketplace.install_location || '—'],
          ['Last Updated', marketplace.last_updated || '—'],
          ['Manifest', marketplace.manifest_exists ? marketplace.manifest_path : '未找到'],
        ]} />
      </Section>

      <Section title={`Plugins · ${marketplace.advertised.length}`}>
        {marketplace.advertised.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--cc-muted)', fontStyle: 'italic' }}>marketplace.json 未声明任何 plugin</div>
        ) : (
          <div style={{ background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 10, overflow: 'hidden' }}>
            {marketplace.advertised.map((entry, i) => (
              <div key={`${entry.name}-${i}`} style={{ padding: '12px 14px', borderBottom: i < marketplace.advertised.length - 1 ? '1px solid var(--cc-line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{entry.name}</span>
                  {entry.version && <span style={{ fontSize: 11, color: 'var(--cc-muted)' }}>v{entry.version}</span>}
                  {entry.category && <span className="cc-chip" style={{ height: 18, fontSize: 10 }}>{entry.category}</span>}
                </div>
                {entry.description && (
                  <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', marginBottom: 4 }}>{entry.description}</div>
                )}
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--cc-muted-soft)' }}>{entry.source_summary}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="操作">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="cc-btn ghost" onClick={() => onReveal(marketplace.install_location)} disabled={!marketplace.install_location}>在 Finder 中显示</button>
          {sourceUrl && (
            <a className="cc-btn ghost" href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>打开仓库</a>
          )}
        </div>
      </Section>
    </div>
  );
}

function EmptyDetail({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 }}>
      <div style={{ fontSize: 13, color: 'var(--cc-ink-soft)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 11.5, color: 'var(--cc-muted)', textAlign: 'center', maxWidth: 480 }}>{hint}</div>
    </div>
  );
}

/* ───────── Plugin 文件查看器(只读) ───────── */

function PluginFileViewer({
  file, onBack,
}: {
  file: OpenFile;
  onBack: () => void;
}) {
  const [meta, setMeta] = useState<{ content: string; mtime: string; sizeBytes: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setErr(null);
    readTextFileMeta(file.filePath)
      .then((m) => {
        if (cancelled) return;
        if (!m.exists) { setErr('文件不存在'); return; }
        setMeta({ content: m.content, mtime: m.mtime, sizeBytes: m.size_bytes });
      })
      .catch((e) => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [file.filePath]);

  const lang = useMemo(() => file.filePath.toLowerCase().endsWith('.json') ? 'json' as const : 'markdown' as const, [file.filePath]);
  const title = file.source === 'agent' ? file.fileName : `/${file.fileName}`;
  const tone: 'plum' | 'orange' = file.source === 'agent' ? 'plum' : 'orange';

  if (err) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <Rail active="plugins" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8543A', fontSize: 13 }}>
          读取失败：{err}
          <button className="cc-btn ghost" onClick={onBack} style={{ marginLeft: 12 }}>返回</button>
        </div>
      </div>
    );
  }
  if (!meta) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <Rail active="plugins" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cc-muted)', fontSize: 13 }}>加载中…</div>
      </div>
    );
  }

  return (
    <FileEditorScreen
      railKey="user"
      crumbs={[
        { label: 'Plugins', onClick: onBack },
        { label: file.pluginKey, onClick: onBack },
        { label: title },
      ]}
      title={title}
      scopeChip={{ label: `Plugin · ${file.pluginKey}`, tone }}
      filePath={file.filePath}
      initialContent={meta.content}
      initialMtime={meta.mtime}
      language={lang}
      sizeBytes={meta.sizeBytes}
      readOnly
      readOnlyHint="Plugin 缓存目录,改了会被升级覆盖。要定制请把内容复制到 ~/.claude/skills 或 ~/.claude/agents。"
    />
  );
}
