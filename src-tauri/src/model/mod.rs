use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeConfigSnapshot {
    pub scanned_at: String,
    pub claude_code_version: Option<String>,
    pub user_config: UserConfig,
    pub projects: Vec<ProjectConfig>,
    pub plugins: PluginSnapshot,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PluginSnapshot {
    pub plugins_dir: String,
    pub marketplaces: Vec<MarketplaceInfo>,
    pub installed: Vec<InstalledPlugin>,
    /// 解析失败的项的诊断,前端展示在卡片角落
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketplaceInfo {
    pub id: String,
    pub source_kind: String,
    pub source_repo: Option<String>,
    pub source_url: Option<String>,
    pub install_location: String,
    pub last_updated: String,
    pub manifest_path: String,
    pub manifest_exists: bool,
    /// 来自 marketplace.json 的 plugins 数组
    pub advertised: Vec<MarketplacePluginEntry>,
    pub owner_name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketplacePluginEntry {
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub category: Option<String>,
    pub source_summary: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledPlugin {
    /// 形如 "name@marketplace"
    pub key: String,
    pub name: String,
    pub marketplace: String,
    pub version: String,
    pub install_path: String,
    pub install_path_exists: bool,
    pub git_commit_sha: Option<String>,
    pub installed_at: String,
    pub last_updated: String,
    pub scope: String,
    pub enabled: bool,
    /// 来自 .claude-plugin/plugin.json
    pub manifest: PluginManifest,
    pub contents: PluginContents,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PluginManifest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
    pub keywords: Vec<String>,
    pub raw_path: String,
    pub raw_exists: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PluginContents {
    pub skills: Vec<SkillFile>,
    pub agents: Vec<AgentFile>,
    pub commands: Vec<CommandFile>,
    pub hooks_count: usize,
    pub has_mcp: bool,
    pub has_lsp: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserConfig {
    pub settings: Option<SettingsJson>,
    pub keybindings: Option<FileContent>,
    pub memory: Option<FileContent>,
    pub commands: Vec<CommandFile>,
    pub skills: Vec<SkillFile>,
    pub agents: Vec<AgentFile>,
    pub rules: Vec<RuleFile>,
    pub mcp: UserMcpInfo,
    pub oauth_account: Option<OauthAccount>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OauthAccount {
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectConfig {
    pub id: String,
    pub path: String,
    pub name: String,
    pub added_at: String,
    pub settings: Option<SettingsJson>,
    pub local_settings: Option<SettingsJson>,
    pub memory: Option<FileContent>,
    pub commands: Vec<CommandFile>,
    pub skills: Vec<SkillFile>,
    pub agents: Vec<AgentFile>,
    pub rules: Vec<RuleFile>,
    pub has_mcp: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuleFile {
    pub name: String,
    pub source_path: String,
    pub mtime: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct UserMcpInfo {
    pub source_path: String,
    pub exists: bool,
    pub server_count: u64,
    pub mtime: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SettingsJson {
    pub raw: serde_json::Value,
    pub source_path: String,
    pub mtime: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileContent {
    pub content: String,
    pub source_path: String,
    pub mtime: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandFile {
    pub name: String,
    pub source_path: String,
    pub mtime: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillFile {
    pub name: String,
    pub source_path: String,
    pub mtime: String,
    pub description: String,
    pub file_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentFile {
    pub name: String,
    pub source_path: String,
    pub mtime: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RememberedProject {
    pub path: String,
    pub name: String,
    pub added_at: String,
}

impl RememberedProject {
    pub fn id(&self) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut h = DefaultHasher::new();
        self.path.hash(&mut h);
        format!("{:x}", h.finish())
    }
}
