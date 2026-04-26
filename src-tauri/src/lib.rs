mod model;
mod paths;
mod services;

use std::sync::Mutex;

use chrono::Utc;
use model::{ClaudeConfigSnapshot, ProjectConfig, RememberedProject};
use services::{fs_write, project_list, scanner, search, watcher};
use tauri::Manager;

struct WatcherHandle(Mutex<Option<watcher::WatchState>>);

#[tauri::command]
fn scan_all() -> Result<ClaudeConfigSnapshot, String> {
    let claude_dir = paths::user_claude_dir();
    let user_config = scanner::scan_user_config(&claude_dir);

    let projects_list = project_list::list_projects();
    let projects: Vec<ProjectConfig> = projects_list
        .iter()
        .map(|rp| scanner::scan_project(rp))
        .collect();

    let version = get_claude_version_inner();

    Ok(ClaudeConfigSnapshot {
        scanned_at: Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        claude_code_version: version,
        user_config,
        projects,
    })
}

#[tauri::command]
fn get_claude_version() -> Option<String> {
    get_claude_version_inner()
}

#[tauri::command]
fn get_user_claude_dir() -> String {
    paths::user_claude_dir().to_string_lossy().to_string()
}

fn get_claude_version_inner() -> Option<String> {
    let output = std::process::Command::new("claude")
        .arg("--version")
        .output()
        .ok()?;
    let s = String::from_utf8_lossy(&output.stdout).to_string();
    let line = s.lines().next()?.trim().to_string();
    if line.is_empty() { None } else { Some(line) }
}

#[tauri::command]
fn list_projects() -> Vec<RememberedProject> {
    project_list::list_projects()
}

#[tauri::command]
fn add_project(app: tauri::AppHandle, path: String, name: Option<String>) -> Result<(), String> {
    project_list::add_project(&path, name.as_deref())?;
    restart_watcher_internal(&app);
    Ok(())
}

#[tauri::command]
fn remove_project(app: tauri::AppHandle, path: String) {
    project_list::remove_project(&path);
    restart_watcher_internal(&app);
}

fn restart_watcher_internal(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<WatcherHandle>() {
        if let Ok(mut guard) = state.0.lock() {
            *guard = watcher::start(app.clone());
        }
    }
}

#[tauri::command]
fn write_text_file(
    path: String,
    content: String,
    expected_mtime: Option<String>,
) -> Result<fs_write::WriteResult, String> {
    fs_write::write_text(&path, &content, expected_mtime.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_json_file(
    path: String,
    content: String,
    expected_mtime: Option<String>,
) -> Result<fs_write::WriteResult, String> {
    fs_write::write_json(&path, &content, expected_mtime.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn detect_external_change(path: String, since_mtime: String) -> Result<bool, String> {
    fs_write::detect_external_change(&path, &since_mtime).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: String, content: String) -> Result<fs_write::WriteResult, String> {
    fs_write::create_file(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    fs_write::create_dir(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    fs_write::delete_path(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs_write::read_text(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file_meta(path: String) -> Result<fs_write::ReadMeta, String> {
    fs_write::read_text_meta(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_skill_files(path: String) -> Result<Vec<fs_write::SkillFileEntry>, String> {
    fs_write::list_skill_files(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_user_mcp_servers() -> Result<fs_write::ReadMeta, String> {
    fs_write::read_user_mcp_servers().map_err(|e| e.to_string())
}

#[tauri::command]
fn write_user_mcp_servers(
    content: String,
    expected_mtime: Option<String>,
) -> Result<fs_write::WriteResult, String> {
    fs_write::write_user_mcp_servers(&content, expected_mtime.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("路径不存在: {path}"));
    }
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("无法打开 Finder: {e}"))?;
    Ok(())
}

#[tauri::command]
fn search_all(
    query: String,
    limit: Option<usize>,
    case_sensitive: Option<bool>,
) -> Vec<search::SearchHit> {
    search::search(&query, limit, case_sensitive.unwrap_or(false))
}

#[tauri::command]
fn restart_watcher(app: tauri::AppHandle) -> Result<(), String> {
    let state: tauri::State<'_, WatcherHandle> = app.state();
    let new_state = watcher::start(app.clone());
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = new_state;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherHandle(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            let ws = watcher::start(handle.clone());
            if let Some(state) = app.try_state::<WatcherHandle>() {
                if let Ok(mut guard) = state.0.lock() {
                    *guard = ws;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_all,
            get_claude_version,
            get_user_claude_dir,
            list_projects,
            add_project,
            remove_project,
            write_text_file,
            write_json_file,
            detect_external_change,
            create_file,
            create_dir,
            delete_path,
            read_text_file,
            read_text_file_meta,
            list_skill_files,
            read_user_mcp_servers,
            write_user_mcp_servers,
            reveal_in_finder,
            restart_watcher,
            search_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
