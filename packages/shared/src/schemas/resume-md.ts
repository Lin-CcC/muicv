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

export type MuiCvFrontmatter =
  | ProfileFrontmatter
  | ExperienceFrontmatter
  | ProjectFrontmatter
  | TargetFrontmatter
  | VersionFrontmatter;
