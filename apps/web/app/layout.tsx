import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ClerkSessionBridge from "../components/ClerkSessionBridge";
import { clerkPublishableKey } from "../lib/server-config";

export const metadata = {
  title: "Compass AI Router",
  description: "OpenAI-compatible chat routing with BYOK access, workspace model controls, usage records, and INR wallet billing."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkKey = clerkPublishableKey;
  return (
    <html lang="en">
      <body>{clerkKey ? <ClerkProvider publishableKey={clerkKey}><ClerkSessionBridge />{children}</ClerkProvider> : children}</body>
    </html>
  );
}
