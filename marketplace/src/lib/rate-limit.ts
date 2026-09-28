import { NextRequest, NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(
  req: NextRequest,
  key: string,
  options: { limit: number; windowMs: number }
) {
  const now = Date.now();
  const bucketKey = `${key}:${getClientIp(req)}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  bucket.count++;
  if (bucket.count <= options.limit) {
    return null;
  }

  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": Math.ceil((bucket.resetAt - now) / 1000).toString(),
      },
    }
  );
}
