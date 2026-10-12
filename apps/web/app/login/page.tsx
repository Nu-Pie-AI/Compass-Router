import ClerkLoginForm from "./ClerkLoginForm";

import LegacyLoginPage from "./LegacyLoginPage";
import { legacyAuthMode } from "../../lib/server-config";

function ClerkLogin() {
  return <ClerkLoginForm />;
}

export default function LoginPage() {
  return legacyAuthMode ? <LegacyLoginPage /> : <ClerkLogin />;
}
