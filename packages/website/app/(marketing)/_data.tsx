import type { ReactNode } from 'react';

import { Code } from './_icons';

export const WORKFLOW_STEPS: { skill: string; title: string; desc: string }[] = [
  {
    skill: 'muicv-core',
    title: '收集素材',
    desc: '首次说"帮我准备简历"，skill 自动建 .claude/muicv/，引导收集 profile / experience / projects 等。',
  },
  {
    skill: 'muicv-jobs:fetch',
    title: '抓取 JD',
    desc: '粘一个招聘 URL，skill 调 API 清洗成 markdown 写到 targets/。',
  },
  {
    skill: 'muicv-jobs:match',
    title: '匹配度分析',
    desc: '对比 JD 和本地素材，告诉你覆盖了多少关键词、缺什么，避免盲投。',
  },
  {
    skill: 'muicv-generate',
    title: '生成简历',
    desc: '针对具体 JD 挑选、排序、改写素材到 versions/<slug>-<date>.md。',
  },
  {
    skill: 'muicv-critique',
    title: '评审迭代',
    desc: 'STAR / 量化 / 关键词对齐 / 长度 等 7 维度评分，P0/P1/P2 提建议。',
  },
  {
    skill: 'muicv-render',
    title: '导出 PDF',
    desc: '调服务端 API（Cloudflare Container + Puppeteer）渲染成 A4 PDF。',
  },
  {
    skill: 'muicv-jobs:apply',
    title: '准备投递',
    desc: '生成 cover letter + 投递 checklist 到 applications/。投递由你手动完成。',
  },
];

export const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: '我的简历数据存在哪？谁能看到？',
    a: (
      <>
        全部存在你当前项目目录下的 <Code>.claude/muicv/</Code> 文件夹里，纯 Markdown 文件。要不要入
        git、要不要备份到云盘、要不要分享给别人——完全由你决定。 我们的服务器只在你主动调 API（PDF 渲染、JD
        抓取）时短暂经手数据，不留存。
      </>
    ),
  },
  {
    q: '怎么收费？档位什么样？',
    a: (
      <>
        三档 + BYOK：
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Free</strong>：每月免费 token 试用，可输出 markdown 简历；不含 PDF 导出 / 招聘库 / 自动投递
          </li>
          <li>
            <strong>Pro</strong>（M4 起开放）：更多 token + PDF + 招聘库 + 辅助投递（数量有限）
          </li>
          <li>
            <strong>Max</strong>：不受限制
          </li>
          <li>
            <strong>BYOK</strong>（覆盖任意档）：在 dashboard 绑定 muirouter，LLM 走你自己 muirouter 余额， 不消耗平台
            token。功能权限按所在档（Free 即可启用）
          </li>
        </ul>
        Skill 本身永远免费——开发者用{' '}
        <code className="rounded bg-fluff px-1 py-0.5 font-mono text-[12px]">npx skills add</code> 直接接入 Claude Code
        等 agent。
      </>
    ),
  },
  {
    q: '什么是 BYOK？muirouter 是什么？',
    a: (
      <>
        BYOK = Bring Your Own Key。在{' '}
        <a
          href="https://muirouter.com"
          className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
        >
          muirouter.com
        </a>{' '}
        充一笔 LLM 余额，把 sk-gw key 绑到 muicv dashboard。所有 LLM 调用都走你自己的 muirouter 余额—— muirouter
        是统一接入多家 LLM 的代理（OpenAI / Anthropic / Gemini 等都通），余额可以跨任何 BYOK 服务复用。
      </>
    ),
  },
  {
    q: '桌面 app 什么时候发布？',
    a: (
      <>
        基于 OpenAI Agent SDK 的 electron 桌面端正在规划，给不用 AI agent 的求职者用。 没有具体时间表，
        <strong>留邮箱进 waitlist</strong>，发布会第一时间通知你。 在那之前，开发者可以直接用 skill
        套件（上面有安装命令）。
      </>
    ),
  },
  {
    q: '支持英文 / 双语简历吗？',
    a: (
      <>
        Skill 不强制语言——你的素材是中文，简历就是中文；JD 是英文，simulate 出来的简历会按英文风格写。
        双语版（中英对照）作为后续模板规划中。
      </>
    ),
  },
  {
    q: '能投递到 LinkedIn / Boss 直聘吗？',
    a: (
      <>
        不能自动投递。我们只帮你抓 JD、生成针对性简历、写 cover letter，
        真正的"按提交按钮"由你手动完成——这是有意为之，避免账号风险和 ToS 违规。
      </>
    ),
  },
];
