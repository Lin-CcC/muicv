import type { ReactNode } from 'react';

export type KeyFeature = {
  title: string;
  desc: string;
  status: 'live' | 'soon';
  highlights: string[];
};

export const KEY_FEATURES: KeyFeature[] = [
  {
    title: '智能简历',
    desc: '不再一份简历投到死。针对每个岗位定向定制内容、调整侧重，导出一份真正"对得上"的 PDF。',
    status: 'live',
    highlights: ['STAR / 量化 / 关键词 7 维度评审', 'A4 PDF 导出', '版本化管理'],
  },
  {
    title: '岗位发现',
    desc: '粘一条招聘 URL，自动抓取并清洗成结构化目标；按你的素材计算匹配度，告诉你哪些岗位值得投。',
    status: 'live',
    highlights: ['JD 自动抓取', '匹配度评估', '关键词覆盖分析'],
  },
  {
    title: '模拟面试',
    desc: '基于目标岗位生成面试题，给出回答框架与示例；多轮演练，让你提前熟悉真正会被问到的问题。',
    status: 'soon',
    highlights: ['行为面 / 技术面分轨', '回答框架建议', '多轮演练'],
  },
  {
    title: '就业辅导',
    desc: '求职信代写、投递 checklist、节奏建议——围绕你的真实素材，不是泛泛的鸡汤。',
    status: 'soon',
    highlights: ['Cover letter 代写', '投递 checklist', '节奏与策略建议'],
  },
  {
    title: '持续进化',
    desc: '求职追踪、薪酬谈判、内推网络……更多能力还在路上，关注更新第一时间体验新模块。',
    status: 'soon',
    highlights: ['求职追踪看板', '薪酬谈判助手', '内推网络对接'],
  },
];

export type WorkflowStep = {
  title: string;
  desc: string;
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    title: '整理素材',
    desc: '把过往的工作经历、项目、技能整理成结构化材料，全部存在你自己电脑或项目里。',
  },
  {
    title: '发现岗位',
    desc: '粘一条招聘链接，自动抓取并整理成目标岗位档案，方便后续比对。',
  },
  {
    title: '匹配度评估',
    desc: '对照目标岗位与你的素材，告诉你覆盖了多少关键词、缺什么，避免盲投。',
  },
  {
    title: '定制简历',
    desc: '针对具体岗位挑选、排序、改写素材，生成一份真正"对得上"的简历草稿。',
  },
  {
    title: '多轮评审',
    desc: 'STAR / 量化 / 关键词对齐 / 篇幅 等 7 维度打分，按 P0/P1/P2 给出修改建议。',
  },
  {
    title: '导出 PDF',
    desc: '一键导出 A4 排版的 PDF；版式跟着内容自适应，不用自己调字号边距。',
  },
  {
    title: '投递准备',
    desc: '生成求职信和投递 checklist；按提交按钮的事还由你做，账号风险更可控。',
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
