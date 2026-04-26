use std::path::PathBuf;
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use tauri::{AppHandle, Emitter};

use crate::paths;
use crate::services::project_list;

pub struct WatchState {
    _debouncer: Debouncer<notify::RecommendedWatcher>,
}

pub fn start(app: AppHandle) -> Option<WatchState> {
    let app_handle = app.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(400),
        move |res: DebounceEventResult| match res {
            Ok(events) => {
                if events.is_empty() {
                    return;
                }
                // Emit a single coalesced event
                let paths: Vec<String> = events
                    .iter()
                    .map(|e| e.path.to_string_lossy().to_string())
                    .collect();
                let _ = app_handle.emit("config-changed", paths);
            }
            Err(e) => {
                eprintln!("watch error: {e:?}");
            }
        },
    )
    .ok()?;

    let user_dir = paths::user_claude_dir();
    if user_dir.exists() {
        let _ = debouncer
            .watcher()
            .watch(&user_dir, RecursiveMode::Recursive);
    }

    let user_claude_json = paths::home_dir().join(".claude.json");
    if user_claude_json.exists() {
        let _ = debouncer
            .watcher()
            .watch(&user_claude_json, RecursiveMode::NonRecursive);
    }

    for rp in project_list::list_projects() {
        let base = PathBuf::from(&rp.path);
        let dot = base.join(".claude");
        if dot.exists() {
            let _ = debouncer
                .watcher()
                .watch(&dot, RecursiveMode::Recursive);
        }
        let memory = base.join("CLAUDE.md");
        if memory.exists() {
            let _ = debouncer
                .watcher()
                .watch(&memory, RecursiveMode::NonRecursive);
        }
        let mcp = base.join(".mcp.json");
        if mcp.exists() {
            let _ = debouncer
                .watcher()
                .watch(&mcp, RecursiveMode::NonRecursive);
        }
    }

    Some(WatchState {
        _debouncer: debouncer,
    })
}
