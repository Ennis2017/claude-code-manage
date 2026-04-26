// Claude Code 命令百科数据源
// 数据来源：https://code.claude.com/docs/en/commands · /cli-reference · /settings
// 同步时间：2026-04，对齐 Claude Code 2.1.x
// 维护时机：每次 Claude Code CLI 有新版本时，重新抓取上述三页对比

export type CommandCategory =
  | 'session'
  | 'config'
  | 'mode'
  | 'extension'
  | 'mcp'
  | 'diagnostic'
  | 'web'
  | 'workflow'
  | 'cli';

export interface CommandEntry {
  name: string;
  category: CommandCategory;
  desc: string;
  usage: string;
  example?: string;
  notes?: string;
  aliases?: string[];
  /** 'skill' = bundled skill（prompt-driven），其余为内建命令或 CLI flag */
  kind?: 'skill' | 'flag';
}

// ----------------------------------------------------------------------------
// 内置斜杠命令（交互式会话中可用）
// ----------------------------------------------------------------------------

export const SLASH_COMMANDS: CommandEntry[] = [
  // ─── session（会话 / 上下文）───
  { name: '/clear', category: 'session', aliases: ['/reset', '/new'], desc: '清空当前对话上下文，开启新会话；旧会话仍可在 /resume 找到', usage: '/clear' },
  { name: '/compact', category: 'session', desc: '把历史消息压缩成摘要，释放上下文；可传入聚焦指令', usage: '/compact [instructions]', example: '/compact 保留错误处理决策', notes: '上下文超 80% 时推荐' },
  { name: '/resume', category: 'session', aliases: ['/continue'], desc: '恢复一个历史会话（按 ID/名字或交互选择）', usage: '/resume [session]' },
  { name: '/branch', category: 'session', aliases: ['/fork'], desc: '从当前会话点分叉出新 session，原会话保留', usage: '/branch [name]' },
  { name: '/rewind', category: 'session', aliases: ['/checkpoint', '/undo'], desc: '把对话和/或代码回滚到之前某个时间点', usage: '/rewind' },
  { name: '/export', category: 'session', desc: '把当前对话导出为纯文本（剪贴板或文件）', usage: '/export [filename]', example: '/export ./session.md' },
  { name: '/recap', category: 'session', desc: '生成当前会话的一行摘要', usage: '/recap' },
  { name: '/rename', category: 'session', desc: '为当前 session 命名，名字会显示在 prompt bar', usage: '/rename [name]' },
  { name: '/exit', category: 'session', aliases: ['/quit'], desc: '退出 Claude Code 会话', usage: '/exit' },
  { name: '/context', category: 'session', desc: '可视化当前上下文占用（按工具/记忆分组），给出优化建议', usage: '/context' },
  { name: '/tasks', category: 'session', aliases: ['/bashes'], desc: '查看与管理后台 Bash 任务', usage: '/tasks' },
  { name: '/diff', category: 'session', desc: '交互式 diff viewer：浏览未提交改动与每轮变更', usage: '/diff' },

  // ─── config（配置）───
  { name: '/config', category: 'config', aliases: ['/settings'], desc: '打开设置界面：主题 / 模型 / output style / 偏好', usage: '/config' },
  { name: '/model', category: 'config', desc: '切换当前会话使用的模型（alias 或完整模型名）', usage: '/model [name]', example: '/model opus' },
  { name: '/effort', category: 'config', desc: '调整模型推理 effort：low / medium / high / xhigh / max / auto', usage: '/effort [level|auto]', example: '/effort high' },
  { name: '/memory', category: 'config', desc: '编辑 CLAUDE.md 记忆文件，开关 auto-memory', usage: '/memory' },
  { name: '/permissions', category: 'config', aliases: ['/allowed-tools'], desc: '管理工具权限规则（allow / ask / deny）', usage: '/permissions' },
  { name: '/hooks', category: 'config', desc: '查看 Hook 事件与对应脚本配置', usage: '/hooks' },
  { name: '/add-dir', category: 'config', desc: '把额外目录加入当前 session 的允许访问范围', usage: '/add-dir <path>', example: '/add-dir ~/code/shared-lib' },
  { name: '/keybindings', category: 'config', desc: '打开或新建 keybindings 配置文件', usage: '/keybindings' },
  { name: '/theme', category: 'config', desc: '切换主题（auto / light / dark / daltonized / ANSI / 自定义）', usage: '/theme' },
  { name: '/color', category: 'config', desc: '设置 prompt bar 颜色（red/blue/green/yellow/...）', usage: '/color [color|default]', example: '/color orange' },
  { name: '/tui', category: 'config', desc: '切换终端 UI 渲染器（fullscreen / default）并重启', usage: '/tui [default|fullscreen]' },
  { name: '/statusline', category: 'config', desc: '配置自定义状态栏（描述需求或自动从 shell prompt 生成）', usage: '/statusline' },
  { name: '/privacy-settings', category: 'config', desc: '查看与更新隐私设置（Pro / Max 专属）', usage: '/privacy-settings' },
  { name: '/setup-bedrock', category: 'config', desc: '配置 Amazon Bedrock 鉴权与 region', usage: '/setup-bedrock', notes: '需 CLAUDE_CODE_USE_BEDROCK=1' },
  { name: '/setup-vertex', category: 'config', desc: '配置 Google Vertex AI 鉴权与 region', usage: '/setup-vertex', notes: '需 CLAUDE_CODE_USE_VERTEX=1' },
  { name: '/terminal-setup', category: 'config', desc: '为支持的终端配置 Shift+Enter 等键位（仅在需要的终端显示）', usage: '/terminal-setup' },

  // ─── mode（模式 / 执行风格）───
  { name: '/plan', category: 'mode', desc: '进入 plan 模式：只分析与规划，不实际改代码', usage: '/plan [description]', example: '/plan 修复登录 bug' },
  { name: '/fast', category: 'mode', desc: '切换 fast mode（更快的输出模式，仅 Opus 4.6 支持）', usage: '/fast [on|off]' },
  { name: '/sandbox', category: 'mode', desc: '切换 sandbox 模式（仅在受支持平台可用）', usage: '/sandbox' },
  { name: '/focus', category: 'mode', desc: '切换聚焦视图：只显示最近 prompt 与最终响应（仅 fullscreen）', usage: '/focus' },

  // ─── extension（扩展）───
  { name: '/agents', category: 'extension', desc: '管理 subagents 配置（按 source 分组）', usage: '/agents' },
  { name: '/skills', category: 'extension', desc: '列出已安装 skills（按 t 排序按 token 数）', usage: '/skills' },
  { name: '/plugin', category: 'extension', desc: '管理插件：install / list / enable / disable / uninstall / update', usage: '/plugin' },
  { name: '/reload-plugins', category: 'extension', desc: '热加载所有启用的插件，无需重启', usage: '/reload-plugins' },
  { name: '/init', category: 'extension', desc: '为当前项目生成 CLAUDE.md 初始记忆', usage: '/init', notes: 'CLAUDE_CODE_NEW_INIT=1 启用交互式向导' },

  // ─── mcp ───
  { name: '/mcp', category: 'mcp', desc: '管理 MCP server 连接与 OAuth 鉴权', usage: '/mcp' },

  // ─── workflow（任务 / 审查 / Skill 化命令）───
  { name: '/review', category: 'workflow', desc: '本地 review 一个 PR（深度审查见 /ultrareview）', usage: '/review [PR]', example: '/review 42' },
  { name: '/security-review', category: 'workflow', desc: '分析当前分支待提交改动，识别安全漏洞', usage: '/security-review' },
  { name: '/simplify', category: 'workflow', kind: 'skill', desc: '【bundled skill】并行 3 个 agent 审查最近改动并修复', usage: '/simplify [focus]', example: '/simplify focus on memory efficiency' },
  { name: '/batch', category: 'workflow', kind: 'skill', desc: '【bundled skill】把大型变更拆成 5–30 个并行单元，分别开 PR', usage: '/batch <instruction>', example: '/batch migrate src/ from Solid to React', notes: '需要 git 仓库' },
  { name: '/loop', category: 'workflow', kind: 'skill', aliases: ['/proactive'], desc: '【bundled skill】定时或自适应地循环执行一个 prompt', usage: '/loop [interval] [prompt]', example: '/loop 5m check if the deploy finished' },
  { name: '/claude-api', category: 'workflow', kind: 'skill', desc: '【bundled skill】加载 Anthropic SDK 参考；migrate 升级模型；managed-agents-onboard 创建 Managed Agent', usage: '/claude-api [migrate|managed-agents-onboard]' },
  { name: '/fewer-permission-prompts', category: 'workflow', kind: 'skill', desc: '【bundled skill】扫描历史并把常用只读命令加到项目 allow 列表', usage: '/fewer-permission-prompts' },
  { name: '/debug', category: 'workflow', kind: 'skill', desc: '【bundled skill】打开 debug 日志并辅助排错', usage: '/debug [description]' },
  { name: '/team-onboarding', category: 'workflow', desc: '基于 30 天使用记录生成团队 onboarding 文档', usage: '/team-onboarding' },
  { name: '/schedule', category: 'workflow', aliases: ['/routines'], desc: '创建 / 更新 / 列出 / 运行 routines（定时 agent）', usage: '/schedule [description]' },
  { name: '/copy', category: 'workflow', desc: '复制最近一条 assistant 响应（含 N / 选择 code block / 写入文件）', usage: '/copy [N]', example: '/copy 2' },
  { name: '/btw', category: 'workflow', desc: '问一个不进入对话历史的「侧问题」', usage: '/btw <question>' },
  { name: '/voice', category: 'workflow', desc: '切换语音听写：hold / tap / off（需 claude.ai 账号）', usage: '/voice [hold|tap|off]' },
  { name: '/powerup', category: 'workflow', desc: '通过交互式课程发现 Claude Code 功能（带动画演示）', usage: '/powerup' },

  // ─── web（远程 / Web / IDE / 桌面 / 移动）───
  { name: '/autofix-pr', category: 'web', desc: '在 Web 上派 session 监听当前 PR；CI 失败/有评论时自动推 fix', usage: '/autofix-pr [prompt]', example: '/autofix-pr only fix lint and type errors', notes: '需要 gh CLI' },
  { name: '/ultraplan', category: 'web', desc: '在 ultraplan 中起草计划，浏览器 review 后再回本地或远程执行', usage: '/ultraplan <prompt>' },
  { name: '/ultrareview', category: 'web', desc: '云端多 agent 深度代码 review（cloud sandbox）', usage: '/ultrareview [PR]' },
  { name: '/remote-control', category: 'web', aliases: ['/rc'], desc: '让 claude.ai 可远程控制此 session', usage: '/remote-control' },
  { name: '/remote-env', category: 'web', desc: '配置 --remote 启动的 web session 默认环境', usage: '/remote-env' },
  { name: '/teleport', category: 'web', aliases: ['/tp'], desc: '把 web session 拉到本地 terminal（拉分支 + 对话）', usage: '/teleport' },
  { name: '/desktop', category: 'web', aliases: ['/app'], desc: '把当前 session 接到 Claude Code 桌面 app（macOS / Windows）', usage: '/desktop' },
  { name: '/mobile', category: 'web', aliases: ['/ios', '/android'], desc: '显示 QR 码以下载 Claude 移动 app', usage: '/mobile' },
  { name: '/web-setup', category: 'web', desc: '通过本地 gh 凭据连接 GitHub 到 Claude Code on the web', usage: '/web-setup' },
  { name: '/chrome', category: 'web', desc: '配置 Claude in Chrome 浏览器集成', usage: '/chrome' },
  { name: '/ide', category: 'web', desc: '管理 IDE 集成（VS Code / JetBrains 等插件）', usage: '/ide' },
  { name: '/install-github-app', category: 'web', desc: '为某个 repo 配置 Claude GitHub Actions app', usage: '/install-github-app' },
  { name: '/install-slack-app', category: 'web', desc: '安装 Claude Slack app（OAuth）', usage: '/install-slack-app' },

  // ─── diagnostic（诊断 / 反馈 / 账号）───
  { name: '/help', category: 'diagnostic', desc: '显示帮助和所有可用命令', usage: '/help' },
  { name: '/doctor', category: 'diagnostic', desc: '诊断 Claude Code 安装与设置（按 f 让 Claude 修复）', usage: '/doctor' },
  { name: '/status', category: 'diagnostic', desc: '打开 Settings 界面 Status tab：版本 / 账号 / 连接性', usage: '/status' },
  { name: '/usage', category: 'diagnostic', aliases: ['/cost', '/stats'], desc: '查看 token 用量、费用与活动统计', usage: '/usage' },
  { name: '/insights', category: 'diagnostic', desc: '生成 Claude Code 使用洞察报告（项目领域 / 摩擦点）', usage: '/insights' },
  { name: '/release-notes', category: 'diagnostic', desc: '查看版本更新说明（带版本选择器）', usage: '/release-notes' },
  { name: '/heapdump', category: 'diagnostic', desc: '把 JS 堆快照写到 ~/Desktop（诊断高内存）', usage: '/heapdump' },
  { name: '/feedback', category: 'diagnostic', aliases: ['/bug'], desc: '向官方提交反馈或 bug', usage: '/feedback [report]' },
  { name: '/login', category: 'diagnostic', desc: '登录 Anthropic 账号', usage: '/login' },
  { name: '/logout', category: 'diagnostic', desc: '登出当前 Anthropic 账号', usage: '/logout' },
  { name: '/upgrade', category: 'diagnostic', desc: '打开升级页切换到更高 plan tier', usage: '/upgrade' },
  { name: '/extra-usage', category: 'diagnostic', desc: '配置 extra usage：rate limit 后继续工作', usage: '/extra-usage' },
  { name: '/passes', category: 'diagnostic', desc: '免费分享一周 Claude Code 给朋友（需账号符合资格）', usage: '/passes' },
  { name: '/stickers', category: 'diagnostic', desc: '订一份 Claude Code 贴纸', usage: '/stickers' },
];

// ----------------------------------------------------------------------------
// CLI 子命令（在终端中以 `claude <subcmd>` 调用）
// 数据来自 `claude --help` / `claude <subcmd> --help`
// ----------------------------------------------------------------------------

export const CLI_COMMANDS: CommandEntry[] = [
  // ─── 启动 / 会话 ───
  { name: 'claude', category: 'cli', desc: '启动交互式会话；附 prompt 可直接预填', usage: 'claude [options] [prompt]', example: 'claude "解释这份代码"' },
  { name: 'claude -p', category: 'cli', desc: '一次性 print 模式，输出后退出（适合 pipe / 脚本）', usage: 'claude -p [options] [prompt]', example: 'echo "hi" | claude -p' },
  { name: 'claude -c', category: 'cli', desc: '继续当前目录最近一次会话', usage: 'claude -c' },
  { name: 'claude -r', category: 'cli', desc: '恢复指定会话（ID 或名字），或打开交互选择器', usage: 'claude -r [session-id-or-name]', example: 'claude -r auth-refactor' },

  // ─── 安装 / 更新 / 鉴权 ───
  { name: 'claude install', category: 'cli', desc: '安装 Claude Code 原生构建（stable / latest / 指定版本）', usage: 'claude install [stable|latest|<version>]', example: 'claude install stable' },
  { name: 'claude update', category: 'cli', desc: '检查并安装 Claude Code 更新', usage: 'claude update' },
  { name: 'claude doctor', category: 'cli', desc: '检查自动更新器健康状态', usage: 'claude doctor' },
  { name: 'claude auth login', category: 'cli', desc: '登录 Anthropic 账号（--sso / --console / --email 可选）', usage: 'claude auth login [--sso] [--console] [--email <addr>]', example: 'claude auth login --console' },
  { name: 'claude auth logout', category: 'cli', desc: '登出 Anthropic 账号', usage: 'claude auth logout' },
  { name: 'claude auth status', category: 'cli', desc: '查询登录状态（JSON 或 --text）；exit 0=已登录、1=未登录', usage: 'claude auth status [--text]' },
  { name: 'claude setup-token', category: 'cli', desc: '生成长期 OAuth token（用于 CI / 脚本，需 Claude 订阅）', usage: 'claude setup-token' },

  // ─── 配置 / 子系统 ───
  { name: 'claude agents', category: 'cli', desc: '列出所有已配置的 subagents（按 source 分组）', usage: 'claude agents' },
  { name: 'claude auto-mode defaults', category: 'cli', desc: '打印内置 auto mode 分类器规则（JSON）', usage: 'claude auto-mode defaults', example: 'claude auto-mode defaults > rules.json' },
  { name: 'claude auto-mode config', category: 'cli', desc: '查看应用 settings 后的有效 auto mode 配置', usage: 'claude auto-mode config' },
  { name: 'claude remote-control', category: 'cli', desc: '启动 Remote Control 服务器，接受 claude.ai / Claude app 控制', usage: 'claude remote-control [--name <s>]', example: 'claude remote-control --name "My Project"' },

  // ─── MCP 子命令（mcp 分类，方便筛选）───
  { name: 'claude mcp', category: 'mcp', desc: 'MCP 服务器管理总入口', usage: 'claude mcp <subcommand>' },
  { name: 'claude mcp add', category: 'mcp', desc: '添加 MCP server（stdio / sse / http）', usage: 'claude mcp add [-t stdio|sse|http] [-e KEY=VAL] [-H "Header: v"] <name> <cmd-or-url> [args...]', example: 'claude mcp add --transport http sentry https://mcp.sentry.dev/mcp' },
  { name: 'claude mcp add-json', category: 'mcp', desc: '用 JSON 字符串添加 MCP server', usage: 'claude mcp add-json <name> <json>', example: 'claude mcp add-json my \'{"command":"npx","args":["srv"]}\'' },
  { name: 'claude mcp list', category: 'mcp', desc: '列出当前作用域所有 MCP server', usage: 'claude mcp list' },
  { name: 'claude mcp get', category: 'mcp', desc: '查看指定 MCP server 详情', usage: 'claude mcp get <name>' },
  { name: 'claude mcp remove', category: 'mcp', desc: '移除一个 MCP server', usage: 'claude mcp remove <name>' },
  { name: 'claude mcp serve', category: 'mcp', desc: '把 Claude Code 自身暴露为 MCP server', usage: 'claude mcp serve [options]' },

  // ─── Plugin 子命令 ───
  { name: 'claude plugin', category: 'extension', desc: '插件管理（alias: claude plugins）', usage: 'claude plugin <subcommand>' },
  { name: 'claude plugin install', category: 'extension', desc: '从启用的 marketplace 安装一个插件', usage: 'claude plugin install <plugin[@marketplace]>', example: 'claude plugin install code-review@claude-plugins-official' },
  { name: 'claude plugin marketplace', category: 'extension', desc: '管理 Claude Code 插件市场', usage: 'claude plugin marketplace' },

  // ─── 元信息 ───
  { name: 'claude --version', category: 'cli', aliases: ['claude -v'], desc: '输出当前 CLI 版本号', usage: 'claude --version' },
  { name: 'claude --help', category: 'cli', desc: '显示 CLI 帮助（注意：不会列出全部 flag）', usage: 'claude --help' },

  // ─── 常用 flags（kind:'flag'，仅展示，不在终端独立运行）───
  { name: '--print, -p', category: 'cli', kind: 'flag', desc: '打印响应后退出（headless 模式）', usage: 'claude -p [options] "query"' },
  { name: '--continue, -c', category: 'cli', kind: 'flag', desc: '加载当前目录最近一次会话', usage: 'claude --continue' },
  { name: '--resume, -r', category: 'cli', kind: 'flag', desc: '恢复某个 session（ID 或名字），或打开 picker', usage: 'claude --resume [session]' },
  { name: '--model', category: 'cli', kind: 'flag', desc: '指定本次 session 使用的模型（alias 或全名）', usage: 'claude --model <name>', example: 'claude --model claude-sonnet-4-6' },
  { name: '--effort', category: 'cli', kind: 'flag', desc: '设置本次 session 的 effort：low / medium / high / xhigh / max', usage: 'claude --effort <level>', example: 'claude --effort high' },
  { name: '--add-dir', category: 'cli', kind: 'flag', desc: '为本次 session 加额外可访问目录（仅文件权限，不发现 .claude/ 配置）', usage: 'claude --add-dir <path...>', example: 'claude --add-dir ../apps ../lib' },
  { name: '--permission-mode', category: 'cli', kind: 'flag', desc: '指定权限模式（default/acceptEdits/plan/auto/dontAsk/bypassPermissions）', usage: 'claude --permission-mode <mode>', example: 'claude --permission-mode plan' },
  { name: '--dangerously-skip-permissions', category: 'cli', kind: 'flag', desc: '完全跳过权限提示（= --permission-mode bypassPermissions）', usage: 'claude --dangerously-skip-permissions' },
  { name: '--allowedTools', category: 'cli', kind: 'flag', desc: '免确认即可使用的工具白名单（permission 规则语法）', usage: 'claude --allowedTools "Bash(git *)" Read', example: '--allowedTools "Bash(git log *)" "Read"' },
  { name: '--disallowedTools', category: 'cli', kind: 'flag', desc: '从模型上下文移除的工具', usage: 'claude --disallowedTools "Edit"' },
  { name: '--tools', category: 'cli', kind: 'flag', desc: '限制内建工具集合（""=全禁、"default"=全开、或如 "Bash,Edit,Read"）', usage: 'claude --tools "Bash,Edit,Read"' },
  { name: '--bare', category: 'cli', kind: 'flag', desc: '极简模式：跳过 hook / skill / plugin / MCP / 自动记忆 自动发现，启动更快', usage: 'claude --bare -p "query"' },
  { name: '--system-prompt', category: 'cli', kind: 'flag', desc: '替换整个默认 system prompt', usage: 'claude --system-prompt "..."' },
  { name: '--append-system-prompt', category: 'cli', kind: 'flag', desc: '在默认 system prompt 末尾追加文本', usage: 'claude --append-system-prompt "Always TS"' },
  { name: '--system-prompt-file', category: 'cli', kind: 'flag', desc: '从文件加载并替换 system prompt', usage: 'claude --system-prompt-file ./prompt.txt' },
  { name: '--append-system-prompt-file', category: 'cli', kind: 'flag', desc: '从文件加载内容追加到默认 system prompt', usage: 'claude --append-system-prompt-file ./rules.txt' },
  { name: '--mcp-config', category: 'cli', kind: 'flag', desc: '从 JSON 文件 / 字符串加载 MCP servers（空格分隔多个）', usage: 'claude --mcp-config ./mcp.json' },
  { name: '--strict-mcp-config', category: 'cli', kind: 'flag', desc: '只用 --mcp-config 指定的 MCP servers，忽略其他来源', usage: 'claude --strict-mcp-config --mcp-config ./mcp.json' },
  { name: '--plugin-dir', category: 'cli', kind: 'flag', desc: '从指定目录加载插件（可重复传入）', usage: 'claude --plugin-dir ./plugins' },
  { name: '--settings', category: 'cli', kind: 'flag', desc: '从 JSON 文件或字符串加载额外 settings', usage: 'claude --settings ./settings.json' },
  { name: '--setting-sources', category: 'cli', kind: 'flag', desc: '指定加载哪些 settings 来源（user / project / local，逗号分隔）', usage: 'claude --setting-sources user,project' },
  { name: '--max-turns', category: 'cli', kind: 'flag', desc: '限制 agentic 轮数（仅 print 模式）', usage: 'claude -p --max-turns 3 "query"' },
  { name: '--max-budget-usd', category: 'cli', kind: 'flag', desc: '美元预算上限（仅 print 模式）', usage: 'claude -p --max-budget-usd 5.00 "query"' },
  { name: '--output-format', category: 'cli', kind: 'flag', desc: 'print 模式输出格式：text / json / stream-json', usage: 'claude -p "query" --output-format json' },
  { name: '--input-format', category: 'cli', kind: 'flag', desc: 'print 模式输入格式：text / stream-json', usage: 'claude -p --input-format stream-json' },
  { name: '--json-schema', category: 'cli', kind: 'flag', desc: '让 print 模式输出符合给定 JSON Schema', usage: 'claude -p --json-schema \'{"type":"object",...}\' "query"' },
  { name: '--include-partial-messages', category: 'cli', kind: 'flag', desc: '在 stream-json 输出中包含 partial 流事件（需 -p）', usage: 'claude -p --output-format stream-json --include-partial-messages "q"' },
  { name: '--include-hook-events', category: 'cli', kind: 'flag', desc: '在 stream-json 输出中包含 hook lifecycle 事件', usage: 'claude -p --output-format stream-json --include-hook-events "q"' },
  { name: '--no-session-persistence', category: 'cli', kind: 'flag', desc: '禁止本次 session 写入磁盘（仅 print 模式）', usage: 'claude -p --no-session-persistence "q"' },
  { name: '--session-id', category: 'cli', kind: 'flag', desc: '使用指定 UUID 作为 session ID', usage: 'claude --session-id "<uuid>"' },
  { name: '--name, -n', category: 'cli', kind: 'flag', desc: '为 session 命名（在 /resume 与终端标题里显示）', usage: 'claude -n "my-feature-work"' },
  { name: '--fork-session', category: 'cli', kind: 'flag', desc: '搭配 --resume / --continue：恢复时新建 session ID 而不是复用', usage: 'claude --resume abc123 --fork-session' },
  { name: '--from-pr', category: 'cli', kind: 'flag', desc: '恢复与某个 PR 关联的 session（接受 PR 号或 URL）', usage: 'claude --from-pr 123' },
  { name: '--worktree, -w', category: 'cli', kind: 'flag', desc: '在 .claude/worktrees/<name> 隔离 git worktree 中启动', usage: 'claude -w feature-auth' },
  { name: '--tmux', category: 'cli', kind: 'flag', desc: '为 worktree 创建 tmux session（需 --worktree）', usage: 'claude -w feature-auth --tmux' },
  { name: '--ide', category: 'cli', kind: 'flag', desc: '启动时自动连接 IDE（需恰好一个有效 IDE）', usage: 'claude --ide' },
  { name: '--remote', category: 'cli', kind: 'flag', desc: '在 claude.ai 上新建一个 web session 执行任务', usage: 'claude --remote "Fix the login bug"' },
  { name: '--remote-control, --rc', category: 'cli', kind: 'flag', desc: '启动可被 claude.ai 远程控制的本地 session', usage: 'claude --rc "My Project"' },
  { name: '--teleport', category: 'cli', kind: 'flag', desc: '把 web session 拉到本地 terminal', usage: 'claude --teleport' },
  { name: '--teammate-mode', category: 'cli', kind: 'flag', desc: 'Agent team 显示模式：auto / in-process / tmux', usage: 'claude --teammate-mode in-process' },
  { name: '--agent', category: 'cli', kind: 'flag', desc: '本次 session 使用指定 agent（覆盖 agent setting）', usage: 'claude --agent my-custom-agent' },
  { name: '--agents', category: 'cli', kind: 'flag', desc: '通过 JSON 动态定义 subagents（含 prompt 字段）', usage: 'claude --agents \'{"reviewer":{...}}\'' },
  { name: '--debug', category: 'cli', kind: 'flag', desc: '开启 debug 模式（可用类别筛选，如 "api,hooks"）', usage: 'claude --debug "api,mcp"' },
  { name: '--debug-file', category: 'cli', kind: 'flag', desc: '把 debug 日志写到指定文件（隐含开启 --debug）', usage: 'claude --debug-file /tmp/claude.log' },
  { name: '--verbose', category: 'cli', kind: 'flag', desc: '开启 verbose 输出，显示完整每轮内容', usage: 'claude --verbose' },
  { name: '--disable-slash-commands', category: 'cli', kind: 'flag', desc: '禁用本次 session 的所有 skills / commands', usage: 'claude --disable-slash-commands' },
  { name: '--exclude-dynamic-system-prompt-sections', category: 'cli', kind: 'flag', desc: '把 cwd / 环境 / 记忆 / git status 移到首条 user 消息（提升 cache 命中）', usage: 'claude -p --exclude-dynamic-system-prompt-sections "q"' },
  { name: '--fallback-model', category: 'cli', kind: 'flag', desc: '默认模型超载时自动 fallback（仅 print 模式）', usage: 'claude -p --fallback-model sonnet "q"' },
  { name: '--betas', category: 'cli', kind: 'flag', desc: '在 API 请求中加入 beta header（仅 API key 用户）', usage: 'claude --betas interleaved-thinking' },
  { name: '--init', category: 'cli', kind: 'flag', desc: '运行初始化 hook 后进入交互式', usage: 'claude --init' },
  { name: '--init-only', category: 'cli', kind: 'flag', desc: '只运行初始化 hook，不进入交互式', usage: 'claude --init-only' },
  { name: '--maintenance', category: 'cli', kind: 'flag', desc: '运行 maintenance hook 后进入交互式', usage: 'claude --maintenance' },
  { name: '--chrome / --no-chrome', category: 'cli', kind: 'flag', desc: '开启 / 关闭 Chrome 浏览器集成', usage: 'claude --chrome' },
];

export const ALL_COMMANDS: CommandEntry[] = [...SLASH_COMMANDS, ...CLI_COMMANDS];

// ----------------------------------------------------------------------------
// 分类元信息
// ----------------------------------------------------------------------------

export interface CategoryMeta {
  id: CommandCategory | 'all';
  label: string;
  color?: 'orange' | 'leaf' | 'sky' | 'plum' | 'ink';
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'all', label: '全部' },
  { id: 'session', label: '会话', color: 'orange' },
  { id: 'config', label: '配置', color: 'sky' },
  { id: 'mode', label: '模式', color: 'leaf' },
  { id: 'extension', label: '扩展', color: 'plum' },
  { id: 'mcp', label: 'MCP', color: 'orange' },
  { id: 'workflow', label: '工作流', color: 'leaf' },
  { id: 'web', label: 'Web/远程', color: 'plum' },
  { id: 'diagnostic', label: '诊断', color: 'sky' },
  { id: 'cli', label: 'CLI / Flag', color: 'ink' },
];

export function countByCategory(id: CommandCategory | 'all'): number {
  if (id === 'all') return ALL_COMMANDS.length;
  return ALL_COMMANDS.filter(c => c.category === id).length;
}

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.filter(c => c.id !== 'all').map(c => [c.id, c.label]),
);

export const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  CATEGORIES.filter(c => c.id !== 'all' && c.color).map(c => [c.id, c.color!]),
);
