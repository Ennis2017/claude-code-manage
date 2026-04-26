# Claude Code Manage

> Claude Code 的桌面配置管理器。直接读写 `~/.claude` 与各项目下的 `.claude/`，统一查看和编辑 settings、记忆、命令、Skills、Agents、MCP 等所有配置入口。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri 2 |
| 前端 | React 19 + TypeScript 5.8 + Vite 7 |
| 状态 | Zustand 5（含 `persist` 中间件） |
| 样式 | TailwindCSS v4 + 内联 CSS 变量主题（Anthropic 风格） |
| 后端 | Rust（serde / chrono / walkdir） |
| 编辑器/差异 | `@monaco-editor/react`、`react-diff-viewer-continued`（已安装，待接入） |
| Markdown | `react-markdown` + `remark-gfm`（已安装，待接入） |

## 包管理器

使用 **bun**（lockfile 为 `bun.lock`）。`tauri.conf.json` 的 `beforeDevCommand` / `beforeBuildCommand` 已配置为 `bun run dev` / `bun run build`。

## 目录结构

```
ClaudeCodeManage/
├── src/                    前端（React）
│   ├── App.tsx             路由分发，初始化时调用 scanAll
│   ├── components/         Rail / InnerSidebar / Topbar / Toast
│   ├── screens/            Dashboard / GlobalConfig / Settings / SettingsFormScreen / FileEditorScreen
│   │                       / EntryDetailScreen / SkillDetailScreen / MemoryScreen / KeybindingsScreen
│   │                       / McpEditorScreen / ProjectDetail / Catalog
│   ├── store/              app-store（UI 状态）/ config-store（后端数据）
│   ├── lib/                fs-bridge / settings-schema / mcp-schema / entry-templates
│   ├── data/commands.ts    命令百科静态数据（每次 CLI 升级时同步）
│   └── index.css           主题变量
├── src-tauri/              后端（Rust）
│   ├── src/
│   │   ├── lib.rs          Tauri commands 注册
│   │   ├── paths.rs        ~/.claude、app data 路径解析（仅 macOS）
│   │   ├── model/mod.rs    所有序列化结构（snapshot / project / file 等）
│   │   └── services/
│   │       ├── scanner.rs       扫描 settings/memory/commands/skills/agents
│   │       ├── project_list.rs  项目注册表读写
│   │       ├── fs_write.rs      安全写盘（mtime 校验 + 备份）
│   │       ├── search.rs        全局文件名 + 内容搜索
│   │       └── watcher.rs       ~/.claude 与项目目录的文件变更监听
│   ├── capabilities/       Tauri 权限
│   └── tauri.conf.json
└── package.json
```

## 核心数据流

```
[启动] App.useEffect → useConfigStore.scanAll()
        ↓ invoke('scan_all')
[Rust] scan_all
        ├── scan_user_config(~/.claude)
        └── for project in projects.json:
              scan_project(.claude/, CLAUDE.md, .mcp.json)
        ↓ ClaudeConfigSnapshot
[Zustand] config-store.snapshot
        ↓
[屏幕] 各 screen 从 snapshot 派生展示数据
```

## 已实现 Tauri 命令

| 命令 | 用途 |
|---|---|
| `scan_all` | 全量扫描，返回 `ClaudeConfigSnapshot` |
| `get_claude_version` | 调用 `claude --version` |
| `get_user_claude_dir` | 返回 `~/.claude` 绝对路径 |
| `list_projects` / `add_project(path, name?)` / `remove_project(path)` | 项目注册表读写 |
| `read_text_file(path)` / `read_text_file_meta(path)` | 读取文件（含 mtime / size） |
| `write_text_file(path, content, expected_mtime?)` | 写文本，可选 mtime 冲突校验 |
| `write_json_file(path, content, expected_mtime?)` | 写 JSON，校验后再落盘 + 备份 |
| `create_file(path, content)` / `create_dir(path)` | 新建文件 / 目录 |
| `delete_path(path)` | 删除（先备份到 `~/.claude/.backups/`） |
| `list_skill_files(path)` | 递归列出 Skill 目录子文件 |
| `detect_external_change(path, since_mtime)` | 编辑保存前的冲突检测 |
| `search_all(query, limit?, case_sensitive?)` | 全局文件名 + 内容搜索（命令面板用） |
| `reveal_in_finder(path)` | macOS Finder 高亮显示 |
| `restart_watcher` | 重启文件 watcher |

## 路径约定

- 用户级配置：`~/.claude/`（settings.json、keybindings.json、CLAUDE.md、commands/、skills/、agents/）
- 项目注册表：`~/Library/Application Support/claude-code-manage/projects.json`
- 项目级配置：`<project>/.claude/`，CLAUDE.md 优先项目根、回退 `.claude/CLAUDE.md`
- MCP：`<project>/.mcp.json`（仅检查存在性）

## 编辑模式状态机（FileEditor / SettingsForm / McpEditor 通用）

```
[只读] ─编辑→ [编辑中(draft)] ─保存→ detect_external_change
                                       ├─ 冲突 → ConflictDialog ─覆盖→ write_*(force)
                                       └─ 一致 → write_*(expected_mtime) → [只读]
                              └─取消→ [只读] 丢弃 draft
```

保存路径：`fs-bridge.ts` → invoke `write_text_file` / `write_json_file` / `create_file`。
JSON 文件写入前由前端 schema（`lib/settings-schema.ts`、`lib/mcp-schema.ts`）做形状校验，未通过时禁用保存按钮。

## 重要约束

- **macOS 限定**：`paths.rs` 用 `HOME` 环境变量，未做 Windows/Linux 适配。
- **不可变更新**：所有 store mutator 走 `set({...})`，禁止就地修改。
- **写盘均经过 `expected_mtime` 冲突检测**：编辑→保存时若磁盘已被外部改写，弹窗让用户选择覆盖或取消。
- **删除前自动备份**：`delete_path` 会先把目标拷贝到 `~/.claude/.backups/`。
- **不做"配置导入/导出"**：项目定位是直接读写 `~/.claude` 与项目 `.claude/`，不再额外维护一份导出格式。如需迁移，复制目录即可。
