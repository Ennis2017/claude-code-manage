use std::path::PathBuf;
use std::env;

pub fn home_dir() -> PathBuf {
    PathBuf::from(env::var("HOME").expect("HOME env var must exist on macOS"))
}

pub fn user_claude_dir() -> PathBuf {
    home_dir().join(".claude")
}

pub fn app_data_dir() -> PathBuf {
    home_dir()
        .join("Library")
        .join("Application Support")
        .join("claude-code-manage")
}

pub fn projects_registry() -> PathBuf {
    app_data_dir().join("projects.json")
}
