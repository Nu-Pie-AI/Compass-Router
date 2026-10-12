import ClerkLoginForm from "./ClerkLoginForm";

import LegacyLoginPage from "./LegacyLoginPage";
import { legacyAuthMode } from "../../lib/server-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ClerkLogin() {
  return <ClerkLoginForm />;
}

export default function LoginPage() {
  return legacyAuthMode ? <LegacyLoginPage /> : <ClerkLogin />;
}
