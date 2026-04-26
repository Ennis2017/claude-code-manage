import { z } from 'zod';

export const PERMISSION_MODES = ['default', 'acceptEdits', 'plan', 'bypassPermissions'] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

export const PERMISSION_MODE_DESC: Record<PermissionMode, string> = {
  default: '默认 · 写操作前询问',
  acceptEdits: '自动接受文件编辑',
  plan: '只规划不执行',
  bypassPermissions: '跳过所有权限确认（风险）',
};

export interface PermissionsConfig {
  allow: string[];
  deny: string[];
  ask: string[];
  defaultMode?: PermissionMode;
  additionalDirectories: string[];
}

export const permissionsRawSchema = z
  .object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
    ask: z.array(z.string()).optional(),
    defaultMode: z.string().optional(),
    additionalDirectories: z.array(z.string()).optional(),
  })
  .passthrough()
  .optional();

export function parsePermissions(raw: unknown): PermissionsConfig {
  const result = permissionsRawSchema.safeParse(raw);
  const v = result.success && result.data ? result.data : {};
  const mode = v.defaultMode && (PERMISSION_MODES as readonly string[]).includes(v.defaultMode)
    ? (v.defaultMode as PermissionMode)
    : undefined;
  return {
    allow: v.allow || [],
    deny: v.deny || [],
    ask: v.ask || [],
    defaultMode: mode,
    additionalDirectories: v.additionalDirectories || [],
  };
}

export function serializePermissions(cfg: PermissionsConfig): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  const allow = cfg.allow.filter(s => s.trim() !== '');
  const deny = cfg.deny.filter(s => s.trim() !== '');
  const ask = cfg.ask.filter(s => s.trim() !== '');
  const dirs = cfg.additionalDirectories.filter(s => s.trim() !== '');
  if (allow.length > 0) out.allow = allow;
  if (deny.length > 0) out.deny = deny;
  if (ask.length > 0) out.ask = ask;
  if (cfg.defaultMode) out.defaultMode = cfg.defaultMode;
  if (dirs.length > 0) out.additionalDirectories = dirs;
  return Object.keys(out).length > 0 ? out : undefined;
}
