import { invoke } from '@tauri-apps/api/core';

export interface WriteResult {
  path: string;
  mtime: string;
  size_bytes: number;
  backup_path: string | null;
}

export async function writeTextFile(
  path: string,
  content: string,
  expectedMtime?: string | null,
): Promise<WriteResult> {
  return invoke<WriteResult>('write_text_file', {
    path,
    content,
    expectedMtime: expectedMtime ?? null,
  });
}

export async function writeJsonFile(
  path: string,
  content: string,
  expectedMtime?: string | null,
): Promise<WriteResult> {
  return invoke<WriteResult>('write_json_file', {
    path,
    content,
    expectedMtime: expectedMtime ?? null,
  });
}

export async function detectExternalChange(path: string, sinceMtime: string): Promise<boolean> {
  return invoke<boolean>('detect_external_change', { path, sinceMtime });
}

export async function revealInFinder(path: string): Promise<void> {
  return invoke<void>('reveal_in_finder', { path });
}

export async function createFile(path: string, content: string): Promise<WriteResult> {
  return invoke<WriteResult>('create_file', { path, content });
}

export async function createDir(path: string): Promise<void> {
  return invoke<void>('create_dir', { path });
}

export async function deletePath(path: string): Promise<void> {
  return invoke<void>('delete_path', { path });
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path });
}

export interface ReadMeta {
  content: string;
  mtime: string;
  size_bytes: number;
  exists: boolean;
}

export async function readTextFileMeta(path: string): Promise<ReadMeta> {
  return invoke<ReadMeta>('read_text_file_meta', { path });
}

export interface SkillFileEntry {
  name: string;
  relative_path: string;
  source_path: string;
  size_bytes: number;
  mtime: string;
  is_dir: boolean;
}

export async function listSkillFiles(path: string): Promise<SkillFileEntry[]> {
  return invoke<SkillFileEntry[]>('list_skill_files', { path });
}

export async function readUserMcpServers(): Promise<ReadMeta> {
  return invoke<ReadMeta>('read_user_mcp_servers');
}

export async function writeUserMcpServers(
  content: string,
  expectedMtime?: string | null,
): Promise<WriteResult> {
  return invoke<WriteResult>('write_user_mcp_servers', {
    content,
    expectedMtime: expectedMtime ?? null,
  });
}

export async function restartWatcher(): Promise<void> {
  return invoke<void>('restart_watcher');
}

export async function getUserClaudeDir(): Promise<string> {
  return invoke<string>('get_user_claude_dir');
}

export type SearchHitKind =
  | 'settings'
  | 'settings_local'
  | 'keybindings'
  | 'memory'
  | 'mcp'
  | 'command'
  | 'skill'
  | 'agent'
  | 'other';

export type SearchMatchType = 'name' | 'content';

export interface SearchHit {
  path: string;
  display_path: string;
  scope: string;            // "user" | project_id
  scope_label: string;
  kind: SearchHitKind;
  entry_name: string | null;
  match_type: SearchMatchType;
  line_number: number | null;
  snippet: string;
  score: number;
}

export async function searchAll(
  query: string,
  opts?: { limit?: number; caseSensitive?: boolean },
): Promise<SearchHit[]> {
  return invoke<SearchHit[]>('search_all', {
    query,
    limit: opts?.limit ?? null,
    caseSensitive: opts?.caseSensitive ?? false,
  });
}
