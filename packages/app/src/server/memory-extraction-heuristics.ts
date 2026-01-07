const EXPLICIT_MEMORY_KEYWORDS = [
  '简历',
  '个人信息',
  '基本信息',
  '联系方式',
  '邮箱',
  '电话',
  '手机号',
  '微信',
  'github',
  '链接',
  '网址',
  '博客',
  'portfolio',
  '工作经历',
  '项目经历',
  '教育经历',
  '实习',
  '公司',
  '岗位',
  '职责',
  '项目',
  '技术栈',
  '技能',
  '证书',
  '获奖',
  '竞赛',
  'gpa',
  '求职',
  '目标岗位',
  '期望',
  '薪资',
  '转岗',
  '离职',
  '入职',
  '毕业',
  '面试',
];

const FIRST_PERSON_HINTS = ['我', '我的', '目前', '最近', '这段时间', '从', '已经', '一直', '主要'];

const USER_FACT_VERBS = [
  '开始',
  '负责',
  '参与',
  '主导',
  '带领',
  '完成',
  '实现',
  '开发',
  '维护',
  '上线',
  '优化',
  '重构',
  '写过',
  '做过',
  '入职',
  '离职',
  '加入',
  '任职',
  '就职',
  '毕业',
  '就读',
  '转岗',
  '转到',
  '改成',
  '更新',
  '新增',
  '删除',
  '更正',
  '学会',
  '掌握',
  '熟悉',
  '擅长',
  '精通',
  '使用',
  '落地',
];

function includesAny(text: string, needles: string[]) {
  for (const needle of needles) {
    if (needle && text.includes(needle)) return true;
  }
  return false;
}

function looksLikeEmail(text: string) {
  return /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text);
}

function looksLikePhone(text: string) {
  return /(\+?\d[\d\s-]{7,}\d)/.test(text);
}

function looksLikeUrl(text: string) {
  return /https?:\/\//.test(text);
}

export function shouldAttemptMemoryExtraction(userText: string): boolean {
  const content = userText.trim();
  if (!content) return false;

  const lower = content.toLowerCase();

  if (looksLikeEmail(content) || looksLikePhone(content) || looksLikeUrl(lower)) return true;
  if (includesAny(content, EXPLICIT_MEMORY_KEYWORDS)) return true;
  if (includesAny(lower, EXPLICIT_MEMORY_KEYWORDS)) return true;

  const hasFirstPersonHint = includesAny(content, FIRST_PERSON_HINTS);
  const hasFactVerb = includesAny(content, USER_FACT_VERBS);
  return hasFirstPersonHint && hasFactVerb;
}
