-- Token 内部存储单位由「显示 token」升级到「μtoken」（1 显示 token = 10_000 μtoken）。
-- 动机：新计费表（pricing.ts: LLM_PRICING）按 model 拆 prompt/completion 分价，最便宜的
-- mimo-v2.5 输入 0.008 显示 token / 上游 token，整数 ceil 会让小请求被多扣 100×+。
--
-- 改动只在数值层面：列类型保持 INTEGER（SQLite 是 64-bit），名字不变；存量数据直接 ×1e4
-- 即可。新代码同时上线（charge / credit 入参改为 μ，/me 出口 microToDisplay 还原），所以
-- 这一刻完成迁移就语义自洽。
--
-- subscription.monthlyTokens 不动——它是「每个 cycle 续多少显示 token」的元数据展示用，
-- 真正入账的钱还是经 credit() 转 μ 后写入 tokenBalance。

UPDATE tokenBalance
   SET balance = balance * 10000,
       lifetimeEarned = lifetimeEarned * 10000,
       lifetimeSpent = lifetimeSpent * 10000;

UPDATE tokenLedger
   SET delta = delta * 10000;
