import type { ReactNode } from 'react';

export type KeyFeature = {
  title: string;
  desc: string;
  status: 'live' | 'soon';
  highlights: string[];
};

export const KEY_FEATURES: KeyFeature[] = [
  {
    title: '整理职业素材',
    desc: '把现有简历、项目经历、技能和亮点拆成可复用素材。以后每次投递都从同一份底稿出发。',
    status: 'live',
    highlights: ['导入简历', '补齐经历', '本地文件管理'],
  },
  {
    title: '针对岗位生成',
    desc: '给 Mui 一个目标岗位，它会从素材库挑选、排序、改写内容，生成一份更对得上的简历版本。',
    status: 'live',
    highlights: ['岗位抓取', '匹配度评估', '版本化管理'],
  },
  {
    title: '评审与导出',
    desc: '按 STAR、量化、关键词、篇幅等维度检查草稿，再导出 A4 PDF，减少临投前的手忙脚乱。',
    status: 'live',
    highlights: ['7 维度评审', '修改建议', 'PDF 导出'],
  },
  {
    title: '继续练习求职',
    desc: '素材稳定之后，可以继续做模拟面试、求职信和投递 checklist。高级能力会在你需要时出现。',
    status: 'soon',
    highlights: ['模拟面试', '求职信', '投递 checklist'],
  },
];

export type WorkflowStep = {
  title: string;
  desc: string;
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    title: '导入现有简历或粘贴经历',
    desc: '不用先学概念。把你已经有的 PDF、文档或一段项目经历放进来，Mui 从真实材料开始整理。',
  },
  {
    title: '整理成可复用素材库',
    desc: '经历、项目、技能会被拆成 Markdown 文件，存在你自己的电脑里。以后每次改简历都不用从头来。',
  },
  {
    title: '针对岗位生成、评审、导出',
    desc: '有了素材库，再贴岗位链接或描述，Mui 会生成版本、检查问题，并导出可以投递的 PDF。',
  },
];

export const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: '我的简历数据存在哪？谁能看到？',
    a: (
      <>
        全部存在你自己的电脑上——以纯 Markdown 文件的形式，由你完全掌握。要不要备份、要不要分享给别人，都由你决定。
        我们的服务器只在你主动调用导出 PDF / 抓取岗位等功能时短暂经手数据，处理完即丢弃，不留存任何简历内容。
      </>
    ),
  },
  {
    q: '怎么收费？',
    a: (
      <>
        统一 token 钱包：
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>注册一次性赠送 10,000 tokens</strong>，永不过期，用完为止
          </li>
          <li>
            <strong>订阅</strong>：Pro / Max 月付或年付，按周期自动续 token；年付一次发整年用量，约 8 折
          </li>
          <li>
            <strong>补充包</strong>：一次性买 10K / 35K / 130K tokens，随用随买
          </li>
          <li>
            <strong>BYOK</strong>：在 dashboard 绑你自己的 muirouter，LLM 走你余额；PDF / JD 仍按 muicv tokens 扣
          </li>
        </ul>
        所有云端服务（云端 LLM、PDF、JD）按 token 扣费。具体价格请看{' '}
        <a
          href="/pricing"
          className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
        >
          定价页
        </a>
        。
      </>
    ),
  },
  {
    q: '什么是 BYOK？',
    a: (
      <>
        BYOK = Bring Your Own Key，自带 LLM 余额。绑定之后，所有 AI 调用走你自己的余额， 我们不再消耗平台
        token——适合已经有 LLM 服务订阅、希望统一成本管理的用户。
      </>
    ),
  },
  {
    q: '桌面 app 什么时候发布？',
    a: (
      <>
        <strong>已经上线</strong>，macOS / Windows / Linux 全平台可用。 去{' '}
        <a
          href="/download"
          className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
        >
          下载页
        </a>{' '}
        获取最新版本。 已经在用 AI agent（Claude Code / Codex / Cursor 等）的用户也可以通过 skill
        套件直接接入，二选一即可。
      </>
    ),
  },
  {
    q: '支持英文 / 双语简历吗？',
    a: <>支持。素材是中文，简历就是中文；目标岗位是英文，生成的简历会按英文风格写； 中英对照模板已在规划中。</>,
  },
  {
    q: '会自动投递到 LinkedIn / Boss 直聘吗？',
    a: (
      <>
        不会。我们只帮你抓岗位、生成针对性简历、写求职信、整理 checklist——
        真正的"按提交按钮"由你手动完成。这是有意为之，避免账号风险和 ToS 违规。
      </>
    ),
  },
];
