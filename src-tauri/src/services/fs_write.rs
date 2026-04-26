use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use chrono::{DateTime, Utc};

use crate::paths;

const MTIME_FMT: &str = "%Y-%m-%d %H:%M";

pub fn format_mtime(t: SystemTime) -> String {
    let dt: DateTime<Utc> = t.into();
    dt.format(MTIME_FMT).to_string()
}

pub fn read_mtime(path: &Path) -> Option<String> {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(format_mtime)
}

fn backup_root() -> PathBuf {
    paths::user_claude_dir().join(".backups")
}

fn backup_file(path: &Path) -> std::io::Result<Option<PathBuf>> {
    if !path.exists() {
        return Ok(None);
    }
    let root = backup_root();
    fs::create_dir_all(&root)?;
    let stamp = Utc::now().format("%Y%m%dT%H%M%S").to_string();
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());
    let dst = root.join(format!("{stamp}-{name}.bak"));
    fs::copy(path, &dst)?;
    Ok(Some(dst))
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct WriteResult {
    pub path: String,
    pub mtime: String,
    pub size_bytes: u64,
    pub backup_path: Option<String>,
}

#[derive(Debug)]
pub enum WriteError {
    NotFound(String),
    Conflict { disk_mtime: String, expected_mtime: String },
    Io(String),
    InvalidJson(String),
    InvalidPath(String),
}

impl std::fmt::Display for WriteError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WriteError::NotFound(p) => write!(f, "文件不存在: {p}"),
            WriteError::Conflict { disk_mtime, expected_mtime } => write!(
                f,
                "文件在编辑期间被修改: 磁盘={disk_mtime}, 预期={expected_mtime}"
            ),
            WriteError::Io(e) => write!(f, "IO 错误: {e}"),
            WriteError::InvalidJson(e) => write!(f, "JSON 解析失败: {e}"),
            WriteError::InvalidPath(p) => write!(f, "路径不允许: {p}"),
        }
    }
}

impl From<WriteError> for String {
    fn from(e: WriteError) -> Self {
        e.to_string()
    }
}

fn ensure_allowed(path: &Path) -> Result<(), WriteError> {
    let canonical = path
        .canonicalize()
        .ok()
        .or_else(|| path.parent().and_then(|p| p.canonicalize().ok()));

    let user_home = paths::home_dir();
    let home_str = user_home.to_string_lossy().to_string();

    let target = canonical.unwrap_or_else(|| path.to_path_buf());
    let target_str = target.to_string_lossy().to_string();

    if !target_str.starts_with(&home_str) {
        return Err(WriteError::InvalidPath(target_str));
    }
    Ok(())
}

pub fn write_text(
    path_str: &str,
    content: &str,
    expected_mtime: Option<&str>,
) -> Result<WriteResult, WriteError> {
    let path = PathBuf::from(path_str);
    ensure_allowed(&path)?;

    if let Some(expected) = expected_mtime {
        if path.exists() {
            let disk = read_mtime(&path).unwrap_or_default();
            if disk != expected {
                return Err(WriteError::Conflict {
                    disk_mtime: disk,
                    expected_mtime: expected.to_string(),
                });
            }
        }
    }

    let backup = backup_file(&path).map_err(|e| WriteError::Io(e.to_string()))?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| WriteError::Io(e.to_string()))?;
    }

    let tmp = path.with_extension(format!(
        "{}.ccm.tmp",
        path.extension()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default()
    ));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| WriteError::Io(e.to_string()))?;
        f.write_all(content.as_bytes())
            .map_err(|e| WriteError::Io(e.to_string()))?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, &path).map_err(|e| WriteError::Io(e.to_string()))?;

    let size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let mtime = read_mtime(&path).unwrap_or_default();

    Ok(WriteResult {
        path: path.to_string_lossy().to_string(),
        mtime,
        size_bytes,
        backup_path: backup.map(|p| p.to_string_lossy().to_string()),
    })
}

pub fn write_json(
    path_str: &str,
    content: &str,
    expected_mtime: Option<&str>,
) -> Result<WriteResult, WriteError> {
    serde_json::from_str::<serde_json::Value>(content)
        .map_err(|e| WriteError::InvalidJson(e.to_string()))?;
    write_text(path_str, content, expected_mtime)
}

pub fn detect_external_change(path_str: &str, since_mtime: &str) -> Result<bool, WriteError> {
    let path = PathBuf::from(path_str);
    if !path.exists() {
        return Err(WriteError::NotFound(path_str.to_string()));
    }
    let disk = read_mtime(&path).unwrap_or_default();
    Ok(disk != since_mtime)
}

#[derive(Debug)]
pub enum CreateError {
    AlreadyExists(String),
    InvalidPath(String),
    Io(String),
}

impl std::fmt::Display for CreateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CreateError::AlreadyExists(p) => write!(f, "目标已存在: {p}"),
            CreateError::InvalidPath(p) => write!(f, "路径不允许: {p}"),
            CreateError::Io(e) => write!(f, "IO 错误: {e}"),
        }
    }
}

impl From<CreateError> for String {
    fn from(e: CreateError) -> Self {
        e.to_string()
    }
}

pub fn create_file(path_str: &str, content: &str) -> Result<WriteResult, CreateError> {
    let path = PathBuf::from(path_str);
    ensure_allowed_for_create(&path)?;
    if path.exists() {
        return Err(CreateError::AlreadyExists(path_str.to_string()));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| CreateError::Io(e.to_string()))?;
    }
    fs::write(&path, content).map_err(|e| CreateError::Io(e.to_string()))?;
    let size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let mtime = read_mtime(&path).unwrap_or_default();
    Ok(WriteResult {
        path: path.to_string_lossy().to_string(),
        mtime,
        size_bytes,
        backup_path: None,
    })
}

pub fn create_dir(path_str: &str) -> Result<(), CreateError> {
    let path = PathBuf::from(path_str);
    ensure_allowed_for_create(&path)?;
    if path.exists() {
        return Err(CreateError::AlreadyExists(path_str.to_string()));
    }
    fs::create_dir_all(&path).map_err(|e| CreateError::Io(e.to_string()))?;
    Ok(())
}

pub fn delete_path(path_str: &str) -> Result<(), CreateError> {
    let path = PathBuf::from(path_str);
    ensure_allowed_for_create(&path)?;
    if !path.exists() {
        return Ok(());
    }
    // back up single files before deleting; dirs skip backup
    if path.is_file() {
        backup_file(&path).map_err(|e| CreateError::Io(e.to_string()))?;
        fs::remove_file(&path).map_err(|e| CreateError::Io(e.to_string()))?;
    } else if path.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| CreateError::Io(e.to_string()))?;
    }
    Ok(())
}

pub fn read_text(path_str: &str) -> Result<String, CreateError> {
    let path = PathBuf::from(path_str);
    ensure_allowed_for_create(&path)?;
    fs::read_to_string(&path).map_err(|e| CreateError::Io(e.to_string()))
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct ReadMeta {
    pub content: String,
    pub mtime: String,
    pub size_bytes: u64,
    pub exists: bool,
}

pub fn read_text_meta(path_str: &str) -> Result<ReadMeta, CreateError> {
    let path = PathBuf::from(path_str);
    ensure_allowed_for_create(&path)?;
    if !path.exists() {
        return Ok(ReadMeta { content: String::new(), mtime: String::new(), size_bytes: 0, exists: false });
    }
    let content = fs::read_to_string(&path).map_err(|e| CreateError::Io(e.to_string()))?;
    let meta = fs::metadata(&path).map_err(|e| CreateError::Io(e.to_string()))?;
    let mtime = meta.modified().ok().map(format_mtime).unwrap_or_default();
    Ok(ReadMeta { size_bytes: meta.len(), mtime, content, exists: true })
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct SkillFileEntry {
    pub name: String,
    pub relative_path: String,
    pub source_path: String,
    pub size_bytes: u64,
    pub mtime: String,
    pub is_dir: bool,
}

pub fn list_skill_files(skill_dir_str: &str) -> Result<Vec<SkillFileEntry>, CreateError> {
    let skill_dir = PathBuf::from(skill_dir_str);
    ensure_allowed_for_create(&skill_dir)?;
    if !skill_dir.exists() {
        return Err(CreateError::Io(format!("目录不存在: {skill_dir_str}")));
    }
    let mut out = vec![];
    walk_skill_dir(&skill_dir, &skill_dir, &mut out);
    out.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(out)
}

fn walk_skill_dir(base: &Path, dir: &Path, out: &mut Vec<SkillFileEntry>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let p = entry.path();
        let rel = p.strip_prefix(base).unwrap_or(&p).to_string_lossy().to_string();
        let name = p
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let is_dir = p.is_dir();
        let size_bytes = if is_dir {
            0
        } else {
            fs::metadata(&p).map(|m| m.len()).unwrap_or(0)
        };
        let mtime = read_mtime(&p).unwrap_or_default();
        out.push(SkillFileEntry {
            name,
            relative_path: rel,
            source_path: p.to_string_lossy().to_string(),
            size_bytes,
            mtime,
            is_dir,
        });
        if is_dir {
            walk_skill_dir(base, &p, out);
        }
    }
}

/// 读取 ~/.claude.json 中的 mcpServers 段，包装为独立的 `{ "mcpServers": {...} }` JSON。
/// 这样前端编辑界面只看到 MCP 部分，避免误改其它字段。
pub fn read_user_mcp_servers() -> Result<ReadMeta, CreateError> {
    let path = paths::home_dir().join(".claude.json");
    if !path.exists() {
        let content = "{\n  \"mcpServers\": {}\n}\n".to_string();
        return Ok(ReadMeta { content, mtime: String::new(), size_bytes: 0, exists: false });
    }
    let raw = fs::read_to_string(&path).map_err(|e| CreateError::Io(e.to_string()))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| CreateError::Io(e.to_string()))?;
    let servers = parsed.get("mcpServers").cloned().unwrap_or(serde_json::json!({}));
    let wrapped = serde_json::json!({ "mcpServers": servers });
    let content = serde_json::to_string_pretty(&wrapped)
        .map_err(|e| CreateError::Io(e.to_string()))? + "\n";
    let meta = fs::metadata(&path).map_err(|e| CreateError::Io(e.to_string()))?;
    let mtime = meta.modified().ok().map(format_mtime).unwrap_or_default();
    Ok(ReadMeta { content, mtime, size_bytes: meta.len(), exists: true })
}

/// 把前端编辑后的 mcpServers 段合并回 ~/.claude.json，保留其它字段。
/// `wrapped_content` 是形如 `{ "mcpServers": {...} }` 的 JSON 字符串。
pub fn write_user_mcp_servers(
    wrapped_content: &str,
    expected_mtime: Option<&str>,
) -> Result<WriteResult, WriteError> {
    let path = paths::home_dir().join(".claude.json");

    let wrapped: serde_json::Value = serde_json::from_str(wrapped_content)
        .map_err(|e| WriteError::InvalidJson(e.to_string()))?;
    let new_servers = wrapped
        .get("mcpServers")
        .cloned()
        .unwrap_or(serde_json::json!({}));

    if let Some(expected) = expected_mtime {
        if path.exists() {
            let disk = read_mtime(&path).unwrap_or_default();
            if disk != expected {
                return Err(WriteError::Conflict {
                    disk_mtime: disk,
                    expected_mtime: expected.to_string(),
                });
            }
        }
    }

    let mut full: serde_json::Value = if path.exists() {
        let raw = fs::read_to_string(&path).map_err(|e| WriteError::Io(e.to_string()))?;
        serde_json::from_str(&raw).map_err(|e| WriteError::InvalidJson(e.to_string()))?
    } else {
        serde_json::json!({})
    };

    if let Some(obj) = full.as_object_mut() {
        obj.insert("mcpServers".to_string(), new_servers);
    } else {
        full = serde_json::json!({ "mcpServers": new_servers });
    }

    let text = serde_json::to_string_pretty(&full)
        .map_err(|e| WriteError::Io(e.to_string()))? + "\n";

    write_text(&path.to_string_lossy(), &text, None)
}

fn ensure_allowed_for_create(path: &Path) -> Result<(), CreateError> {
    let canonical = path
        .canonicalize()
        .ok()
        .or_else(|| path.parent().and_then(|p| p.canonicalize().ok()));

    let user_home = paths::home_dir();
    let home_str = user_home.to_string_lossy().to_string();

    let target = canonical.unwrap_or_else(|| path.to_path_buf());
    let target_str = target.to_string_lossy().to_string();

    if !target_str.starts_with(&home_str) {
        return Err(CreateError::InvalidPath(target_str));
    }
    Ok(())
}
