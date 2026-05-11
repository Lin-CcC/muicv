-- 证件照上传审计：谁、什么时候、上传了哪个 R2 object。
-- 用途：
--   * 滥用排查（同一 userId 1 小时内上传 > 50 张能报警）
--   * 个人 dashboard 里展示历史上传 + 一键复用
--   * Phase 3 可能加按 userId 清理逻辑（用户注销账号时一并删 R2 + 这行）
--
-- 字段：
--   id          自增 PK
--   userId      上传者
--   r2Key       R2 object key，形如 <userId>/<uuid>.<ext>
--   url         绑定到 i.muicv.com 之后的公开 URL（前端 / 模板直接用这条）
--   contentType image/jpeg | image/png | image/webp
--   sizeBytes   原始字节数（< 2MB）
--   originalName 客户端给的文件名（截到 200 字符，留作辅助识别，**不**做安全断言）
--   createdAt   epoch 毫秒

CREATE TABLE IF NOT EXISTS photoUpload (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  r2Key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  contentType TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  originalName TEXT,
  createdAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photoUpload_user ON photoUpload (userId, createdAt DESC);
