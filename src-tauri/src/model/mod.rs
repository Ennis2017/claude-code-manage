use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeConfigSnapshot {
    pub scanned_at: String,
    pub claude_code_version: Option<String>,
    pub user_config: UserConfig,
    pub projects: Vec<ProjectConfig>,
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
