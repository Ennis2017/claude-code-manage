import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface SettingsJson {
  raw: Record<string, unknown>;
  source_path: string;
  mtime: string;
  size_bytes: number;
}

export interface FileContent {
  content: string;
  source_path: string;
  mtime: string;
  size_bytes: number;
}

export interface CommandFile {
  name: string;
  source_path: string;
  mtime: string;
  description: string;
}

export interface SkillFile {
  name: string;
  source_path: string;
  mtime: string;
  description: string;
  file_count: number;
}

export interface AgentFile {
  name: string;
  source_path: string;
  mtime: string;
  description: string;
}

export interface RuleFile {
  name: string;
  source_path: string;
  mtime: string;
  description: string;
}

export interface UserMcpInfo {
  source_path: string;
  exists: boolean;
  server_count: number;
  mtime: string;
}

export interface OauthAccount {
  display_name: string;
}

export interface UserConfig {
  settings: SettingsJson | null;
  keybindings: FileContent | null;
  memory: FileContent | null;
  commands: CommandFile[];
  skills: SkillFile[];
  agents: AgentFile[];
  rules: RuleFile[];
  mcp: UserMcpInfo;
  oauth_account: OauthAccount | null;
}

export interface ProjectConfig {
  id: string;
  path: string;
  name: string;
  added_at: string;
  settings: SettingsJson | null;
  local_settings: SettingsJson | null;
  memory: FileContent | null;
  commands: CommandFile[];
  skills: SkillFile[];
  agents: AgentFile[];
  rules: RuleFile[];
  has_mcp: boolean;
}

export interface ClaudeConfigSnapshot {
  scanned_at: string;
  claude_code_version: string | null;
  user_config: UserConfig;
  projects: ProjectConfig[];
}

export interface RememberedProject {
  path: string;
  name: string;
  added_at: string;
}

interface ConfigStore {
  snapshot: ClaudeConfigSnapshot | null;
  loading: boolean;
  error: string | null;
  userClaudeDir: string | null;

  scanAll: () => Promise<void>;
  addProject: (path: string) => Promise<void>;
  removeProject: (path: string) => Promise<void>;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  snapshot: null,
  loading: false,
  error: null,
  userClaudeDir: null,

  scanAll: async () => {
    set({ loading: true, error: null });
    try {
      const [snapshot, userClaudeDir] = await Promise.all([
        invoke<ClaudeConfigSnapshot>('scan_all'),
        get().userClaudeDir ? Promise.resolve(get().userClaudeDir!) : invoke<string>('get_user_claude_dir'),
      ]);
      set({ snapshot, userClaudeDir, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addProject: async (path: string) => {
    await invoke('add_project', { path });
    await get().scanAll();
  },

  removeProject: async (path: string) => {
    await invoke('remove_project', { path });
    await get().scanAll();
  },
}));
