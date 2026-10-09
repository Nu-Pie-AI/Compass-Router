import { SignIn } from "@clerk/nextjs";
import { Compass } from "lucide-react";

import LegacyAdminLogin from "./LegacyAdminLogin";
import { legacyAuthMode } from "../../lib/server-config";

function ClerkAdminLogin() {
  return <main className="console-login"><section className="console-login-panel" aria-labelledby="admin-login-title"><div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div><div className="console-login-copy"><span>ROUTER ADMINISTRATION</span><h1 id="admin-login-title">Administrator sign in</h1><p>Authenticate with the configured Clerk staging instance.</p></div><SignIn routing="hash" signUpUrl="/signup" fallbackRedirectUrl="/admin" /></section></main>;
}

export default function AdminLoginPage() {
  return legacyAuthMode ? <LegacyAdminLogin /> : <ClerkAdminLogin />;
}
