import { z } from 'zod';

// .mcp.json 数据模型
//
// 支持三种 transport：stdio（默认）/ sse / http
// 参考：`claude mcp add --help` 和官方 MCP 规范

export type McpTransport = 'stdio' | 'sse' | 'http';

const stdioServerSchema = z
  .object({
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    type: z.literal('stdio').optional(),
  })
  .passthrough();

const sseServerSchema = z
  .object({
    type: z.literal('sse'),
    url: z.string().min(1),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const httpServerSchema = z
  .object({
    type: z.literal('http'),
    url: z.string().min(1),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

// 也兼容 `transport` 字段（官方 CLI 同时支持 transport 与 type）
const serverSchema = z.union([
  stdioServerSchema,
  sseServerSchema,
  httpServerSchema,
  z.object({ transport: z.enum(['stdio', 'sse', 'http']) }).passthrough(),
  z.object({ command: z.string().min(1) }).passthrough(),
  z.object({ url: z.string().min(1) }).passthrough(),
]);

export const mcpSchema = z
  .object({
    mcpServers: z.record(z.string(), serverSchema).optional(),
  })
  .passthrough();

export type McpConfig = z.infer<typeof mcpSchema>;

export interface StdioServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  type?: 'stdio';
}

export interface SseServer {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export interface HttpServer {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export type McpServer = StdioServer | SseServer | HttpServer;

export function detectTransport(server: Record<string, unknown>): McpTransport {
  const t = (server.type ?? server.transport) as string | undefined;
  if (t === 'sse') return 'sse';
  if (t === 'http' || t === 'streamable-http') return 'http';
  // stdio 由 command 字段识别，或 type/transport 显式为 stdio
  if (typeof server.command === 'string') return 'stdio';
  if (typeof server.url === 'string') return 'http';
  return 'stdio';
}

export function buildServer(transport: McpTransport, draft: Record<string, unknown>): McpServer {
  if (transport === 'stdio') {
    const command = typeof draft.command === 'string' ? draft.command : '';
    const args = Array.isArray(draft.args) ? draft.args.filter((a): a is string => typeof a === 'string') : undefined;
    const env = (draft.env && typeof draft.env === 'object' && !Array.isArray(draft.env))
      ? (draft.env as Record<string, string>) : undefined;
    const s: StdioServer = { command };
    if (args && args.length > 0) s.args = args;
    if (env && Object.keys(env).length > 0) s.env = env;
    return s;
  }
  const url = typeof draft.url === 'string' ? draft.url : '';
  const headers = (draft.headers && typeof draft.headers === 'object' && !Array.isArray(draft.headers))
    ? (draft.headers as Record<string, string>) : undefined;
  const base = { type: transport, url } as SseServer | HttpServer;
  if (headers && Object.keys(headers).length > 0) (base as SseServer | HttpServer).headers = headers;
  return base;
}

export interface McpValidation {
  ok: boolean;
  issues: { path: string; message: string }[];
  parseError?: string;
  value?: McpConfig;
}

export function validateMcpJsonText(text: string): McpValidation {
  let parsed: unknown;
  try {
    parsed = text.trim() === '' ? { mcpServers: {} } : JSON.parse(text);
  } catch (e) {
    return { ok: false, issues: [], parseError: (e as Error).message };
  }
  const result = mcpSchema.safeParse(parsed);
  if (result.success) return { ok: true, issues: [], value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map(i => ({
      path: i.path.length === 0 ? '(root)' : i.path.map(String).join('.'),
      message: i.message,
    })),
  };
}
