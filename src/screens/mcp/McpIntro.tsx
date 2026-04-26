interface Props { exists: boolean; filePath: string; }

export function McpIntro({ exists, filePath }: Props) {
  return (
    <div style={{ maxWidth: 760, display: 'grid', gap: 16, fontSize: 13, lineHeight: 1.65, color: 'var(--cc-ink-soft)' }}>
      {!exists && (
        <div style={{
          background: '#FFF4EC', border: '1px solid #EDD6C5', borderRadius: 10,
          padding: '12px 16px', fontSize: 12.5, color: 'var(--cc-orange-deep)',
        }}>
          当前项目尚未创建 <span className="mono">.mcp.json</span>。点击右上角「编辑」并保存即可生成。路径：<span className="mono">{filePath}</span>
        </div>
      )}

      <Card title="什么是 MCP？">
        <p>
          MCP（Model Context Protocol）是 Claude Code 与外部工具/数据源对话的协议。
          一个 MCP server 把工具能力（例如查数据库、读 Sentry、调用 GitHub API）暴露给 Claude，
          让它在会话中调用，而不需要把所有逻辑写进 Claude Code 自身。
        </p>
        <p>
          配置文件 <span className="mono">.mcp.json</span> 放在项目根目录，由当前项目的所有协作者共享；
          也可以在用户级 <span className="mono">~/.claude/settings.json</span> 的 <span className="mono">mcpServers</span> 字段中配置。
        </p>
      </Card>

      <Card title="三种传输方式">
        <Row name="stdio" desc="把一个本地命令当成 MCP 服务（默认）。Claude Code 通过子进程的 stdin / stdout 通讯。" example={`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/code"],
      "env": { "DEBUG": "1" }
    }
  }
}`} />
        <Row name="sse" desc="基于 Server-Sent Events 的远程 MCP。适合长连接、流式输出。" example={`{
  "mcpServers": {
    "company-bot": {
      "type": "sse",
      "url": "https://mcp.example.com/sse",
      "headers": { "Authorization": "Bearer xxx" }
    }
  }
}`} />
        <Row name="http" desc="基于 HTTP（streamable-http）的远程 MCP。最常见的远端协议。" example={`{
  "mcpServers": {
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp",
      "headers": { "Authorization": "Bearer xxx" }
    }
  }
}`} />
      </Card>

      <Card title="如何配置">
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <li>切换到「<b>可视化</b>」标签：直接增/删/改 server，无需手写 JSON。</li>
          <li>切换到「<b>源文件</b>」标签：用 Monaco 编辑原始 JSON，适合批量改、复制粘贴官方示例。</li>
          <li>保存时会自动备份到 <span className="mono">~/.claude/.backups/</span>，并基于 mtime 检测外部修改。</li>
        </ol>
      </Card>

      <Card title="常用命令行（参考）">
        <div className="mono" style={{ background: 'var(--cc-bg-sunk)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
          claude mcp add --transport http sentry https://mcp.sentry.dev/mcp{'\n'}
          claude mcp add my-server -- npx my-mcp-server{'\n'}
          claude mcp list{'\n'}
          claude mcp remove sentry
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: 'var(--cc-bg-raised)', border: '1px solid var(--cc-line)', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </section>
  );
}

function Row({ name, desc, example }: { name: string; desc: string; example: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--cc-line)', paddingTop: 12 }}>
      <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cc-orange-deep)', marginBottom: 4 }}>{name}</div>
      <div style={{ fontSize: 12.5, marginBottom: 8 }}>{desc}</div>
      <pre style={{
        background: 'var(--cc-ink)', color: '#F7E9E0', borderRadius: 8,
        padding: '10px 12px', fontSize: 11.5, overflow: 'auto', margin: 0,
      }}>{example}</pre>
    </div>
  );
}
