-- 简历素材云同步加密路径：用户在 muicv-sync skill 里 zip -e 整库加密后 multipart 上传到 R2。
-- D1 这里只存元数据 + 用户给的 summary（短文本描述），blob 本体走 R2 (binding MUICV_RESUME_BLOB)。
-- blobId 是 R2 object key 的尾段（uuid），完整 key 形如 `users/{userId}/blobs/{blobId}.zip`。
-- summary 限制 500 字符（packages/shared 的 RESUME_SYNC_BLOB_SUMMARY_MAX_LEN），无内容侧 schema。

CREATE TABLE IF NOT EXISTS resumeSnapshotBlob (
  userId TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  blobId TEXT NOT NULL,
  summary TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS resumeSnapshotBlobHistory (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  blobId TEXT NOT NULL,
  summary TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  archivedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resumeSnapshotBlobHistory_user
  ON resumeSnapshotBlobHistory (userId, archivedAt DESC);
