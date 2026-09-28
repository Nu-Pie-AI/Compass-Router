import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createCompassSsoToken } from "@/lib/compass-sso";

export const dynamic = "force-dynamic";

export default async function CompassRouterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/compass")}`);
  }

  const routerUrl = process.env.COMPASS_ROUTER_URL || "http://localhost:23100";
  const ssoToken = createCompassSsoToken(session);
  redirect(`${routerUrl}/auth/marketplace?token=${encodeURIComponent(ssoToken)}`);
}
