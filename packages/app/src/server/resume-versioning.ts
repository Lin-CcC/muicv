import type { ResumeJson } from '@muicv/shared';

type JsonPrimitive = null | boolean | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

function isJsonRecord(value: JsonValue): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sortJsonKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }

  if (isJsonRecord(value)) {
    const sortedKeys = Object.keys(value).sort();
    const result: JsonRecord = {};
    for (const key of sortedKeys) {
      result[key] = sortJsonKeys(value[key]!);
    }
    return result;
  }

  return value;
}

function removeLastUpdatedAt(value: JsonValue): JsonValue {
  if (!isJsonRecord(value)) return value;

  const { lastUpdatedAt: _ignored, ...rest } = value;
  return rest;
}

function stableJsonStringify(value: JsonValue): string {
  return JSON.stringify(sortJsonKeys(value));
}

function normalizeResumeForCompare(resume: ResumeJson | null): string {
  if (!resume) return 'null';

  const json = JSON.parse(JSON.stringify(resume)) as JsonValue;
  const withoutUpdatedAt = removeLastUpdatedAt(json);
  return stableJsonStringify(withoutUpdatedAt);
}

export function isResumeMeaningfullyDifferent(a: ResumeJson | null, b: ResumeJson | null): boolean {
  return normalizeResumeForCompare(a) !== normalizeResumeForCompare(b);
}
