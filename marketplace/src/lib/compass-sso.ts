import { createHmac } from "node:crypto";

type MarketplaceSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  };
};

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function createCompassSsoToken(session: MarketplaceSession) {
  const email = session.user?.email?.trim().toLowerCase();
  const secret = process.env.COMPASS_SSO_SECRET;
  if (!email || !secret) throw new Error("Compass SSO is not configured.");

  const payload = base64Url(JSON.stringify({
    sub: session.user?.id || email,
    email,
    name: session.user?.name || email.split("@", 1)[0],
    role: session.user?.role || "user",
    exp: Math.floor(Date.now() / 1000) + 60,
  }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
