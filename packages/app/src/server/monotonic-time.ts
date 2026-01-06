type GlobalWithMonotonicTime = typeof globalThis & {
  __muicvLastTimestampMs?: number;
};

const globalWithMonotonicTime = globalThis as GlobalWithMonotonicTime;

export function createMonotonicIsoTimestamp() {
  const now = Date.now();
  const last = globalWithMonotonicTime.__muicvLastTimestampMs ?? 0;
  const next = now <= last ? last + 1 : now;
  globalWithMonotonicTime.__muicvLastTimestampMs = next;
  return new Date(next).toISOString();
}
