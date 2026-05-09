-- 消息级反馈（赞 / 踩 / 聊聊）。每条 AI 消息一组反馈记录。
--
-- kind = 'rating' —— 赞 / 踩二选一，rating 列存 'praise' | 'dislike'，
--                    每个 user × messageId 至多一行（partial unique index 见下）。
--                    切换 praise <-> dislike 走 UPDATE，不再插新行也不再发奖励。
-- kind = 'comment' —— 自由文本（"聊聊"），text 列存原文。同一条消息可有多条评论。
--                    text 长度 ≥ FEEDBACK_COMMENT_MIN_CHARS（50）才入 token 奖励。
--
-- awarded：本条反馈实际入账的 μtoken。
--   - rating 首次插入时 = displayToMicro(FEEDBACK_RATING_REWARD)
--   - rating 切换时不修改（保留首次奖励金额，作为审计）
--   - comment 长度达标 = displayToMicro(FEEDBACK_COMMENT_REWARD)；不达标 = 0
--
-- 所有奖励通过 wallet.credit() 走 tokenLedger（type='feedback_reward'，
-- ledgerId 用 messageFeedback.id 实现幂等）。
--
-- messageId / conversationId 是 app 端 ChatMessage / Conversation 的 UUID，
-- 服务端不持有原始消息内容（消息只在 user profile dir 里持久化）。

CREATE TABLE IF NOT EXISTS messageFeedback (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  messageId TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  kind TEXT NOT NULL,                  -- 'rating' | 'comment'
  rating TEXT,                         -- kind='rating' 时 'praise'|'dislike'，否则 NULL
  text TEXT,                           -- kind='comment' 时评论原文，否则 NULL
  awarded INTEGER NOT NULL DEFAULT 0,  -- 这条反馈实际入账的 μtoken
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- rating 唯一：每个 user × messageId 最多一行 rating；comment 不受约束。
CREATE UNIQUE INDEX IF NOT EXISTS idx_messageFeedback_rating_unique
  ON messageFeedback (userId, messageId)
  WHERE kind = 'rating';

CREATE INDEX IF NOT EXISTS idx_messageFeedback_user_created
  ON messageFeedback (userId, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_messageFeedback_message
  ON messageFeedback (messageId);
