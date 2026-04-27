import { ReactNode, useEffect, useMemo, useState } from 'react';

import { Rail } from '../components/Rail';
import { Topbar } from '../components/Topbar';
import { useAppStore } from '../store/app-store';
import { useConfigStore } from '../store/config-store';
import { writeJsonFile, revealInFinder, detectExternalChange } from '../lib/fs-bridge';

type RailKey = 'user' | 'projects';

interface Props {
  sidebar?: ReactNode;
  railKey: RailKey;
  railProjectId?: string;
  crumbs: { label: string; onClick?: () => void }[];
  title: string;
  scopeChip: { label: string; tone: 'orange' | 'leaf' | 'sky' | 'plum' };
  filePath: string;
  initialRaw: Record<string, unknown>;
  initialMtime: string;
  sizeBytes: number;
  viewToggle: ReactNode;
  embedded?: boolean;
}

export function SettingsFormScreen(props: Props) {
  const { sidebar, railKey, railProjectId, crumbs, title, scopeChip, filePath, initialRaw, initialMtime, sizeBytes, viewToggle, embedded } = props;
  const { toast_msg } = useAppStore();
  const { scanAll } = useConfigStore();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(initialRaw);
  const [baseline, setBaseline] = useState<Record<string, unknown>>(initialRaw);
  const [editorMtime, setEditorMtime] = useState(initialMtime);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(initialRaw);
      setBaseline(initialRaw);
      setEditorMtime(initialMtime);
    }
  }, [initialRaw, initialMtime, editing]);

  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(baseline);
  const view = editing ? draft : initialRaw;

  const updateField = (key: string, value: unknown) => {
    setDraft(prev => updateAtPath(prev, key, value) as Record<string, unknown>);
  };

  const enterEdit = () => {
    setDraft(initialRaw);
    setBaseline(initialRaw);
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
        toast_msg('磁盘已被外部修改，请切换到 JSON 视图手动合并', 'error');
        setSaving(false);
        return;
      }
      const text = JSON.stringify(draft, null, 2) + '\n';
      const result = await writeJsonFile(filePath, text, editorMtime);
      setBaseline(draft);
      setEditorMtime(result.mtime);
      setEditing(false);
      toast_msg(`已保存 · ${title}`, 'success');
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

  const inner = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--cc-bg)', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
        {editing ? (
          <div style={{ height: 52, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF4EC', borderBottom: '1px solid #EDD6C5', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, background: 'var(--cc-orange)', color: 'white', fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                <span>编辑中</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--cc-ink-soft)' }}>
                {title} {dirty && <span style={{ color: 'var(--cc-orange-deep)', fontWeight: 500 }}>· 未保存</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {viewToggle}
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
                {viewToggle}
                <button className="cc-btn ghost" onClick={onReveal}>在 Finder 中显示</button>
                <button className="cc-btn primary" onClick={enterEdit}>✎ 编辑</button>
              </>
            }
          />
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</h1>
              <span className={`cc-chip ${scopeChip.tone}`} style={{ height: 20 }}>{scopeChip.label}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span className="mono">{filePath}</span>
              <span>· {(sizeBytes / 1024).toFixed(1)} KB · 修改于 {editorMtime || '—'}</span>
            </div>
          </div>

          <FormBody
            value={view}
            editing={editing}
            onChange={updateField}
          />
        </div>
    </div>
  );

  if (embedded) return inner;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
      <Rail active={railKey} projectId={railProjectId} />
      {sidebar}
      {inner}
    </div>
  );
}

function FormBody({ value, editing, onChange }: {
  value: Record<string, unknown>;
  editing: boolean;
  onChange: (key: string, v: unknown) => void;
}) {
  const env = useMemo(() => {
    const raw = value.env;
    if (isObj(raw)) return raw as Record<string, string>;
    return {} as Record<string, string>;
  }, [value.env]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, maxWidth: 820 }}>
      {/* === 基础 === */}
      <Section title="基础">
        <Field label="model" hint="默认模型（别名 opus / sonnet / haiku 或完整模型名）">
          <TextInput value={asString(value.model)} editing={editing} placeholder="opus / sonnet / haiku / claude-opus-4-7" onChange={v => onChange('model', v)} />
        </Field>
        <Field label="theme" hint="主题：auto / light / dark / daltonized / ANSI 等">
          <SelectInput value={asString(value.theme)} editing={editing} options={['', 'auto', 'light', 'dark', 'light-daltonized', 'dark-daltonized', 'light-ansi', 'dark-ansi']} onChange={v => onChange('theme', v)} />
        </Field>
        <Field label="outputStyle" hint="输出风格（如 concise / detailed，空则使用默认）">
          <TextInput value={asString(value.outputStyle)} editing={editing} placeholder="concise" onChange={v => onChange('outputStyle', v)} />
        </Field>
        <Field label="language" hint="Claude 响应语言（如 chinese / japanese / spanish）">
          <TextInput value={asString(value.language)} editing={editing} placeholder="chinese" onChange={v => onChange('language', v)} />
        </Field>
        <Field label="agent" hint="主线程使用的 agent 名（覆盖 system prompt 与工具范围）">
          <TextInput value={asString(value.agent)} editing={editing} placeholder="(空)" onChange={v => onChange('agent', v)} />
        </Field>
      </Section>

      {/* === 编辑器与界面 === */}
      <Section title="编辑器与界面">
        <Field label="editorMode" hint="prompt 输入框键位：normal / vim">
          <SelectInput value={asString(value.editorMode)} editing={editing} options={['', 'normal', 'vim']} onChange={v => onChange('editorMode', v)} />
        </Field>
        <Field label="tui" hint="终端 UI 渲染器：default / fullscreen（无闪烁 alt-screen）">
          <SelectInput value={asString(value.tui)} editing={editing} options={['', 'default', 'fullscreen']} onChange={v => onChange('tui', v)} />
        </Field>
        <Field label="viewMode" hint="启动时默认 transcript 视图">
          <SelectInput value={asString(value.viewMode)} editing={editing} options={['', 'default', 'verbose', 'focus']} onChange={v => onChange('viewMode', v)} />
        </Field>
        <Field label="defaultView" hint="transcript 默认视角：chat / transcript">
          <SelectInput value={asString(value.defaultView)} editing={editing} options={['', 'chat', 'transcript']} onChange={v => onChange('defaultView', v)} />
        </Field>
        <Field label="preferredNotifChannel" hint="OS 通知渠道">
          <SelectInput value={asString(value.preferredNotifChannel)} editing={editing} options={['', 'auto', 'iterm2', 'iterm2_with_bell', 'terminal_bell', 'kitty', 'ghostty', 'notifications_disabled']} onChange={v => onChange('preferredNotifChannel', v)} />
        </Field>
        <Field label="defaultShell" hint="输入框 ! 命令默认 shell">
          <SelectInput value={asString(value.defaultShell)} editing={editing} options={['', 'bash', 'powershell']} onChange={v => onChange('defaultShell', v)} />
        </Field>
        <Field label="teammateMode" hint="Agent team 显示模式">
          <SelectInput value={asString(value.teammateMode)} editing={editing} options={['', 'auto', 'in-process', 'tmux']} onChange={v => onChange('teammateMode', v)} />
        </Field>
      </Section>

      {/* === 模型与思考 === */}
      <Section title="模型与思考">
        <BoolField label="alwaysThinkingEnabled" hint="默认开启扩展思考（false 显式禁用）" editing={editing} value={value.alwaysThinkingEnabled} onChange={v => onChange('alwaysThinkingEnabled', v)} />
        <BoolField label="showThinkingSummaries" hint="在 transcript 显示思考摘要（ctrl+o）" editing={editing} value={value.showThinkingSummaries} onChange={v => onChange('showThinkingSummaries', v)} />
        <Field label="effortLevel" hint="持久 effort 等级：low / medium / high / xhigh">
          <SelectInput value={asString(value.effortLevel)} editing={editing} options={['', 'low', 'medium', 'high', 'xhigh']} onChange={v => onChange('effortLevel', v)} />
        </Field>
        <BoolField label="autoCompactEnabled" hint="上下文接近限制时自动压缩" editing={editing} value={value.autoCompactEnabled} onChange={v => onChange('autoCompactEnabled', v)} />
        <Field label="autoCompactWindow" hint="auto-compact 窗口大小（100K – 1M）">
          <NumberInput value={value.autoCompactWindow as number | undefined} editing={editing} onChange={v => onChange('autoCompactWindow', v)} />
        </Field>
        <BoolField label="fastMode" hint="启用 fast mode（仅 Opus 4.6）" editing={editing} value={value.fastMode} onChange={v => onChange('fastMode', v)} />
        <BoolField label="fastModePerSessionOptIn" hint="fast mode 不跨 session 持久化" editing={editing} value={value.fastModePerSessionOptIn} onChange={v => onChange('fastModePerSessionOptIn', v)} />
      </Section>

      {/* === 会话与记忆 === */}
      <Section title="会话与记忆">
        <Field label="cleanupPeriodDays" hint="历史 session 保留天数（默认 30，最少 1）">
          <NumberInput value={value.cleanupPeriodDays as number | undefined} editing={editing} onChange={v => onChange('cleanupPeriodDays', v)} />
        </Field>
        <BoolField label="autoMemoryEnabled" hint="启用自动记忆（auto-memory）" editing={editing} value={value.autoMemoryEnabled} onChange={v => onChange('autoMemoryEnabled', v)} />
        <Field label="autoMemoryDirectory" hint="auto-memory 自定义目录（支持 ~/）">
          <TextInput value={asString(value.autoMemoryDirectory)} editing={editing} placeholder="~/.claude/projects/.../memory" onChange={v => onChange('autoMemoryDirectory', v)} />
        </Field>
        <Field label="plansDirectory" hint="计划文件存储目录（默认 ~/.claude/plans）">
          <TextInput value={asString(value.plansDirectory)} editing={editing} placeholder="~/.claude/plans" onChange={v => onChange('plansDirectory', v)} />
        </Field>
        <BoolField label="promptSuggestionEnabled" hint="启用 prompt 建议" editing={editing} value={value.promptSuggestionEnabled} onChange={v => onChange('promptSuggestionEnabled', v)} />
        <BoolField label="useAutoModeDuringPlan" hint="plan 模式下使用 auto mode 语义" editing={editing} value={value.useAutoModeDuringPlan} onChange={v => onChange('useAutoModeDuringPlan', v)} />
        <BoolField label="showClearContextOnPlanAccept" hint="plan 接受时显示「清空上下文」选项" editing={editing} value={value.showClearContextOnPlanAccept} onChange={v => onChange('showClearContextOnPlanAccept', v)} />
        <BoolField label="fileCheckpointingEnabled" hint="编辑前快照文件，方便 /rewind 还原" editing={editing} value={value.fileCheckpointingEnabled} onChange={v => onChange('fileCheckpointingEnabled', v)} />
      </Section>

      {/* === 行为开关 === */}
      <Section title="UI 与行为开关">
        <BoolField label="autoScrollEnabled" hint="fullscreen 模式自动滚到底" editing={editing} value={value.autoScrollEnabled} onChange={v => onChange('autoScrollEnabled', v)} />
        <BoolField label="awaySummaryEnabled" hint="离开后回来时显示一行 session recap" editing={editing} value={value.awaySummaryEnabled} onChange={v => onChange('awaySummaryEnabled', v)} />
        <BoolField label="showTurnDuration" hint="每轮响应后显示耗时" editing={editing} value={value.showTurnDuration} onChange={v => onChange('showTurnDuration', v)} />
        <BoolField label="showMessageTimestamps" hint="为每条 assistant 消息加时间戳" editing={editing} value={value.showMessageTimestamps} onChange={v => onChange('showMessageTimestamps', v)} />
        <BoolField label="spinnerTipsEnabled" hint="spinner 中显示小贴士" editing={editing} value={value.spinnerTipsEnabled} onChange={v => onChange('spinnerTipsEnabled', v)} />
        <BoolField label="terminalProgressBarEnabled" hint="发送 OSC 9;4 进度条到终端" editing={editing} value={value.terminalProgressBarEnabled} onChange={v => onChange('terminalProgressBarEnabled', v)} />
        <BoolField label="terminalTitleFromRename" hint="/rename 同时改终端标签标题" editing={editing} value={value.terminalTitleFromRename} onChange={v => onChange('terminalTitleFromRename', v)} />
        <BoolField label="prefersReducedMotion" hint="降低 / 关闭 UI 动效（无障碍）" editing={editing} value={value.prefersReducedMotion} onChange={v => onChange('prefersReducedMotion', v)} />
        <BoolField label="syntaxHighlightingDisabled" hint="禁用 diff 语法高亮" editing={editing} value={value.syntaxHighlightingDisabled} onChange={v => onChange('syntaxHighlightingDisabled', v)} />
        <BoolField label="todoFeatureEnabled" hint="启用 todo / 任务追踪面板" editing={editing} value={value.todoFeatureEnabled} onChange={v => onChange('todoFeatureEnabled', v)} />
        <BoolField label="includeGitInstructions" hint="在 system prompt 加入 git workflow 指令（默认 true）" editing={editing} value={value.includeGitInstructions} onChange={v => onChange('includeGitInstructions', v)} />
        <BoolField label="respectGitignore" hint="@ 文件选择器尊重 .gitignore（默认 true）" editing={editing} value={value.respectGitignore} onChange={v => onChange('respectGitignore', v)} />
        <BoolField label="skipWebFetchPreflight" hint="跳过 WebFetch 域名安全检查" editing={editing} value={value.skipWebFetchPreflight} onChange={v => onChange('skipWebFetchPreflight', v)} />
        <BoolField label="disableAllHooks" hint="禁用所有 hooks 与 statusLine 执行" editing={editing} value={value.disableAllHooks} onChange={v => onChange('disableAllHooks', v)} />
        <BoolField label="disableSkillShellExecution" hint="禁用 skills / 自定义命令的内联 shell 执行" editing={editing} value={value.disableSkillShellExecution} onChange={v => onChange('disableSkillShellExecution', v)} />
      </Section>

      {/* === 自动更新 === */}
      <Section title="自动更新">
        <Field label="autoUpdatesChannel" hint="发布渠道：latest（默认） / stable / rc">
          <SelectInput value={asString(value.autoUpdatesChannel)} editing={editing} options={['', 'latest', 'stable', 'rc']} onChange={v => onChange('autoUpdatesChannel', v)} />
        </Field>
        <Field label="minimumVersion" hint="最低版本，防止切换到 stable 时被降级">
          <TextInput value={asString(value.minimumVersion)} editing={editing} placeholder="2.1.118" onChange={v => onChange('minimumVersion', v)} />
        </Field>
      </Section>

      {/* === 登录 / 鉴权 === */}
      <Section title="登录 / 鉴权" subtitle="API key、OAuth、AWS / GCP / OTel 凭据脚本">
        <Field label="forceLoginMethod" hint="强制登录方式">
          <SelectInput value={asString(value.forceLoginMethod)} editing={editing} options={['', 'claudeai', 'console']} onChange={v => onChange('forceLoginMethod', v)} />
        </Field>
        <Field label="forceLoginOrgUUID" hint="要求登录的组织 UUID（多个可在 JSON 里写数组）">
          <TextInput value={typeof value.forceLoginOrgUUID === 'string' ? value.forceLoginOrgUUID : ''} editing={editing} placeholder="00000000-0000-0000-0000-000000000000" onChange={v => onChange('forceLoginOrgUUID', v)} />
        </Field>
        <Field label="apiKeyHelper" hint="输出 ANTHROPIC_API_KEY 的脚本路径">
          <TextInput value={asString(value.apiKeyHelper)} editing={editing} placeholder="/usr/local/bin/my-key-helper" onChange={v => onChange('apiKeyHelper', v)} />
        </Field>
        <Field label="proxyAuthHelper" hint="输出 Proxy-Authorization header 的脚本（EAP）">
          <TextInput value={asString(value.proxyAuthHelper)} editing={editing} onChange={v => onChange('proxyAuthHelper', v)} />
        </Field>
        <Field label="awsAuthRefresh" hint="刷新 .aws 凭据的脚本">
          <TextInput value={asString(value.awsAuthRefresh)} editing={editing} onChange={v => onChange('awsAuthRefresh', v)} />
        </Field>
        <Field label="awsCredentialExport" hint="输出 AWS 凭据 JSON 的脚本">
          <TextInput value={asString(value.awsCredentialExport)} editing={editing} onChange={v => onChange('awsCredentialExport', v)} />
        </Field>
        <Field label="gcpAuthRefresh" hint="刷新 GCP 鉴权的命令">
          <TextInput value={asString(value.gcpAuthRefresh)} editing={editing} placeholder="gcloud auth application-default login" onChange={v => onChange('gcpAuthRefresh', v)} />
        </Field>
        <Field label="otelHeadersHelper" hint="动态生成 OTel headers 的脚本">
          <TextInput value={asString(value.otelHeadersHelper)} editing={editing} onChange={v => onChange('otelHeadersHelper', v)} />
        </Field>
      </Section>

      {/* === Permissions 简表单 === */}
      <Section title="Permissions" subtitle="工具权限规则；语法见 /permissions（如 Bash(git *)、Read、Edit(.claude)）">
        <Field label="defaultMode" hint="默认权限模式">
          <SelectInput value={asString(readPath(value, 'permissions.defaultMode'))} editing={editing} options={['', 'default', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'bypassPermissions']} onChange={v => onChange('permissions.defaultMode', v)} />
        </Field>
        <Field label="allow" hint="允许列表（自动通过）">
          <StringListField value={readPath(value, 'permissions.allow')} editing={editing} placeholder='Bash(git *)' onChange={v => onChange('permissions.allow', v)} />
        </Field>
        <Field label="ask" hint="询问列表（始终弹确认）">
          <StringListField value={readPath(value, 'permissions.ask')} editing={editing} placeholder='Write(/etc/*)' onChange={v => onChange('permissions.ask', v)} />
        </Field>
        <Field label="deny" hint="拒绝列表（始终阻止）">
          <StringListField value={readPath(value, 'permissions.deny')} editing={editing} placeholder='Bash(rm -rf *)' onChange={v => onChange('permissions.deny', v)} />
        </Field>
        <Field label="additionalDirectories" hint="额外授予访问的目录">
          <StringListField value={readPath(value, 'permissions.additionalDirectories')} editing={editing} placeholder="/extra/dir" onChange={v => onChange('permissions.additionalDirectories', v)} />
        </Field>
      </Section>

      {/* === MCP 项目 === */}
      <Section title="MCP（项目级 .mcp.json 信任）">
        <BoolField label="enableAllProjectMcpServers" hint="自动批准项目 .mcp.json 里所有 MCP server" editing={editing} value={value.enableAllProjectMcpServers} onChange={v => onChange('enableAllProjectMcpServers', v)} />
        <Field label="enabledMcpjsonServers" hint="批准的 .mcp.json server 名单">
          <StringListField value={value.enabledMcpjsonServers} editing={editing} placeholder="my-server" onChange={v => onChange('enabledMcpjsonServers', v)} />
        </Field>
        <Field label="disabledMcpjsonServers" hint="拒绝的 .mcp.json server 名单">
          <StringListField value={value.disabledMcpjsonServers} editing={editing} placeholder="bad-server" onChange={v => onChange('disabledMcpjsonServers', v)} />
        </Field>
      </Section>

      {/* === Git 提交 / Attribution === */}
      <Section title="Git 提交 / Attribution">
        <BoolField label="includeCoAuthoredBy" hint="（已废弃）改用下方 attribution 字段；为 true 则给 commit / PR 加 Claude 署名" editing={editing} value={value.includeCoAuthoredBy} onChange={v => onChange('includeCoAuthoredBy', v)} />
        <Field label="attribution.commit" hint="自定义 commit trailer（空字符串可隐藏）">
          <TextInput value={asString(readPath(value, 'attribution.commit'))} editing={editing} placeholder='Co-Authored-By: Claude <noreply@anthropic.com>' onChange={v => onChange('attribution.commit', v)} />
        </Field>
        <Field label="attribution.pr" hint="自定义 PR 描述末尾文本（空字符串可隐藏）">
          <TextInput value={asString(readPath(value, 'attribution.pr'))} editing={editing} onChange={v => onChange('attribution.pr', v)} />
        </Field>
      </Section>

      {/* === StatusLine === */}
      <Section title="状态栏 (statusLine)" subtitle="自定义 prompt 下方状态行；推荐用 /statusline 自动生成">
        <Field label="command" hint="状态栏命令（stdin 收会话上下文 JSON）">
          <TextInput value={asString(readPath(value, 'statusLine.command'))} editing={editing} placeholder="bash ~/.claude/statusline.sh" onChange={v => {
            // 设置 command 时，如果 type 缺失则一并补上 type='command'
            if (v && !readPath(value, 'statusLine.type')) onChange('statusLine.type', 'command');
            onChange('statusLine.command', v);
          }} />
        </Field>
        <Field label="padding" hint="行内 padding（数字）">
          <NumberInput value={readPath(value, 'statusLine.padding') as number | undefined} editing={editing} onChange={v => onChange('statusLine.padding', v)} />
        </Field>
        <Field label="refreshInterval" hint="自动刷新间隔（秒，最小 1）">
          <NumberInput value={readPath(value, 'statusLine.refreshInterval') as number | undefined} editing={editing} onChange={v => onChange('statusLine.refreshInterval', v)} />
        </Field>
      </Section>

      {/* === 反馈 / 诊断 === */}
      <Section title="反馈 / 诊断">
        <BoolField label="verbose" hint="启用 verbose 输出，显示完整工具结果" editing={editing} value={value.verbose} onChange={v => onChange('verbose', v)} />
        <Field label="feedbackSurveyRate" hint="session 调研问卷出现概率（0–1，0.05 起步）">
          <NumberInput value={value.feedbackSurveyRate as number | undefined} editing={editing} onChange={v => onChange('feedbackSurveyRate', v)} />
        </Field>
        <Field label="disableDeepLinkRegistration" hint="设为 'disable' 阻止 claude-cli:// 协议注册">
          <SelectInput value={asString(value.disableDeepLinkRegistration)} editing={editing} options={['', 'disable']} onChange={v => onChange('disableDeepLinkRegistration', v)} />
        </Field>
      </Section>

      {/* === 环境变量（保留） === */}
      <Section title="环境变量" subtitle="传给 Claude Code 子进程的环境变量，敏感字段（KEY/TOKEN/SECRET/...）默认遮罩">
        <EnvEditor value={env} editing={editing} onChange={next => onChange('env', Object.keys(next).length ? next : undefined)} />
      </Section>

      <div style={{
        background: '#FFF9F3', border: '1px solid #EDD6C5', borderRadius: 10,
        padding: '12px 16px', fontSize: 12, color: 'var(--cc-ink-soft)', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--cc-orange-deep)' }}>仅 JSON 视图可编辑的字段</div>
        <div>
          <span className="mono">hooks</span>、<span className="mono">sandbox</span>、<span className="mono">enabledPlugins</span>、
          <span className="mono">extraKnownMarketplaces</span>、<span className="mono">spinnerTipsOverride</span>、
          <span className="mono">spinnerVerbs</span>、<span className="mono">voice</span>、<span className="mono">worktree</span>、
          <span className="mono">autoMode</span>、<span className="mono">sshConfigs</span>、<span className="mono">claudeMdExcludes</span>、
          <span className="mono">companyAnnouncements</span>、<span className="mono">availableModels</span>、<span className="mono">modelOverrides</span>、
          <span className="mono">skillOverrides</span>、<span className="mono">allowedHttpHookUrls</span>、<span className="mono">httpHookAllowedEnvVars</span>、
          <span className="mono">prUrlTemplate</span> 等结构请切换到 <b>JSON</b> 视图。未知字段保存时原样保留。
        </div>
      </div>
    </div>
  );
}

// -------- Field primitives --------

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/** 按点号路径读取嵌套字段，例如 readPath(o, 'attribution.commit') */
function readPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (!isObj(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * 不可变写入嵌套字段。
 * - 值为 undefined / '' / null 时删除该字段；嵌套时若父对象因此变空则一并删除。
 * - 顶层 array 不做嵌套处理（settings.json schema 里也没有 path 进数组的需求）
 */
function updateAtPath(obj: Record<string, unknown> | unknown, path: string, value: unknown): Record<string, unknown> {
  const base: Record<string, unknown> = isObj(obj) ? { ...obj } : {};
  const parts = path.split('.');
  if (parts.length === 1) {
    if (value === undefined || value === '' || value === null) delete base[parts[0]];
    else base[parts[0]] = value;
    return base;
  }
  const [head, ...rest] = parts;
  const child = isObj(base[head]) ? base[head] as Record<string, unknown> : {};
  const updated = updateAtPath(child, rest.join('.'), value);
  if (Object.keys(updated).length === 0) delete base[head];
  else base[head] = updated;
  return base;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 12, padding: '18px 22px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', marginBottom: subtitle ? 4 : 14 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11.5, color: 'var(--cc-muted)', marginBottom: 14 }}>{subtitle}</div>}
      <div style={{ display: 'grid', gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>
      <div>
        <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--cc-muted)', lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function BoolField({ label, hint, value, editing, onChange }: { label: string; hint?: string; value: unknown; editing: boolean; onChange: (v: boolean | undefined) => void }) {
  const checked = value === true;
  return (
    <Field label={label} hint={hint}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: editing ? 'pointer' : 'default', opacity: editing ? 1 : 0.75 }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={!editing}
          onChange={e => onChange(e.target.checked ? true : undefined)}
        />
        <span style={{ fontSize: 12, color: 'var(--cc-ink-soft)' }}>{checked ? '启用' : '未设置 / 默认'}</span>
      </label>
    </Field>
  );
}

function TextInput({ value, editing, placeholder, onChange }: { value: string; editing: boolean; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      disabled={!editing}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={inputStyle(editing)}
    />
  );
}

function SelectInput({ value, editing, options, onChange }: { value: string; editing: boolean; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      disabled={!editing}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle(editing), paddingRight: 10 }}
    >
      {options.map(o => <option key={o} value={o}>{o === '' ? '（未设置）' : o}</option>)}
    </select>
  );
}

function StringListField({ value, editing, placeholder, onChange }: {
  value: unknown;
  editing: boolean;
  placeholder?: string;
  onChange: (next: string[] | undefined) => void;
}) {
  const list: string[] = Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
  const update = (next: string[]) => onChange(next.length === 0 ? undefined : next);
  const setAt = (i: number, v: string) => update(list.map((x, idx) => idx === i ? v : x));
  const remove = (i: number) => update(list.filter((_, idx) => idx !== i));
  const add = () => update([...list, '']);
  return (
    <div>
      {list.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--cc-muted)', fontStyle: 'italic', marginBottom: 8 }}>未配置</div>
      )}
      <div style={{ display: 'grid', gap: 6 }}>
        {list.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
            <input
              value={s}
              disabled={!editing}
              placeholder={placeholder}
              onChange={e => setAt(i, e.target.value)}
              style={inputStyle(editing)}
            />
            {editing ? (
              <button type="button" onClick={() => remove(i)} style={{ ...iconBtn, color: 'var(--cc-orange-deep)' }}>删除</button>
            ) : <span style={{ width: 48 }} />}
          </div>
        ))}
      </div>
      {editing && (
        <button type="button" onClick={add} style={{ marginTop: 10, ...iconBtn, color: 'var(--cc-orange-deep)' }}>＋ 新增条目</button>
      )}
    </div>
  );
}

function NumberInput({ value, editing, onChange }: { value: number | undefined; editing: boolean; onChange: (v: number | undefined) => void }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      disabled={!editing}
      onChange={e => {
        const t = e.target.value;
        if (t === '') onChange(undefined);
        else {
          const n = Number(t);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
      style={{ ...inputStyle(editing), width: 140 }}
    />
  );
}

function inputStyle(editing: boolean): React.CSSProperties {
  return {
    width: '100%', height: 32, borderRadius: 7,
    border: '1px solid var(--cc-line-strong)',
    background: editing ? 'var(--cc-bg)' : 'var(--cc-bg-sunk)',
    padding: '0 10px', fontSize: 12.5,
    fontFamily: 'JetBrains Mono, monospace',
    color: 'var(--cc-ink)',
  };
}

// -------- Env editor --------

const SENSITIVE = /(KEY|TOKEN|SECRET|PASSWORD|PASS|PWD)/i;

function EnvEditor({ value, editing, onChange }: {
  value: Record<string, string>;
  editing: boolean;
  onChange: (next: Record<string, string>) => void;
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const entries = Object.entries(value);

  const rename = (oldKey: string, newKey: string) => {
    if (!newKey || newKey === oldKey) return;
    const next: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (k === oldKey) next[newKey] = v;
      else next[k] = v;
    }
    onChange(next);
  };
  const setVal = (key: string, v: string) => onChange({ ...value, [key]: v });
  const remove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };
  const add = () => {
    let key = 'NEW_VAR';
    let i = 1;
    while (key in value) { key = `NEW_VAR_${i++}`; }
    onChange({ ...value, [key]: '' });
  };

  return (
    <div>
      {entries.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--cc-muted)', fontStyle: 'italic', marginBottom: 8 }}>未配置环境变量</div>
      )}
      <div style={{ display: 'grid', gap: 6 }}>
        {entries.map(([k, v]) => {
          const sensitive = SENSITIVE.test(k);
          const show = revealed[k] || !sensitive;
          return (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 6, alignItems: 'center' }}>
              <input
                value={k}
                disabled={!editing}
                onChange={e => rename(k, e.target.value)}
                style={inputStyle(editing)}
              />
              <input
                value={show ? v : v.length > 0 ? '•'.repeat(Math.min(v.length, 12)) : ''}
                disabled={!editing || !show}
                onChange={e => setVal(k, e.target.value)}
                style={inputStyle(editing)}
              />
              {sensitive ? (
                <button
                  type="button"
                  onClick={() => setRevealed(r => ({ ...r, [k]: !r[k] }))}
                  style={iconBtn}
                  title={show ? '遮罩' : '显示'}
                >{show ? '隐藏' : '显示'}</button>
              ) : <span style={{ width: 48 }} />}
              {editing ? (
                <button type="button" onClick={() => remove(k)} style={{ ...iconBtn, color: 'var(--cc-orange-deep)' }}>删除</button>
              ) : <span style={{ width: 48 }} />}
            </div>
          );
        })}
      </div>
      {editing && (
        <button type="button" onClick={add} style={{ marginTop: 10, ...iconBtn, color: 'var(--cc-orange-deep)' }}>＋ 新增变量</button>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  height: 28, padding: '0 10px', borderRadius: 6,
  background: 'transparent', border: '1px solid var(--cc-line-strong)',
  fontSize: 11.5, cursor: 'pointer', color: 'var(--cc-ink-soft)',
  fontFamily: 'inherit',
};
