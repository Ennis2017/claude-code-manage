use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::model::*;
use crate::paths;
use crate::services::scanner;

const KNOWN_MARKETPLACES_FILE: &str = "known_marketplaces.json";
const INSTALLED_PLUGINS_FILE: &str = "installed_plugins.json";
const SETTINGS_FILE: &str = "settings.json";

pub fn plugins_dir() -> PathBuf {
    paths::user_claude_dir().join("plugins")
}

/// 整体扫描:解析 known_marketplaces.json + installed_plugins.json,
/// 合并 settings.json 的 enabledPlugins 状态,逐个解析 plugin 元数据与目录内容
pub fn scan() -> PluginSnapshot {
    let dir = plugins_dir();
    let mut snap = PluginSnapshot {
        plugins_dir: dir.to_string_lossy().to_string(),
        marketplaces: Vec::new(),
        installed: Vec::new(),
        warnings: Vec::new(),
    };

    if !dir.exists() {
        return snap;
    }

    let enabled = load_enabled_plugins().unwrap_or_default();

    snap.marketplaces = load_marketplaces(&dir, &mut snap.warnings);
    snap.installed = load_installed(&dir, &enabled, &mut snap.warnings);

    snap.marketplaces.sort_by(|a, b| a.id.cmp(&b.id));
    snap.installed.sort_by(|a, b| a.key.cmp(&b.key));

    snap
}

fn read_json(path: &Path) -> Option<Value> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

/// 从 ~/.claude/settings.json 读 enabledPlugins 字段
fn load_enabled_plugins() -> Option<std::collections::HashMap<String, bool>> {
    let settings = paths::user_claude_dir().join(SETTINGS_FILE);
    let value = read_json(&settings)?;
    let obj = value.get("enabledPlugins")?.as_object()?;
    Some(
        obj.iter()
            .filter_map(|(k, v)| v.as_bool().map(|b| (k.clone(), b)))
            .collect(),
    )
}

fn load_marketplaces(plugins_dir: &Path, warnings: &mut Vec<String>) -> Vec<MarketplaceInfo> {
    let known = plugins_dir.join(KNOWN_MARKETPLACES_FILE);
    let Some(value) = read_json(&known) else {
        if known.exists() {
            warnings.push(format!("解析失败: {}", known.display()));
        }
        return Vec::new();
    };
    let Some(obj) = value.as_object() else {
        return Vec::new();
    };

    obj.iter()
        .map(|(id, entry)| parse_marketplace_entry(id, entry, warnings))
        .collect()
}

fn parse_marketplace_entry(id: &str, entry: &Value, warnings: &mut Vec<String>) -> MarketplaceInfo {
    let source = entry.get("source");
    let source_kind = source
        .and_then(|s| s.get("source"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let source_repo = source
        .and_then(|s| s.get("repo"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let source_url = source
        .and_then(|s| s.get("url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let install_location = entry
        .get("installLocation")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let last_updated = entry
        .get("lastUpdated")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let manifest_path = if !install_location.is_empty() {
        PathBuf::from(&install_location)
            .join(".claude-plugin")
            .join("marketplace.json")
            .to_string_lossy()
            .to_string()
    } else {
        String::new()
    };

    let mut info = MarketplaceInfo {
        id: id.to_string(),
        source_kind,
        source_repo,
        source_url,
        install_location,
        last_updated,
        manifest_path: manifest_path.clone(),
        manifest_exists: false,
        advertised: Vec::new(),
        owner_name: None,
        description: None,
    };

    if manifest_path.is_empty() {
        return info;
    }
    let path = PathBuf::from(&manifest_path);
    if !path.exists() {
        return info;
    }
    info.manifest_exists = true;

    let Some(manifest) = read_json(&path) else {
        warnings.push(format!("解析 marketplace.json 失败: {}", path.display()));
        return info;
    };

    info.owner_name = manifest
        .get("owner")
        .and_then(|v| v.get("name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    info.description = manifest
        .get("metadata")
        .and_then(|m| m.get("description"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if let Some(plugins) = manifest.get("plugins").and_then(|v| v.as_array()) {
        info.advertised = plugins
            .iter()
            .map(parse_advertised_plugin)
            .collect();
    }

    info
}

fn parse_advertised_plugin(entry: &Value) -> MarketplacePluginEntry {
    let name = entry
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("(unnamed)")
        .to_string();
    let description = entry
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let version = entry
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let category = entry
        .get("category")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let source_summary = describe_source(entry.get("source"));
    MarketplacePluginEntry {
        name,
        description,
        version,
        category,
        source_summary,
    }
}

fn describe_source(source: Option<&Value>) -> String {
    match source {
        None => "—".to_string(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Object(map)) => {
            let kind = map.get("source").and_then(|v| v.as_str()).unwrap_or("?");
            match kind {
                "github" => map
                    .get("repo")
                    .and_then(|v| v.as_str())
                    .map(|s| format!("github:{s}"))
                    .unwrap_or_else(|| "github".into()),
                "url" => map
                    .get("url")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "url".into()),
                "git-subdir" => {
                    let url = map.get("url").and_then(|v| v.as_str()).unwrap_or("");
                    let path = map.get("path").and_then(|v| v.as_str()).unwrap_or("");
                    format!("{url}#{path}")
                }
                "npm" => map
                    .get("package")
                    .and_then(|v| v.as_str())
                    .map(|s| format!("npm:{s}"))
                    .unwrap_or_else(|| "npm".into()),
                _ => kind.to_string(),
            }
        }
        _ => "—".to_string(),
    }
}

fn load_installed(
    plugins_dir: &Path,
    enabled: &std::collections::HashMap<String, bool>,
    warnings: &mut Vec<String>,
) -> Vec<InstalledPlugin> {
    let path = plugins_dir.join(INSTALLED_PLUGINS_FILE);
    let Some(value) = read_json(&path) else {
        if path.exists() {
            warnings.push(format!("解析失败: {}", path.display()));
        }
        return Vec::new();
    };
    let Some(obj) = value.get("plugins").and_then(|v| v.as_object()) else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for (key, entries) in obj {
        let Some(arr) = entries.as_array() else {
            continue;
        };
        // 同一 key 可能有多个记录(多 scope),都展开
        for entry in arr {
            out.push(parse_installed_entry(key, entry, enabled));
        }
    }
    out
}

fn parse_installed_entry(
    key: &str,
    entry: &Value,
    enabled: &std::collections::HashMap<String, bool>,
) -> InstalledPlugin {
    let install_path = entry
        .get("installPath")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let install_path_buf = PathBuf::from(&install_path);
    let install_path_exists = install_path_buf.exists();

    let version = entry
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let installed_at = entry
        .get("installedAt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let last_updated = entry
        .get("lastUpdated")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let scope = entry
        .get("scope")
        .and_then(|v| v.as_str())
        .unwrap_or("user")
        .to_string();
    let git_commit_sha = entry
        .get("gitCommitSha")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // key 形如 "name@marketplace"
    let (name, marketplace) = match key.split_once('@') {
        Some((n, m)) => (n.to_string(), m.to_string()),
        None => (key.to_string(), String::new()),
    };

    let manifest = if install_path_exists {
        parse_plugin_manifest(&install_path_buf)
    } else {
        PluginManifest::default()
    };
    let contents = if install_path_exists {
        scan_plugin_contents(&install_path_buf)
    } else {
        PluginContents::default()
    };

    InstalledPlugin {
        key: key.to_string(),
        name,
        marketplace,
        version,
        install_path,
        install_path_exists,
        git_commit_sha,
        installed_at,
        last_updated,
        scope,
        enabled: enabled.get(key).copied().unwrap_or(true),
        manifest,
        contents,
    }
}

fn parse_plugin_manifest(plugin_root: &Path) -> PluginManifest {
    let path = plugin_root.join(".claude-plugin").join("plugin.json");
    let mut manifest = PluginManifest {
        raw_path: path.to_string_lossy().to_string(),
        raw_exists: path.exists(),
        ..Default::default()
    };
    let Some(value) = read_json(&path) else {
        return manifest;
    };

    manifest.name = value
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    manifest.description = value
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    manifest.version = value
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    manifest.author = parse_author(value.get("author"));
    manifest.homepage = value
        .get("homepage")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    manifest.license = value
        .get("license")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    manifest.keywords = value
        .get("keywords")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    manifest
}

fn parse_author(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(s) => Some(s.clone()),
        Value::Object(map) => map
            .get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        _ => None,
    }
}

/// 按约定扫描 plugin 根目录下的 skills/ agents/ commands/ hooks/
fn scan_plugin_contents(plugin_root: &Path) -> PluginContents {
    let skills = scanner::scan_skills(&plugin_root.join("skills"));
    let agents = scanner::scan_agents(&plugin_root.join("agents"));
    let commands = scanner::scan_commands(&plugin_root.join("commands"));

    let hooks_path = plugin_root.join("hooks").join("hooks.json");
    let hooks_count = if hooks_path.exists() {
        count_hooks(&hooks_path)
    } else {
        0
    };
    let has_mcp = plugin_root.join(".mcp.json").exists();
    let has_lsp = plugin_root.join(".lsp.json").exists();

    PluginContents {
        skills,
        agents,
        commands,
        hooks_count,
        has_mcp,
        has_lsp,
    }
}

fn count_hooks(hooks_path: &Path) -> usize {
    let Some(value) = read_json(hooks_path) else {
        return 0;
    };
    let Some(hooks_obj) = value.get("hooks").and_then(|v| v.as_object()) else {
        return 0;
    };
    let mut total = 0;
    for groups in hooks_obj.values() {
        let Some(arr) = groups.as_array() else { continue };
        for group in arr {
            if let Some(inner) = group.get("hooks").and_then(|v| v.as_array()) {
                total += inner.len();
            }
        }
    }
    total
}

/// 写 settings.json 的 enabledPlugins 字段,保留其它字段不动
pub fn set_enabled(
    key: &str,
    enabled: bool,
    expected_mtime: Option<&str>,
) -> Result<crate::services::fs_write::WriteResult, crate::services::fs_write::WriteError> {
    use crate::services::fs_write::{read_mtime, write_text, WriteError};

    let path = paths::user_claude_dir().join(SETTINGS_FILE);

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

    let mut full: Value = if path.exists() {
        let raw = fs::read_to_string(&path).map_err(|e| WriteError::Io(e.to_string()))?;
        serde_json::from_str(&raw).map_err(|e| WriteError::InvalidJson(e.to_string()))?
    } else {
        Value::Object(serde_json::Map::new())
    };

    let obj = match full.as_object_mut() {
        Some(o) => o,
        None => {
            full = Value::Object(serde_json::Map::new());
            full.as_object_mut().unwrap()
        }
    };

    let entry = obj
        .entry("enabledPlugins".to_string())
        .or_insert_with(|| Value::Object(serde_json::Map::new()));
    if !entry.is_object() {
        *entry = Value::Object(serde_json::Map::new());
    }
    entry
        .as_object_mut()
        .unwrap()
        .insert(key.to_string(), Value::Bool(enabled));

    let text = serde_json::to_string_pretty(&full)
        .map_err(|e| WriteError::Io(e.to_string()))?
        + "\n";

    write_text(&path.to_string_lossy(), &text, None)
}
