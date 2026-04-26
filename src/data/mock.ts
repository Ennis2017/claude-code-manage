export const SAMPLE_PROJECTS = [
  { id: 'aurora', name: 'aurora-web', alias: 'Aurora 前端', path: '~/code/aurora-web', added: '3 天前', configCount: 14, hasMcp: true, hasLocal: true, commands: 6, skills: 3, agents: 2, memory: true, lastEdit: '12 分钟前', mtime: '2026-04-24 14:20' },
  { id: 'bifrost', name: 'bifrost-api', alias: 'Bifrost 后端', path: '~/code/backend/bifrost-api', added: '2 周前', configCount: 9, hasMcp: true, hasLocal: false, commands: 4, skills: 1, agents: 3, memory: true, lastEdit: '昨天', mtime: '2026-04-23 18:04' },
  { id: 'lab', name: 'weekend-lab', alias: '周末实验', path: '~/code/experiments/weekend-lab', added: '5 天前', configCount: 3, hasMcp: false, hasLocal: false, commands: 0, skills: 0, agents: 0, memory: true, lastEdit: '4 小时前', mtime: '2026-04-24 10:30' },
  { id: 'docs', name: 'team-docs', alias: '团队文档', path: '~/code/team-docs', added: '1 个月前', configCount: 5, hasMcp: false, hasLocal: true, commands: 2, skills: 2, agents: 0, memory: true, lastEdit: '6 天前', mtime: '2026-04-18 09:15' },
];

export const USER_COMMANDS = [
  { name: 'commit', desc: '根据 diff 生成 commit message', edited: '2 周前' },
  { name: 'review', desc: '对最近改动做 code review', edited: '1 个月前' },
  { name: 'deploy', desc: '走完预发 → 生产的部署流程', edited: '3 天前' },
  { name: 'ship', desc: 'commit + push + 开 PR 一键三连', edited: '2 天前' },
];

export const USER_SKILLS = [
  { name: 'pdf-reader', desc: '读取 PDF 并提取结构化内容', files: 3, edited: '昨天' },
  { name: 'data-viz', desc: '用 observable plot 画图', files: 5, edited: '1 周前' },
  { name: 'api-mock', desc: '生成 OpenAPI 风格的 mock 数据', files: 2, edited: '3 周前' },
];

export const USER_AGENTS = [
  { name: 'code-reviewer', desc: '专注 TypeScript 和 React 审查', edited: '1 周前' },
  { name: 'test-writer', desc: '写 vitest / playwright 用例', edited: '4 天前' },
];
