import { SignIn } from "@clerk/nextjs";
import { Compass } from "lucide-react";

import LegacyLoginPage from "./LegacyLoginPage";
import { legacyAuthMode } from "../../lib/server-config";

function ClerkLogin() {
  return <main className="console-login"><section className="console-login-panel" aria-labelledby="login-title"><div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div><div className="console-login-copy"><span>WORKSPACE ACCESS</span><h1 id="login-title">Welcome back</h1><p>Sign in securely with your Compass account.</p></div><SignIn routing="hash" signUpUrl="/signup" fallbackRedirectUrl="/dashboard" /></section></main>;
}

export default function LoginPage() {
  return legacyAuthMode ? <LegacyLoginPage /> : <ClerkLogin />;
}
