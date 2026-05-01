-- 简历素材云同步：用户在 muicv-core skill 里主动 push 整个本地素材库到云端。
-- resumeSnapshot 存当前活动版（每用户 1 行）；
-- resumeSnapshotHistory 存最近 N 份历史（每次 push 前把活动版搬过来，FIFO 保留 5 份）。
-- files 是 JSON 字符串：{ "<相对路径>": "<文件文本内容>" }。

CREATE TABLE IF NOT EXISTS resumeSnapshot (
  userId TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  files TEXT NOT NULL,
  hash TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  fileCount INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS resumeSnapshotHistory (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  files TEXT NOT NULL,
  hash TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  fileCount INTEGER NOT NULL,
  archivedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resumeSnapshotHistory_user
  ON resumeSnapshotHistory (userId, archivedAt DESC);
