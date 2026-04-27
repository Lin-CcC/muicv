// 7 个 SKILL.md 用 ?raw 直接 inline 进 bundle（@skills alias → ../../skills）
// 这样运行时不需要 fs 找文件，dev / 打包都自动 work。
import muicvCoachingSkill from '@skills/muicv-coaching/SKILL.md?raw';
import muicvCoreSkill from '@skills/muicv-core/SKILL.md?raw';
import organizePrompt from '@skills/muicv-core/references/organize-prompt.md?raw';
import muicvCritiqueSkill from '@skills/muicv-critique/SKILL.md?raw';
import muicvGenerateSkill from '@skills/muicv-generate/SKILL.md?raw';
import generatePrompts from '@skills/muicv-generate/references/prompts.md?raw';
import muicvInterviewSkill from '@skills/muicv-interview/SKILL.md?raw';
import muicvJobsSkill from '@skills/muicv-jobs/SKILL.md?raw';
import muicvRenderSkill from '@skills/muicv-render/SKILL.md?raw';

import { CONVERSATION_TYPE_META, type ConversationType } from '../../shared/types.ts';

const SKILLS_RAW: Array<{
  name: string;
  type: ConversationType;
  body: string;
  references?: Record<string, string>;
}> = [
  {
    name: 'muicv-core',
    type: 'core',
    body: muicvCoreSkill,
    references: { 'organize-prompt.md': organizePrompt },
  },
  {
    name: 'muicv-generate',
    type: 'generate',
    body: muicvGenerateSkill,
    references: { 'prompts.md': generatePrompts },
  },
  { name: 'muicv-critique', type: 'critique', body: muicvCritiqueSkill },
  { name: 'muicv-jobs', type: 'jobs', body: muicvJobsSkill },
  { name: 'muicv-render', type: 'core', body: muicvRenderSkill }, // render 是工具型 skill，没单独对话类型
  { name: 'muicv-interview', type: 'interview', body: muicvInterviewSkill },
  { name: 'muicv-coaching', type: 'coaching', body: muicvCoachingSkill },
];

const PRELUDE = `你是 Mui简历桌面端的 agent。你的工作是帮用户走完简历工作流：
收集素材 → 抓 JD → 匹配度分析 → 生成简历 → 评审 → 渲染 PDF → 准备投递；
另外还可以辅助模拟面试、就业咨询。

# 硬性流程（违反就是错）

**每次新对话的第一次工具调用，必须探查素材库**。素材库的锚点是 \`profile.md\`
（带 frontmatter \`type: profile\`）。调：

\`\`\`
glob_files("**/profile.md")
\`\`\`

**素材库根 = \`profile.md\` 所在的目录**。这一点是宽松的：
- 老用户从 Claude Code + skills 流过来的，profile.md 在 \`.claude/muicv/\` 下，
  那 \`.claude/muicv/\` 就是根
- 新用户在 muicv 桌面端选了一个空目录作为 profile workspace 的，profile.md
  应该直接在工作目录根上，那工作目录就是根
- 用户自己挪到别处也没关系，跟着 glob 结果走

后续所有 read_file / write_file 的相对路径都基于这个根（例如
\`<root>/experience/foo.md\`）。

分支：
- glob 返回 0 个 profile.md → 走 muicv-core 的"初始化流程"。**新建直接落在
  工作目录根**（不要建 \`muicv/\` 也不要建 \`.claude/muicv/\` 子目录），
  让 profile.md / experience/ / projects/ / targets/ / versions/ 等都在
  工作目录顶层
- glob 返回 1 个 → 把它的父目录当作根，优先用现有素材
- glob 返回多个 → 列出来让用户挑

**用户已有素材时绝对不要再问姓名 / 目标岗位**——这些信息应该通过 read_file
读 \`<root>/profile.md\` 拿到。

**禁止脑补素材库的状态**。不调工具就不知道，调工具拿事实。

注：下面各 skill 文档里出现的 \`experience/foo.md\` / \`versions/...\`
等都是相对**素材库根**的路径，不是相对工作目录。

# 一般约束

- 所有文件读写都通过提供给你的工具完成。文件路径相对于"工作目录"。
- **不要编造用户事实**。所有简历内容严格限定在用户已经写入素材文件里的事实。
  缺信息就追问，不要替用户"发挥"。
- 中文友好：默认中文回复；用户切英文则跟着切。
- 关键操作（写文件、改文件、调外部 API）执行前简短告知用户你将做什么。
- 完成一个阶段就停下来等用户决定下一步，不要一口气跑完整个流程。

下面是你拥有的所有 skill，每个都是一份操作手册。按用户意图选合适的 skill 步骤执行：

`;

/**
 * 拼一个完整 system prompt：prelude + focus hint + 全部 skill。
 *
 * focusType：当前对话类型。在 prelude 末尾加一句"本次对话主线是 X，主要参考
 * skills/muicv-X/ 章节"，让 agent 优先按对应 skill 工作但不锁工具——其他
 * skill 仍可调用（critique 读 generate 写的文件 / interview 读 jd 等）。
 */
export function buildSystemPrompt(focusType?: ConversationType): string {
  const sections: string[] = [PRELUDE];

  if (focusType) {
    const meta = CONVERSATION_TYPE_META[focusType];
    sections.push(
      `**本次对话主线：${meta.emoji} ${meta.label}**（${meta.tagline}）。
优先按 \`muicv-${focusType}\` 这份 skill 的步骤工作；其他 skill 在需要时也可以调用，
但不要主动跑题（比如用户在做"模拟面试"，不要中途去抓 JD 或写简历，除非用户明确要）。
`,
    );
  }

  for (const skill of SKILLS_RAW) {
    sections.push(`\n--- SKILL: ${skill.name} ---\n${skill.body}`);
    if (skill.references) {
      for (const [refName, refBody] of Object.entries(skill.references)) {
        sections.push(`\n[${skill.name} reference: ${refName}]\n${refBody}`);
      }
    }
  }
  return sections.join('\n');
}
