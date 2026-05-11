-- 在线预览：用户调 POST /preview 创建一个可分享的 token URL，
-- 浏览器打开 https://muicv.com/preview/<token> 看到渲染结果，
-- 右上角「下载 PDF」按钮调 POST /preview/<token>/pdf 拿 PDF。
--
-- 字段说明：
--   resumeJson  TemplateResumeData JSON.stringify 后存储（packages/shared 定义）
--   template    t1-classic / t2-minimal / t3-sidebar / t4-tech / t5-timeline / t6-academic
--   lang        预览页和 PDF 渲染语言：'zh' | 'en'
--   shareMode   'link' = 仅持链接者可见；'public' = 全网公开（dashboard 可切换）
--   pdfCredit   累计已扣过 PDF 渲染费的次数。访客点下载时 owner 已经预付过则免费再渲染。
--               这条规则避免 token 公开后无限刷 PDF 烧 owner 余额。
--   accent      可选自定义主色（覆盖模板默认 --accent）
--   createdAt / expiresAt / revokedAt 都是 epoch 毫秒。

CREATE TABLE IF NOT EXISTS preview (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  resumeJson TEXT NOT NULL,
  template TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'zh',
  accent TEXT,
  shareMode TEXT NOT NULL DEFAULT 'link',
  pdfCredit INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  revokedAt INTEGER
);

CREATE INDEX IF NOT EXISTS idx_preview_user ON preview (userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_preview_expires ON preview (expiresAt);
