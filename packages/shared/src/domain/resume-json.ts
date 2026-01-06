export type ResumeFieldSource = {
  messageId: string;
  quote?: string;
};

export type ResumeBasicInfo = {
  fullName?: string;
  headline?: string;
  location?: string;
  email?: string;
  phone?: string;
  links?: Array<{ label: string; url: string }>;
};

export type ResumeExperienceItem = {
  company?: string;
  role?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  source?: ResumeFieldSource[];
};

export type ResumeProjectItem = {
  name?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  links?: Array<{ label: string; url: string }>;
  source?: ResumeFieldSource[];
};

export type ResumeEducationItem = {
  school?: string;
  major?: string;
  degree?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
  source?: ResumeFieldSource[];
};

export type ResumeJson = {
  version: 1;
  basicInfo: ResumeBasicInfo;
  summary?: string;
  skills?: string[];
  experiences?: ResumeExperienceItem[];
  projects?: ResumeProjectItem[];
  education?: ResumeEducationItem[];
  lastUpdatedAt: string;
};
