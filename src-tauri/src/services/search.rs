use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::paths;
use crate::services::project_list;

const MAX_FILE_SIZE: u64 = 2 * 1024 * 1024;
const MAX_HITS_PER_FILE: usize = 5;
const MAX_TOTAL_HITS: usize = 200;
const MAX_SNIPPET_LEN: usize = 200;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum HitKind {
    Settings,
    SettingsLocal,
    Keybindings,
    Memory,
    Mcp,
    Command,
    Skill,
    Agent,
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum MatchType {
    Name,
    Content,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchHit {
    pub path: String,
    pub display_path: String,
    pub scope: String,
    pub scope_label: String,
    pub kind: HitKind,
    pub entry_name: Option<String>,
    pub match_type: MatchType,
    pub line_number: Option<u32>,
    pub snippet: String,
    pub score: i32,
}

struct ScopeInfo {
    scope: String,
    scope_label: String,
    base: PathBuf,
    display_prefix: String,
}

pub fn search(query: &str, limit: Option<usize>, case_sensitive: bool) -> Vec<SearchHit> {
    let q = query.trim();
    if q.is_empty() {
        return vec![];
    }
    let q_match = if case_sensitive { q.to_string() } else { q.to_lowercase() };
    let cap = limit.unwrap_or(MAX_TOTAL_HITS).min(MAX_TOTAL_HITS);

    let mut hits: Vec<SearchHit> = Vec::new();

    // User scope: only search the files this app actually manages.
    let user_dir = paths::user_claude_dir();
    let user_scope = ScopeInfo {
        scope: "user".to_string(),
        scope_label: "用户级".to_string(),
        base: user_dir.clone(),
        display_prefix: "~/.claude".to_string(),
    };

    let user_files = [
        user_dir.join("settings.json"),
        user_dir.join("keybindings.json"),
        user_dir.join("CLAUDE.md"),
    ];
    for f in &user_files {
        if hits.len() >= cap { break; }
        if f.exists() {
            try_file_hit(f, &user_scope, &q_match, case_sensitive, &mut hits, cap);
        }
    }

    let user_dirs = [
        user_dir.join("commands"),
        user_dir.join("skills"),
        user_dir.join("agents"),
    ];
    for d in &user_dirs {
        if hits.len() >= cap { break; }
        if d.exists() {
            walk_dir(d, &user_scope, &q_match, case_sensitive, &mut hits, cap);
        }
    }

    // Project scopes
    if hits.len() < cap {
        for rp in project_list::list_projects() {
            if hits.len() >= cap { break; }
            let project_base = PathBuf::from(&rp.path);
            let id = rp.id();
            let dot_claude = project_base.join(".claude");

            let proj_scope_root = ScopeInfo {
                scope: id.clone(),
                scope_label: rp.name.clone(),
                base: project_base.clone(),
                display_prefix: rp.name.clone(),
            };
            let proj_scope_dotclaude = ScopeInfo {
                scope: id.clone(),
                scope_label: rp.name.clone(),
                base: dot_claude.clone(),
                display_prefix: format!("{}/.claude", rp.name),
            };

            // Direct files at project root
            for (path, scope) in [
                (project_base.join("CLAUDE.md"), &proj_scope_root),
                (project_base.join(".mcp.json"), &proj_scope_root),
            ] {
                if hits.len() >= cap { break; }
                if path.exists() {
                    try_file_hit(&path, scope, &q_match, case_sensitive, &mut hits, cap);
                }
            }

            // Files under .claude/
            for path in [
                dot_claude.join("settings.json"),
                dot_claude.join("settings.local.json"),
                dot_claude.join("CLAUDE.md"),
            ] {
                if hits.len() >= cap { break; }
                if path.exists() {
                    try_file_hit(&path, &proj_scope_dotclaude, &q_match, case_sensitive, &mut hits, cap);
                }
            }

            // Subdirs under .claude/
            for d in [
                dot_claude.join("commands"),
                dot_claude.join("skills"),
                dot_claude.join("agents"),
            ] {
                if hits.len() >= cap { break; }
                if d.exists() {
                    walk_dir(&d, &proj_scope_dotclaude, &q_match, case_sensitive, &mut hits, cap);
                }
            }
        }
    }

    hits.truncate(cap);
    rank(hits)
}

fn walk_dir(
    root: &Path,
    scope: &ScopeInfo,
    q_match: &str,
    case_sensitive: bool,
    hits: &mut Vec<SearchHit>,
    cap: usize,
) {
    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !is_junk(e.path()))
    {
        if hits.len() >= cap {
            return;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().is_file() {
            continue;
        }
        try_file_hit(entry.path(), scope, q_match, case_sensitive, hits, cap);
    }
}

fn is_junk(path: &Path) -> bool {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    matches!(name.as_str(), ".DS_Store" | ".git" | "node_modules" | "target" | "dist")
}

fn try_file_hit(
    path: &Path,
    scope: &ScopeInfo,
    q_match: &str,
    case_sensitive: bool,
    hits: &mut Vec<SearchHit>,
    cap: usize,
) {
    if hits.len() >= cap {
        return;
    }

    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return,
    };
    if meta.len() > MAX_FILE_SIZE {
        return;
    }

    let (kind, entry_name) = classify(path);
    let display_path = build_display_path(path, scope);

    let basename = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let basename_cmp = if case_sensitive { basename.clone() } else { basename.to_lowercase() };
    let display_cmp = if case_sensitive { display_path.clone() } else { display_path.to_lowercase() };

    if basename_cmp.contains(q_match) || display_cmp.contains(q_match) {
        let score = if basename_cmp.starts_with(q_match) {
            1000
        } else if basename_cmp.contains(q_match) {
            800
        } else {
            500
        };
        hits.push(SearchHit {
            path: path.to_string_lossy().to_string(),
            display_path: display_path.clone(),
            scope: scope.scope.clone(),
            scope_label: scope.scope_label.clone(),
            kind: kind.clone(),
            entry_name: entry_name.clone(),
            match_type: MatchType::Name,
            line_number: None,
            snippet: basename,
            score,
        });
        if hits.len() >= cap {
            return;
        }
    }

    let content = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return,
    };

    let mut per_file_hits = 0usize;
    for (idx, line) in content.lines().enumerate() {
        if per_file_hits >= MAX_HITS_PER_FILE {
            break;
        }
        let line_cmp_owned;
        let line_cmp: &str = if case_sensitive {
            line
        } else {
            line_cmp_owned = line.to_lowercase();
            line_cmp_owned.as_str()
        };
        if line_cmp.contains(q_match) {
            let snippet = make_snippet(line, q_match, case_sensitive);
            hits.push(SearchHit {
                path: path.to_string_lossy().to_string(),
                display_path: display_path.clone(),
                scope: scope.scope.clone(),
                scope_label: scope.scope_label.clone(),
                kind: kind.clone(),
                entry_name: entry_name.clone(),
                match_type: MatchType::Content,
                line_number: Some((idx + 1) as u32),
                snippet,
                score: 100,
            });
            per_file_hits += 1;
            if hits.len() >= cap {
                return;
            }
        }
    }
}

fn make_snippet(line: &str, q: &str, case_sensitive: bool) -> String {
    let trimmed = line.trim_start();
    let chars: Vec<char> = trimmed.chars().collect();
    if chars.len() <= MAX_SNIPPET_LEN {
        return trimmed.to_string();
    }
    let pos_chars = if case_sensitive {
        trimmed
            .find(q)
            .map(|byte_pos| trimmed[..byte_pos].chars().count())
            .unwrap_or(0)
    } else {
        let lower: String = trimmed.chars().flat_map(char::to_lowercase).collect();
        lower
            .find(q)
            .map(|byte_pos| lower[..byte_pos].chars().count())
            .unwrap_or(0)
    }
    .min(chars.len().saturating_sub(1));
    let q_char_len = q.chars().count();
    let start = pos_chars.saturating_sub(40);
    let end = (pos_chars + q_char_len + 120).min(chars.len());
    let mut s = String::new();
    if start > 0 {
        s.push('…');
    }
    s.extend(chars[start..end].iter());
    if end < chars.len() {
        s.push('…');
    }
    s
}

fn classify(path: &Path) -> (HitKind, Option<String>) {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    match name.as_str() {
        "settings.json" => return (HitKind::Settings, None),
        "settings.local.json" => return (HitKind::SettingsLocal, None),
        "keybindings.json" => return (HitKind::Keybindings, None),
        "CLAUDE.md" => return (HitKind::Memory, None),
        ".mcp.json" => return (HitKind::Mcp, None),
        _ => {}
    }

    let comps: Vec<String> = path
        .components()
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .collect();

    if let Some(pos) = comps.iter().rposition(|c| c == "commands") {
        if pos + 1 < comps.len() && comps.len() == pos + 2 && name.ends_with(".md") {
            let stem = name.trim_end_matches(".md").to_string();
            return (HitKind::Command, Some(stem));
        }
    }

    if let Some(pos) = comps.iter().rposition(|c| c == "agents") {
        if pos + 1 < comps.len() && comps.len() == pos + 2 && name.ends_with(".md") {
            let stem = name.trim_end_matches(".md").to_string();
            return (HitKind::Agent, Some(stem));
        }
    }

    if let Some(pos) = comps.iter().rposition(|c| c == "skills") {
        if pos + 1 < comps.len() {
            let skill_name = comps[pos + 1].clone();
            return (HitKind::Skill, Some(skill_name));
        }
    }

    (HitKind::Other, None)
}

fn build_display_path(path: &Path, scope: &ScopeInfo) -> String {
    if let Ok(rel) = path.strip_prefix(&scope.base) {
        let rel_str = rel.to_string_lossy().to_string();
        if rel_str.is_empty() {
            scope.display_prefix.clone()
        } else {
            format!("{}/{}", scope.display_prefix, rel_str)
        }
    } else {
        path.to_string_lossy().to_string()
    }
}

fn rank(mut hits: Vec<SearchHit>) -> Vec<SearchHit> {
    hits.sort_by(|a, b| b.score.cmp(&a.score).then_with(|| a.display_path.cmp(&b.display_path)));
    hits
}
