import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import Providers from "./providers"
import { ThemedToaster } from "@/components/ui/ThemedToaster"

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Compass - Navigate Your Business to the Right Solution",
    template: "%s | Compass",
  },
  description:
    "Compass is your intelligent solution marketplace for SMBs. Discover, compare, and choose the perfect tools for your business with AI-powered recommendations and expert insights.",
  icons: {
    icon: "/nu-pie-logo.png",
    shortcut: "/nu-pie-logo.png",
    apple: "/nu-pie-logo.png",
  },
  keywords: [
    "solution marketplace",
    "SMB solutions",
    "business tools",
    "SaaS discovery",
    "solution comparison",
    "AI recommendations",
    "small business solutions",
    "productivity tools",
  ],
  authors: [{ name: "Compass" }],
  creator: "Compass",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Compass - Navigate Your Business to the Right Solution",
    description:
      "Your intelligent solution marketplace for SMBs. Discover, compare, and choose the perfect tools with AI-powered recommendations.",
    siteName: "Compass",
    images: [
      {
        url: "/nu-pie-logo.png",
        width: 1200,
        height: 630,
        alt: "Nu-Pie Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Compass - Navigate Your Business to the Right Solution",
    description:
      "Your intelligent solution marketplace for SMBs. Discover the perfect tools with AI-powered recommendations.",
    creator: "@compass",
    images: ["/nu-pie-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${inter.variable} antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          <ThemedToaster />
        </Providers>
      </body>
    </html>
  );
}
