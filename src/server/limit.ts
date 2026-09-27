const hits = new Map<string, number[]>();

/** In-process sliding window. Fine for one editor on one Node process. */
export function rateLimit(bucket: string, maxPerMinute = 8): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const recent = (hits.get(bucket) ?? []).filter((stamp) => stamp > windowStart);
  if (recent.length >= maxPerMinute) {
    hits.set(bucket, recent);
    return false;
  }
  recent.push(now);
  hits.set(bucket, recent);
  return true;
}

export function allowWrite(): boolean {
  return rateLimit("mutate", 40);
}
