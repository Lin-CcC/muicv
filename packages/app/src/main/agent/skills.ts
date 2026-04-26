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

**每次新对话的第一次工具调用，必须是探查素材库现状**：调
\`list_dir(".claude/muicv")\` 或 \`glob_files(".claude/muicv/**/*.md")\`。
拿到结果再决定后续。

具体分支：
- 工具返回**没有这个目录** / 报错 → 走 muicv-core 的"初始化流程"
- 工具返回有目录但**为空 / 只有 .gitkeep** → 同上，按初始化处理
- 工具返回有真实素材文件 → **优先用现有素材**，按用户意图执行（生成 / 评审 / 整理 等）；
  绝对不要无视已有素材去重新问"姓名是什么 / 目标岗位是什么"——这些问题应该
  通过 read_file 去 \`profile.md\` 等地方找答案

**禁止脑补素材库的状态**。不调工具就不知道，调工具拿事实。

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
