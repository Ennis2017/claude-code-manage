export function userClaudeBase(): string {
  return '~/.claude';
}

export function commandTemplate(name: string): string {
  return `---
description: ${name} 命令描述
---

# /${name}

在此描述命令用途、用法与示例。
`;
}

export function agentTemplate(name: string): string {
  return `---
name: ${name}
description: ${name} 子代理描述
tools: Read, Edit, Bash
---

你是 ${name} 子代理。在此描述能力范围与行为准则。
`;
}

export function skillTemplate(name: string): string {
  return `---
name: ${name}
description: ${name} 技能描述
---

# ${name}

在此写下该 Skill 的触发条件、步骤和示例。
`;
}
