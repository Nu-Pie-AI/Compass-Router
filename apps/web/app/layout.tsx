import "./globals.css";

export const metadata = {
  title: "Compass AI Router",
  description: "OpenAI-compatible chat routing with BYOK access, workspace model controls, usage records, and INR wallet billing."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
