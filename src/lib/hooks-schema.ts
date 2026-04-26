import { z } from 'zod';

export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'Notification',
  'Stop',
  'SubagentStop',
  'PreCompact',
  'SessionStart',
  'SessionEnd',
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export const HOOK_EVENT_DESC: Record<HookEvent, string> = {
  PreToolUse: '工具调用前 · 可拦截或修改参数',
  PostToolUse: '工具调用后 · 触发副作用（格式化/验证/通知）',
  UserPromptSubmit: '用户提交输入时',
  Notification: '产生通知时',
  Stop: '会话结束时',
  SubagentStop: '子 Agent 结束时',
  PreCompact: '上下文压缩前',
  SessionStart: '会话开始时',
  SessionEnd: '会话退出时',
};

export const SUPPORTS_MATCHER: Record<HookEvent, boolean> = {
  PreToolUse: true,
  PostToolUse: true,
  UserPromptSubmit: false,
  Notification: false,
  Stop: false,
  SubagentStop: false,
  PreCompact: false,
  SessionStart: false,
  SessionEnd: false,
};

export interface HookCommand {
  type: 'command';
  command: string;
  timeout?: number;
}

export interface HookGroup {
  matcher?: string;
  hooks: HookCommand[];
}

export type HooksConfig = Partial<Record<HookEvent, HookGroup[]>>;

const hookCommandSchema = z
  .object({
    type: z.string().default('command'),
    command: z.string().optional().default(''),
    timeout: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const hookGroupSchema = z
  .object({
    matcher: z.string().optional(),
    hooks: z.array(hookCommandSchema).default([]),
  })
  .passthrough();

export const hooksConfigSchema = z.record(z.string(), z.array(hookGroupSchema)).optional();

export function parseHooks(raw: unknown): HooksConfig {
  const result = hooksConfigSchema.safeParse(raw);
  if (!result.success || !result.data) return {};
  const out: HooksConfig = {};
  for (const ev of HOOK_EVENTS) {
    const groups = (result.data as Record<string, unknown>)[ev];
    if (Array.isArray(groups)) {
      out[ev] = groups.map(g => ({
        matcher: typeof (g as { matcher?: unknown }).matcher === 'string' ? (g as { matcher: string }).matcher : undefined,
        hooks: (((g as { hooks?: unknown[] }).hooks) || []).map((h: unknown) => {
          const hc = h as Partial<HookCommand>;
          return {
            type: hc.type || 'command',
            command: hc.command || '',
            ...(typeof hc.timeout === 'number' ? { timeout: hc.timeout } : {}),
          } as HookCommand;
        }),
      }));
    }
  }
  return out;
}

export function serializeHooks(cfg: HooksConfig): Record<string, HookGroup[]> | undefined {
  const out: Record<string, HookGroup[]> = {};
  for (const ev of HOOK_EVENTS) {
    const groups = cfg[ev];
    if (!groups || groups.length === 0) continue;
    out[ev] = groups
      .map(g => ({
        ...(g.matcher && SUPPORTS_MATCHER[ev] ? { matcher: g.matcher } : {}),
        hooks: g.hooks
          .filter(h => h.command.trim() !== '')
          .map(h => ({
            type: h.type || 'command',
            command: h.command,
            ...(typeof h.timeout === 'number' && h.timeout > 0 ? { timeout: h.timeout } : {}),
          })),
      }))
      .filter(g => g.hooks.length > 0);
    if (out[ev].length === 0) delete out[ev];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function emptyGroup(event: HookEvent): HookGroup {
  return SUPPORTS_MATCHER[event]
    ? { matcher: '', hooks: [{ type: 'command', command: '' }] }
    : { hooks: [{ type: 'command', command: '' }] };
}
