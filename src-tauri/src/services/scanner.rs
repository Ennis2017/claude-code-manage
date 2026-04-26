use std::fs;
use std::path::Path;
use chrono::{DateTime, Utc};

use crate::model::*;

fn mtime_str(path: &Path) -> String {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| {
            let dt: DateTime<Utc> = t.into();
            dt.format("%Y-%m-%d %H:%M").to_string()
        })
        .unwrap_or_default()
}

fn file_size(path: &Path) -> u64 {
    fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

fn read_description_from_md(content: &str) -> String {
    // Try frontmatter `description:` field first
    if content.starts_with("---") {
        if let Some(end) = content[3..].find("---") {
            let fm = &content[3..end + 3];
            for line in fm.lines() {
                if let Some(rest) = line.strip_prefix("description:") {
                    return rest.trim().trim_matches('"').trim_matches('\'').to_string();
                }
            }
        }
    }
    // Fall back to first non-empty non-heading line
    for line in content.lines() {
        let t = line.trim();
        if !t.is_empty() && !t.starts_with('#') && !t.starts_with("---") {
            return t.chars().take(80).collect();
        }
    }
    String::new()
}

pub fn scan_settings(path: &Path) -> Option<SettingsJson> {
    if !path.exists() { return None; }
    let content = fs::read_to_string(path).ok()?;
    let raw: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::Value::Null);
    Some(SettingsJson {
        raw,
        source_path: path.to_string_lossy().to_string(),
        mtime: mtime_str(path),
        size_bytes: file_size(path),
    })
}

pub fn scan_file_content(path: &Path) -> Option<FileContent> {
    if !path.exists() { return None; }
    let content = fs::read_to_string(path).ok()?;
    Some(FileContent {
        size_bytes: file_size(path),
        mtime: mtime_str(path),
        source_path: path.to_string_lossy().to_string(),
        content,
    })
}

pub fn scan_commands(dir: &Path) -> Vec<CommandFile> {
    if !dir.exists() { return vec![]; }
    let mut result = vec![];
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().map(|e| e == "md").unwrap_or(false) {
                let name = p.file_stem().unwrap_or_default().to_string_lossy().to_string();
                let content = fs::read_to_string(&p).unwrap_or_default();
                let description = read_description_from_md(&content);
                result.push(CommandFile {
                    name,
                    source_path: p.to_string_lossy().to_string(),
                    mtime: mtime_str(&p),
                    description,
                });
            }
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

pub fn scan_skills(dir: &Path) -> Vec<SkillFile> {
    if !dir.exists() { return vec![]; }
    let mut result = vec![];
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let skill_dir = entry.path();
            if skill_dir.is_dir() {
                let name = skill_dir.file_name().unwrap_or_default().to_string_lossy().to_string();
                // Count files, read SKILL.md description
                let file_count = fs::read_dir(&skill_dir)
                    .map(|e| e.flatten().count())
                    .unwrap_or(0);
                let skill_md = skill_dir.join("SKILL.md");
                let description = if skill_md.exists() {
                    let c = fs::read_to_string(&skill_md).unwrap_or_default();
                    read_description_from_md(&c)
                } else {
                    String::new()
                };
                let mtime = mtime_str(&skill_dir);
                let source_path = skill_dir.to_string_lossy().to_string();
                result.push(SkillFile { name, source_path, mtime, description, file_count });
            }
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

pub fn scan_agents(dir: &Path) -> Vec<AgentFile> {
    if !dir.exists() { return vec![]; }
    let mut result = vec![];
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().map(|e| e == "md").unwrap_or(false) {
                let name = p.file_stem().unwrap_or_default().to_string_lossy().to_string();
                let content = fs::read_to_string(&p).unwrap_or_default();
                let description = read_description_from_md(&content);
                result.push(AgentFile {
                    name,
                    source_path: p.to_string_lossy().to_string(),
                    mtime: mtime_str(&p),
                    description,
                });
            }
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

pub fn scan_rules(dir: &Path) -> Vec<RuleFile> {
    if !dir.exists() { return vec![]; }
    let mut result = vec![];
    walk_rules(dir, dir, &mut result);
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

fn walk_rules(root: &Path, dir: &Path, out: &mut Vec<RuleFile>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            walk_rules(root, &p, out);
        } else if p.extension().map(|e| e == "md").unwrap_or(false) {
            let rel = p.strip_prefix(root).unwrap_or(&p);
            let name = rel.with_extension("").to_string_lossy().to_string();
            let content = fs::read_to_string(&p).unwrap_or_default();
            let description = read_description_from_md(&content);
            out.push(RuleFile {
                name,
                source_path: p.to_string_lossy().to_string(),
                mtime: mtime_str(&p),
                description,
            });
        }
    }
}

pub fn scan_user_mcp(claude_json_path: &Path) -> UserMcpInfo {
    let mut info = UserMcpInfo {
        source_path: claude_json_path.to_string_lossy().to_string(),
        ..Default::default()
    };
    if !claude_json_path.exists() {
        return info;
    }
    info.exists = true;
    info.mtime = mtime_str(claude_json_path);
    if let Ok(content) = fs::read_to_string(claude_json_path) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(servers) = value.get("mcpServers").and_then(|v| v.as_object()) {
                info.server_count = servers.len() as u64;
            }
        }
    }
    info
}

pub fn scan_user_config(claude_dir: &Path) -> UserConfig {
    let claude_json = claude_dir
        .parent()
        .map(|home| home.join(".claude.json"))
        .unwrap_or_else(|| claude_dir.join(".claude.json"));
    UserConfig {
        settings: scan_settings(&claude_dir.join("settings.json")),
        keybindings: scan_file_content(&claude_dir.join("keybindings.json")),
        memory: scan_file_content(&claude_dir.join("CLAUDE.md")),
        commands: scan_commands(&claude_dir.join("commands")),
        skills: scan_skills(&claude_dir.join("skills")),
        agents: scan_agents(&claude_dir.join("agents")),
        rules: scan_rules(&claude_dir.join("rules")),
        mcp: scan_user_mcp(&claude_json),
    }
}

pub fn scan_project(rp: &RememberedProject) -> ProjectConfig {
    let base = std::path::PathBuf::from(&rp.path);
    let claude_dir = base.join(".claude");
    ProjectConfig {
        id: rp.id(),
        path: rp.path.clone(),
        name: rp.name.clone(),
        added_at: rp.added_at.clone(),
        settings: scan_settings(&claude_dir.join("settings.json")),
        local_settings: scan_settings(&claude_dir.join("settings.local.json")),
        memory: scan_file_content(&base.join("CLAUDE.md"))
            .or_else(|| scan_file_content(&claude_dir.join("CLAUDE.md"))),
        commands: scan_commands(&claude_dir.join("commands")),
        skills: scan_skills(&claude_dir.join("skills")),
        agents: scan_agents(&claude_dir.join("agents")),
        rules: scan_rules(&claude_dir.join("rules")),
        has_mcp: base.join(".mcp.json").exists(),
    }
}
