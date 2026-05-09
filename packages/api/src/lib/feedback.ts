import {
  displayToMicro,
  FEEDBACK_COMMENT_MAX_CHARS,
  FEEDBACK_COMMENT_MIN_CHARS,
  FEEDBACK_COMMENT_REWARD,
  FEEDBACK_RATING_REWARD,
  microToDisplay,
} from '@muicv/shared';

import { credit, ensureBalance, type WalletEnv } from './wallet.ts';

/**
 * 消息反馈的业务逻辑：把 messageFeedback 表写入和 tokenLedger 入账串到一起。
 *
 * 设计要点：
 *   - rating 用 INSERT … ON CONFLICT(userId, messageId) WHERE kind='rating' DO UPDATE
 *     一条语句处理「首次评分 / 切换 praise↔dislike」，RETURNING `awarded` 区分两种情况
 *     （首次返回 0，切换返回首次写入的金额）。
 *   - 只在「真新建」时调 wallet.credit() 发奖；切换走 UPDATE，不再发奖。
 *   - credit() 用 messageFeedback.id 作 ledgerId 实现幂等：网络重试 / 重放都不会重复入账。
 *   - comment 不去重，每次都 INSERT；text 长度（unicode code points）≥ FEEDBACK_COMMENT_MIN_CHARS
 *     才走奖励路径。
 *
 * 单位约定：所有 award*Micro / balanceMicro 都是 μtoken；router 层统一用 microToDisplay 转给客户端。
 */

export type RatingKind = 'praise' | 'dislike';

export type FeedbackEnv = WalletEnv;

export type RateMessageArgs = {
  messageId: string;
  conversationId: string;
  rating: RatingKind;
};

export type RateResult = {
  feedbackId: string;
  rating: RatingKind;
  /** 这次新增的 μtoken。首次评分 = REWARD * TOKEN_PRECISION；切换 = 0。 */
  awardedMicro: number;
  /** 这条消息此前是否已经领过奖励（决定 UI 是否飘字 / 文案）。 */
  alreadyRewarded: boolean;
  balanceMicro: number;
};

const RATING_REWARD_MICRO = displayToMicro(FEEDBACK_RATING_REWARD);
const COMMENT_REWARD_MICRO = displayToMicro(FEEDBACK_COMMENT_REWARD);

/** 计算 unicode code point 数（Array.from 会按 code point 切，比 .length 准）。 */
export function countCodePoints(text: string): number {
  return Array.from(text).length;
}

/**
 * 给一条消息打分（praise / dislike）。同 user × messageId 唯一；
 * 切换 praise ↔ dislike 仅 UPDATE，不再发奖。
 */
export async function rateMessage(env: FeedbackEnv, userId: string, args: RateMessageArgs): Promise<RateResult> {
  // 确保钱包行存在（第一次反馈也是触发 signup_bonus 的入口之一）
  await ensureBalance(env, userId);

  const now = Date.now();
  const id = crypto.randomUUID();

  // INSERT … ON CONFLICT(userId, messageId) WHERE kind='rating' DO UPDATE
  // - 首次：插入新行，awarded=RATING_REWARD_MICRO，RETURNING 拿到这一行 id 和 awarded
  // - 切换：UPDATE rating + updatedAt，awarded 保留首次值，RETURNING 拿到原 id 和 awarded
  // 关键：用 RETURNING `id` 区分新插和命中已有行（新插的 id == 我们传入的 id；切换时 id != 传入）。
  const row = await env.MUICV_API_DB.prepare(
    `INSERT INTO messageFeedback (id, userId, messageId, conversationId, kind, rating, text, awarded, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'rating', ?, NULL, ?, ?, ?)
     ON CONFLICT(userId, messageId) WHERE kind='rating' DO UPDATE SET
       rating = excluded.rating,
       updatedAt = excluded.updatedAt
     RETURNING id, awarded`,
  )
    .bind(id, userId, args.messageId, args.conversationId, args.rating, RATING_REWARD_MICRO, now, now)
    .first<{ id: string; awarded: number }>();

  if (!row) {
    // 理论不会到这一步（INSERT … ON CONFLICT 总会 RETURNING 一行）
    throw new Error('rate-feedback-failed');
  }

  const isFirstTime = row.id === id;

  if (!isFirstTime) {
    // 切换 rating：不再发奖，直接读余额返回
    const balance = await readBalanceMicro(env, userId);
    return {
      feedbackId: row.id,
      rating: args.rating,
      awardedMicro: 0,
      alreadyRewarded: row.awarded > 0,
      balanceMicro: balance,
    };
  }

  // 首次评分：调 credit 发奖。ledgerId = feedbackId 实现幂等
  const result = await credit(
    env,
    userId,
    RATING_REWARD_MICRO,
    'feedback_reward',
    {
      feedbackId: id,
      messageId: args.messageId,
      conversationId: args.conversationId,
      kind: 'rating',
      rating: args.rating,
    },
    id,
  );

  return {
    feedbackId: id,
    rating: args.rating,
    awardedMicro: result.deduped ? 0 : RATING_REWARD_MICRO,
    alreadyRewarded: result.deduped,
    balanceMicro: result.balance,
  };
}

export type CommentMessageArgs = {
  messageId: string;
  conversationId: string;
  text: string;
};

export type CommentResult = {
  feedbackId: string;
  charCount: number;
  /** 这次新增的 μtoken。≥50 字 = COMMENT_REWARD_MICRO，否则 0。 */
  awardedMicro: number;
  balanceMicro: number;
};

/**
 * 给一条消息留评论。不限次数；text 长度 ≥ FEEDBACK_COMMENT_MIN_CHARS 才发奖。
 *
 * 调用方需在 router 层先校验 text 非空、≤ FEEDBACK_COMMENT_MAX_CHARS。
 */
export async function commentMessage(
  env: FeedbackEnv,
  userId: string,
  args: CommentMessageArgs,
): Promise<CommentResult> {
  await ensureBalance(env, userId);

  const trimmed = args.text.trim();
  const charCount = countCodePoints(trimmed);
  const eligible = charCount >= FEEDBACK_COMMENT_MIN_CHARS;
  const awardedMicro = eligible ? COMMENT_REWARD_MICRO : 0;

  const now = Date.now();
  const id = crypto.randomUUID();

  await env.MUICV_API_DB.prepare(
    `INSERT INTO messageFeedback (id, userId, messageId, conversationId, kind, rating, text, awarded, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'comment', NULL, ?, ?, ?, ?)`,
  )
    .bind(id, userId, args.messageId, args.conversationId, trimmed, awardedMicro, now, now)
    .run();

  if (!eligible) {
    const balance = await readBalanceMicro(env, userId);
    return {
      feedbackId: id,
      charCount,
      awardedMicro: 0,
      balanceMicro: balance,
    };
  }

  const result = await credit(
    env,
    userId,
    COMMENT_REWARD_MICRO,
    'feedback_reward',
    {
      feedbackId: id,
      messageId: args.messageId,
      conversationId: args.conversationId,
      kind: 'comment',
      charCount,
    },
    id,
  );

  return {
    feedbackId: id,
    charCount,
    awardedMicro: result.deduped ? 0 : COMMENT_REWARD_MICRO,
    balanceMicro: result.balance,
  };
}

async function readBalanceMicro(env: FeedbackEnv, userId: string): Promise<number> {
  const row = await env.MUICV_API_DB.prepare('SELECT balance FROM tokenBalance WHERE userId = ? LIMIT 1')
    .bind(userId)
    .first<{ balance: number }>();
  return row?.balance ?? 0;
}

/** Router 层共用：把 μ 单位的结果转成显示 token 给客户端。 */
export function rateResultToWire(r: RateResult): {
  feedbackId: string;
  rating: RatingKind;
  awarded: number;
  alreadyRewarded: boolean;
  balance: number;
} {
  return {
    feedbackId: r.feedbackId,
    rating: r.rating,
    awarded: microToDisplay(r.awardedMicro),
    alreadyRewarded: r.alreadyRewarded,
    balance: microToDisplay(r.balanceMicro),
  };
}

export function commentResultToWire(r: CommentResult): {
  feedbackId: string;
  charCount: number;
  awarded: number;
  balance: number;
  minChars: number;
  maxChars: number;
} {
  return {
    feedbackId: r.feedbackId,
    charCount: r.charCount,
    awarded: microToDisplay(r.awardedMicro),
    balance: microToDisplay(r.balanceMicro),
    minChars: FEEDBACK_COMMENT_MIN_CHARS,
    maxChars: FEEDBACK_COMMENT_MAX_CHARS,
  };
}
