import { z } from 'zod';

// Claude Code settings.json schema（宽松模式）
// 已知字段会做类型校验，未知字段允许通过（.passthrough），避免新版本字段被误报。
//
// 参考：Claude Code 官方 settings.json 字段约定
// - https://docs.claude.com/en/docs/claude-code/settings

const hookEntrySchema = z
  .object({
    type: z.string(),
    command: z.string().optional(),
    timeout: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const hookMatcherSchema = z
  .object({
    matcher: z.string().optional(),
    hooks: z.array(hookEntrySchema),
  })
  .passthrough();

const permissionsSchema = z
  .object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
    ask: z.array(z.string()).optional(),
    defaultMode: z.string().optional(),
    additionalDirectories: z.array(z.string()).optional(),
  })
  .passthrough();

export const settingsSchema = z
  .object({
    model: z.string().optional(),
    theme: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    apiKeyHelper: z.string().optional(),
    verbose: z.boolean().optional(),
    autoCompact: z.boolean().optional(),
    alwaysThinkingEnabled: z.boolean().optional(),
    includeCoAuthoredBy: z.boolean().optional(),
    cleanupPeriodDays: z.number().int().nonnegative().optional(),
    statusLine: z.unknown().optional(),
    permissions: permissionsSchema.optional(),
    hooks: z.record(z.string(), z.array(hookMatcherSchema)).optional(),
    agents: z.record(z.string(), z.unknown()).optional(),
    mcpServers: z.record(z.string(), z.unknown()).optional(),
    outputStyle: z.string().optional(),
  })
  .passthrough();

export type SettingsShape = z.infer<typeof settingsSchema>;

export interface SettingsValidation {
  ok: boolean;
  // 解析后的值（仅当 ok 为 true）
  value?: SettingsShape;
  // 字段级错误清单
  issues: { path: string; message: string }[];
  // JSON 解析失败时的错误信息
  parseError?: string;
}

export function validateSettingsJsonText(text: string): SettingsValidation {
  let parsed: unknown;
  try {
    parsed = text.trim() === '' ? {} : JSON.parse(text);
  } catch (e) {
    return { ok: false, issues: [], parseError: (e as Error).message };
  }
  const result = settingsSchema.safeParse(parsed);
  if (result.success) {
    return { ok: true, value: result.data, issues: [] };
  }
  const issues = result.error.issues.map(i => ({
    path: i.path.length === 0 ? '(root)' : i.path.map(String).join('.'),
    message: i.message,
  }));
  return { ok: false, issues };
}
