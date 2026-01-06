/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    MUICV_DB?: D1Database;
    MUICV_KV?: KVNamespace;
    NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
    NEXT_INC_CACHE_R2_PREFIX?: string;
    OPENAI_API_KEY?: string;
    GOOGLE_API_KEY?: string;
    MUICV_AI_PROVIDER?: string;
    MUICV_OPENAI_MODEL?: string;
    MUICV_GEMINI_MODEL?: string;
    MUICV_RESUME_SNAPSHOT_LIMIT?: string;
  }
}

export {};
