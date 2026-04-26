use std::fs;
use std::path::Path;
use chrono::Utc;

use crate::model::RememberedProject;
use crate::paths::projects_registry;

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct ProjectsFile {
    projects: Vec<RememberedProject>,
}

fn load_file() -> ProjectsFile {
    let path = projects_registry();
    if !path.exists() { return ProjectsFile::default(); }
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_file(pf: &ProjectsFile) {
    let path = projects_registry();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(pf) {
        let _ = fs::write(&path, json);
    }
}

pub fn list_projects() -> Vec<RememberedProject> {
    load_file().projects
}

pub fn add_project(path: &str, name: Option<&str>) -> Result<(), String> {
    let mut pf = load_file();
    // Deduplicate
    if pf.projects.iter().any(|p| p.path == path) {
        return Ok(());
    }
    let derived_name = name.map(|s| s.to_string()).unwrap_or_else(|| {
        Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string())
    });
    pf.projects.push(RememberedProject {
        path: path.to_string(),
        name: derived_name,
        added_at: Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
    });
    save_file(&pf);
    Ok(())
}

pub fn remove_project(path: &str) {
    let mut pf = load_file();
    pf.projects.retain(|p| p.path != path);
    save_file(&pf);
}
