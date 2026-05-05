/**
 * muicv 本地简历素材库的 Markdown frontmatter 类型。
 *
 * 用户项目下 `.claude/muicv/` 目录内所有 Markdown 文件的 YAML frontmatter
 * 都应该符合这些类型。Skill 指令里会引用这里定义的字段名。
 *
 * 这里只做编译时的类型定义，不包含运行时校验。
 * 运行时校验由各 skill 脚本或 API 按需加（建议用 zod）。
 */

/** ISO 年月，例如 "2024-03"。类型本身无法严格到月份区间，作为提示用。 */
export type IsoYearMonth = `${number}-${number}`;

/** 结束时间：ISO 年月或 'present'（至今）。 */
export type EndDate = IsoYearMonth | 'present';

export type ResumeMdLink = {
  label: string;
  url: string;
};

/** profile.md —— 用户身份信息。每个 `.claude/muicv/` 下有且仅有一份。 */
export type ProfileFrontmatter = {
  type: 'profile';
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: ResumeMdLink[];
};

/** experience/*.md —— 一段工作经历一个文件。 */
export type ExperienceFrontmatter = {
  type: 'experience';
  company: string;
  title: string;
  start: IsoYearMonth;
  end: EndDate;
  location?: string;
  stack?: string[];
};

/** projects/*.md —— 一个项目一个文件。 */
export type ProjectFrontmatter = {
  type: 'project';
  name: string;
  role?: string;
  start?: IsoYearMonth;
  end?: EndDate;
  stack?: string[];
  url?: string;
};

/** targets/*.md —— 目标岗位/JD，由 muicv-jobs 抓取或用户手工粘贴。 */
export type TargetFrontmatter = {
  type: 'target';
  company: string;
  title: string;
  source_url?: string;
  fetched_at?: string; // ISO-8601
};

/** versions/*.md —— 针对某个 target 生成的具体简历版本，由 muicv-generate 产出。 */
export type VersionFrontmatter = {
  type: 'version';
  target?: string; // 指向 targets/*.md 的相对路径
  generated_at: string; // ISO-8601
};

/** applications/*.md —— cover letter 与投递 checklist，由 muicv-jobs:apply 产出。 */
export type ApplicationFrontmatter = {
  type: 'application';
  target: string; // 指向 targets/*.md 的相对路径
  company: string;
  title: string;
  prepared_at: string; // ISO-8601
};

/** debriefs/*.md —— 真实面试复盘，由 muicv-debrief 产出。 */
export type DebriefFrontmatter = {
  type: 'debrief';
  company: string;
  title: string;
  date: string; // ISO 日期 YYYY-MM-DD
  round?: string; // round-1 / round-2 / hr / final 等
  round_label?: string; // 自由文本标签：技术二面（2/4）等
  interviewer?: string; // 角色描述（"Staff 工程师"），不要记真名
  outcome?: 'pending' | 'passed' | 'rejected' | 'withdrawn' | 'unknown';
  duration_min?: number;
};

/**
 * interviews/*.md —— 模拟面试题目反馈，由 muicv-interview 在每轮总评后让用户
 * 对题目打 👍/👎 + 可选评论后产出。跟 debriefs/ 平行（debriefs 是真实面试复盘，
 * interviews 是模拟面试历史 + 题目质量打分），两个目录不混。
 *
 * 当前阶段（P1a）只收集打分数据，不复用——等积累一段时间再设计反哺出题逻辑的算法。
 */
export type InterviewFeedbackFrontmatter = {
  type: 'interview_feedback';
  company: string;
  title: string;
  round: string; // 跟 DebriefFrontmatter 的 round 字段对齐
  round_label?: string;
  level: string; // junior / mid / senior / staff / principal / em-... 等
  category: string; // frontend / backend / mobile / em / ... 见 references/level-category-heuristics.md
  date: string; // YYYY-MM-DD
  mode: 'voice' | 'typing'; // 语音 = client；打字 = skill
  target?: string; // 指向 targets/*.md 的相对路径
  version?: string; // 指向 versions/*.md 的相对路径
};

/**
 * audio-reviews/*.md —— 录音复盘，由 muicv-audio-review 产出（issue #1 M4）。
 * 用户拖一段已有录音 → STT 转写 → 按场景分析 → 写到这里。跟 debriefs/ 区别：
 * debrief 是用户口述写下来；audio-review 是直接转写音频。
 */
export type AudioReviewFrontmatter = {
  type: 'audio_review';
  /** 复盘场景，决定分析维度。详见 skills/muicv-audio-review/SKILL.md。 */
  scenario: 'interview' | 'client' | 'pitch' | 'meeting' | 'other';
  /** 原音频文件路径（用户视角，方便回放对照），通常是绝对路径。 */
  source: string;
  /** 音频时长（分钟，向上取整），来自 transcribe_audio_file 工具。 */
  duration_min: number;
  /** 复盘当天 YYYY-MM-DD。 */
  date: string;
  /** Whisper 检测到的主语言，例：zh / en / ja。 */
  language?: string;
  /** 可选关联：面试录音通常对应一个 target / version。 */
  related_target?: string;
  related_version?: string;
};

export type MuiCvFrontmatter =
  | ProfileFrontmatter
  | ExperienceFrontmatter
  | ProjectFrontmatter
  | TargetFrontmatter
  | VersionFrontmatter
  | ApplicationFrontmatter
  | DebriefFrontmatter
  | InterviewFeedbackFrontmatter
  | AudioReviewFrontmatter;
