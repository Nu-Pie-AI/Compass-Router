import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createCompassSsoToken } from "@/lib/compass-sso";
import { compassRouterUrl } from "@/lib/product-urls";

export const dynamic = "force-dynamic";

export default async function CompassRouterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/compass")}`);
  }

  const ssoToken = createCompassSsoToken(session);
  redirect(`${compassRouterUrl}/auth/marketplace?token=${encodeURIComponent(ssoToken)}`);
}
