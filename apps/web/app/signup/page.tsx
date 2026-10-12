import { SignUp } from "@clerk/nextjs";
import { Compass } from "lucide-react";

import LegacySignupPage from "./LegacySignupPage";
import { legacyAuthMode } from "../../lib/server-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ClerkSignup() {
  return <main className="console-login"><section className="clerk-login-layout" aria-labelledby="signup-title"><div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div><div className="console-login-copy"><span>NEW CUSTOMER</span><h1 id="signup-title">Create your workspace</h1><p>Verify your email with Clerk to create a Compass account.</p></div><SignUp routing="hash" signInUrl="/login" fallbackRedirectUrl="/portal" appearance={{ elements: { rootBox: "compass-clerk-root", card: "compass-clerk-card" } }} /></section></main>;
}

export default function SignupPage() {
  return legacyAuthMode ? <LegacySignupPage /> : <ClerkSignup />;
}
