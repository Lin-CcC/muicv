export type ContentStatus = 'draft' | 'published';

export type PostSection = 'jobs' | 'product' | 'guide';

export type ContentPost = {
  slug: string;
  section: PostSection;
  status: ContentStatus;
  title: string;
  summary: string;
  bodyMarkdown: string;
  tags: string[];
  keywords: string[];
  author: string;
  publishedAt: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
};

export type SkillPublisherType = 'muicv' | 'official' | 'community';
export type SkillDistributionMode = 'built_in' | 'link_only' | 'hosted' | 'external_direct';
export type SkillAppAvailability = 'built_in' | 'link_only' | 'installable' | 'coming_soon';

export type SkillCatalogItem = {
  slug: string;
  status: ContentStatus;
  title: string;
  publisher: string;
  publisherType: SkillPublisherType;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceNote?: string;
  distributionMode: SkillDistributionMode;
  appAvailability: SkillAppAvailability;
  summary: string;
  bodyMarkdown: string;
  useCases: string[];
  tags: string[];
  keywords: string[];
  disclaimer?: string;
  publishedAt: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
};

export type ChangelogItem = {
  slug: string;
  status: ContentStatus;
  title: string;
  summary: string;
  bodyMarkdown: string;
  version?: string;
  publishedAt: string;
  updatedAt: string;
};

export const POST_SECTION_META: Record<PostSection, { label: string; path: string; description: string }> = {
  jobs: {
    label: '求职博文',
    path: '/posts/jobs',
    description: '围绕校招、社招、简历、面试、offer 决策的实用文章。',
  },
  product: {
    label: '产品文章',
    path: '/posts/product',
    description: 'Mui 简历的产品思考、能力说明和使用方式。',
  },
  guide: {
    label: '使用教程',
    path: '/posts/guide',
    description: '从下载安装到素材整理、简历生成、面试复盘的操作指南。',
  },
};

export const CONTENT_POSTS: ContentPost[] = [
  {
    slug: 'tencent-campus-recruiting-skill',
    section: 'jobs',
    status: 'published',
    title: '腾讯校招 Skill 怎么用：把官方求职指导放进你的 AI agent',
    summary:
      '腾讯招聘发布了面向校招场景的官方 skill。Mui 简历会把它登记到目录里，方便你找到官方来源，并把自己的简历素材和面试准备串起来。',
    author: 'Mui简历',
    publishedAt: '2026-05-15',
    updatedAt: '2026-05-15',
    tags: ['校招', '腾讯招聘', '就业指导', 'AI agent'],
    keywords: ['腾讯校招', '腾讯招聘 skill', '就业指导', '校招简历', 'AI 求职'],
    seoTitle: '腾讯校招 Skill 怎么用：官方求职指导与 AI agent 工作流',
    seoDescription: '介绍腾讯招聘官方校招 skill 的使用边界、适合场景，以及如何结合 Mui 简历准备校招简历和面试。',
    bodyMarkdown: `## 它解决什么问题

腾讯招聘官方发布的校招 skill，更适合放在你已经习惯的 AI agent 里使用：你可以围绕岗位、校招流程、简历表达和面试准备持续追问，而不是在一篇静态文章里来回翻。

Mui 简历不会复制这份 skill，也不声称与腾讯招聘有合作关系。我们做的是目录登记：把官方来源、适用场景和安装入口放到一个更容易被搜索和收藏的页面里。

## 适合谁

- 正在准备腾讯校招、实习转正或提前批的同学
- 想把官方求职指导放进 Claude Code、Codex、Cursor 等 agent 的用户
- 已经在 Mui 简历里整理了素材，想继续准备面试和投递策略的人

## 和 Mui 简历怎么配合

先在 Mui 简历里整理你的经历、项目和技能，再去官方来源安装腾讯招聘 skill。这样你问到简历优化、岗位匹配、面试准备时，agent 能基于你的真实素材做推理，而不是只给通用建议。

## 注意边界

第三方官方 skill 的内容、更新和安装说明以发布方为准。Mui 简历只提供索引和使用建议，不托管、不改写、不替官方维护。`,
  },
  {
    slug: 'campus-resume-project-proof',
    section: 'jobs',
    status: 'published',
    title: '校招简历最该补的不是模板，是项目证据',
    summary: '校招简历常见问题不是排版不够漂亮，而是项目只写了技术栈，没有写清上下文、动作和结果。',
    author: 'Mui简历',
    publishedAt: '2026-05-15',
    updatedAt: '2026-05-15',
    tags: ['校招', '简历', '项目经历'],
    keywords: ['校招简历', '项目经历', 'STAR', '简历优化'],
    seoTitle: '校招简历项目经历怎么写：先补证据，再换模板',
    seoDescription: '校招简历项目经历写法：用任务、动作、结果和证据替代空泛技术栈，适合准备互联网校招的同学。',
    bodyMarkdown: `## 模板不是第一优先级

很多同学改简历时第一反应是换模板。模板当然重要，但在校招场景里，真正拉开差距的是项目证据：你解决了什么问题、承担了哪部分、结果怎么被验证。

## 一段项目至少回答三件事

1. 这个项目为什么存在
2. 你具体做了什么，哪些决策是你做的
3. 结果怎么衡量，哪怕只是课程评分、用户反馈或性能指标

## 可以先这样写

把“使用 React + Node.js 完成后台管理系统”改成：“负责后台管理系统的权限与列表页性能优化，重构接口聚合逻辑，首屏加载从 4.2s 降到 1.8s，并整理成可复用 hooks 给 3 个页面复用。”

不一定每段都有漂亮数字，但每段都应该有可验证的事实。`,
  },
];

export const SKILL_CATALOG: SkillCatalogItem[] = [
  {
    slug: 'tencent-campus-recruiting',
    status: 'published',
    title: '腾讯招聘官方校招 Skill',
    publisher: '腾讯招聘',
    publisherType: 'official',
    sourceUrl: 'https://mp.weixin.qq.com/s/kbJ-K8wyHgcr-lvwisFM4Q',
    sourceLabel: '腾讯招聘官方发布页',
    sourceNote: '第三方官方来源，不由 Mui 简历托管。',
    distributionMode: 'link_only',
    appAvailability: 'link_only',
    summary: '面向腾讯校招与实习求职的官方 skill，适合在 AI agent 中查询校招流程、岗位准备和求职建议。',
    useCases: ['了解腾讯校招准备方式', '围绕岗位追问简历和面试建议', '把官方就业指导接入自己的 agent 工作流'],
    tags: ['腾讯招聘', '校招', '就业指导', '第三方官方'],
    keywords: ['腾讯校招', '腾讯招聘 skill', '腾讯就业指导', '校招 AI agent'],
    disclaimer:
      'Mui 简历与腾讯招聘没有合作关系。本页面只做来源索引与使用建议，skill 内容和安装说明以腾讯招聘官方发布为准。',
    publishedAt: '2026-05-15',
    updatedAt: '2026-05-15',
    seoTitle: '腾讯招聘官方校招 Skill：AI agent 里的腾讯校招就业指导',
    seoDescription: '腾讯招聘官方校招 skill 的来源、适用场景和安装入口。Mui 简历仅做索引，不托管第三方 skill 内容。',
    bodyMarkdown: `## 这是什么

这是腾讯招聘官方发布的校招 skill。它面向校招、实习、求职准备等场景，适合已经在使用 AI agent 的同学安装到自己的工作流里。

Mui 简历不会复制第三方 skill 内容，也不会把它伪装成 Mui 自有扩展。我们只登记官方来源、整理适用场景，并在 app 里给你一个稳定入口。

## 在 Mui 简历里的使用建议

先用 Mui 简历整理自己的经历、项目、技能和目标岗位，再去官方来源安装这份 skill。之后你可以围绕“腾讯校招岗位需要怎么准备”“我的项目经历怎么讲”“面试前应该补哪些材料”持续追问。

## 安装方式

请以腾讯招聘官方发布页为准。由于这类第三方官方 skill 不由 Mui 托管，Mui app 第一版会打开官方来源，而不是直接替你安装。`,
  },
  {
    slug: 'muicv-interview',
    status: 'published',
    title: 'Mui 模拟面试',
    publisher: 'Mui简历',
    publisherType: 'muicv',
    distributionMode: 'built_in',
    appAvailability: 'built_in',
    summary: '基于你的简历素材和目标岗位，模拟行为面、技术面、HR 面，并把反馈沉淀到本地素材库。',
    useCases: ['投递前演练', '行为题结构化表达', '面试后针对弱项复盘'],
    tags: ['内置', '面试', '反馈'],
    keywords: ['模拟面试', '行为面试', '技术面试', 'AI 面试官'],
    publishedAt: '2026-05-15',
    updatedAt: '2026-05-15',
    seoTitle: 'Mui 模拟面试 Skill：基于简历和 JD 的面试练习',
    seoDescription: 'Mui 简历内置模拟面试 skill，按岗位、轮次和级别生成问题，并给出结构化反馈。',
    bodyMarkdown: `## 已内置在 Mui app

这份 skill 已经随 Mui 简历桌面端打包。新建“模拟面试”对话后，Mui 会先读取你的素材库，再根据目标岗位、轮次和级别组织问题。

## 适合什么时候用

- 简历已经基本成型，准备开始投递
- 目标岗位 JD 已经保存到素材库
- 想练 STAR、项目深挖或 HR 沟通`,
  },
  {
    slug: 'muicv-coaching',
    status: 'published',
    title: 'Mui 就业辅导',
    publisher: 'Mui简历',
    publisherType: 'muicv',
    distributionMode: 'built_in',
    appAvailability: 'built_in',
    summary: '围绕跳槽、offer、薪资谈判、转方向等开放问题做职业决策辅导。',
    useCases: ['比较 offer', '判断要不要跳槽', '准备薪资沟通话术'],
    tags: ['内置', '职业咨询', 'offer'],
    keywords: ['就业辅导', 'offer 分析', '薪资谈判', '职业规划'],
    publishedAt: '2026-05-15',
    updatedAt: '2026-05-15',
    seoTitle: 'Mui 就业辅导 Skill：offer、跳槽和职业选择',
    seoDescription: 'Mui 简历内置就业辅导 skill，帮助你拆解跳槽、offer 比较、薪资谈判和职业方向问题。',
    bodyMarkdown: `## 已内置在 Mui app

就业辅导不是结构化产物，而是一个可以反复追问的 mentor 对话。它不会替你做决定，会把选择、代价和风险摊开。

## 适合问什么

- 这个 offer 要不要接
- 现在跳槽是否划算
- 从前端转 AI 或管理岗要补什么`,
  },
];

export const CHANGELOG_ITEMS: ChangelogItem[] = [
  {
    slug: 'skill-directory-start',
    status: 'published',
    title: '新增 Skill 目录和求职内容中心',
    summary: 'Mui 简历开始登记第三方官方 skill、自有 skill 与求职博文，为网站 SEO 和 app 扩展市场打基础。',
    version: '0.5.0',
    publishedAt: '2026-05-15',
    updatedAt: '2026-05-15',
    bodyMarkdown: `## 本次更新

- 新增 skill 目录数据模型
- 新增求职博文频道
- app 将开始展示可用 skill 和官方来源

第三方官方 skill 默认只链官方来源，不复制、不托管。`,
  },
];

function byPublishedAtDesc<T extends { publishedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPublishedPosts(section?: PostSection): ContentPost[] {
  const posts = CONTENT_POSTS.filter((post) => post.status === 'published' && (!section || post.section === section));
  return byPublishedAtDesc(posts);
}

export function getPostBySlug(section: PostSection, slug: string): ContentPost | null {
  return (
    CONTENT_POSTS.find((post) => post.status === 'published' && post.section === section && post.slug === slug) ?? null
  );
}

export function getPublishedSkills(): SkillCatalogItem[] {
  return byPublishedAtDesc(SKILL_CATALOG.filter((skill) => skill.status === 'published'));
}

export function getSkillBySlug(slug: string): SkillCatalogItem | null {
  return SKILL_CATALOG.find((skill) => skill.status === 'published' && skill.slug === slug) ?? null;
}

export function getPublishedChangelog(): ChangelogItem[] {
  return byPublishedAtDesc(CHANGELOG_ITEMS.filter((item) => item.status === 'published'));
}
