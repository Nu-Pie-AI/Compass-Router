"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Compass as CompassIcon, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type UserRole = "admin" | "partner" | null;

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const normalizedUserRole: UserRole =
    userRole === "admin" || userRole === "partner" ? userRole : null;

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  // Role-based navigation for "Partner" link
  const getPartnersLink = () => {
    if (!session?.user) {
      // Not logged in → /partners landing page (will create this)
      return "/partners";
    }

    if (normalizedUserRole === "partner") {
      // Partner → /partners/dashboard
      return "/partners/dashboard";
    } else if (normalizedUserRole === "admin") {
      // Admin → /admin
      return "/admin";
    }

    // Default fallback
    return "/partners";
  };

  return (
    <>
    <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-50 backdrop-blur-sm">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/nu-pie-logo.png"
                alt="Nu-Pie Logo"
                width={34}
                height={34}
                className="object-contain"
              />
              <span className="text-lg font-bold text-[var(--foreground)]">
                Compass
              </span>
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            <nav className="hidden md:flex items-center gap-5" role="navigation" aria-label="Main navigation">
              <Link
                href="/browse"
                className={cn(
                  "text-sm font-medium transition-colors relative",
                  isActive("/browse")
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                )}
              >
                Browse
                {isActive("/browse") && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-[var(--primary)]" />
                )}
              </Link>
              <Link
                href="/categories"
                className={cn(
                  "text-sm font-medium transition-colors relative",
                  isActive("/categories")
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                )}
              >
                Categories
                {isActive("/categories") && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-[var(--primary)]" />
                )}
              </Link>
              <Link
                href="/ai-advisor-chat"
                className={cn(
                  "text-sm font-medium transition-colors relative",
                  isActive("/ai-advisor-chat")
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                )}
              >
                AI Advisor
                {isActive("/ai-advisor-chat") && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-[var(--primary)]" />
                )}
              </Link>
              <Link
                href="/compass"
                className={cn(
                  "text-sm font-medium transition-colors relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5",
                  isActive("/compass")
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white"
                )}
              >
                <CompassIcon className="h-4 w-4" aria-hidden="true" />
                Compass Router
                {isActive("/compass") && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-[var(--primary)]" />
                )}
              </Link>
              <Link
                href={getPartnersLink()}
                className={cn(
                  "text-sm font-medium transition-colors relative",
                  (isActive("/partners") || isActive("/admin/partners"))
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                )}
              >
                Partner
                {(isActive("/partners") || isActive("/admin/partners")) && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-[var(--primary)]" />
                )}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {session?.user ? (
              <>
                <Link
                  href="/account/security"
                  className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                >
                  Security
                </Link>
                <Link
                  href={
                    normalizedUserRole === "admin"
                      ? "/admin"
                      : normalizedUserRole === "partner"
                      ? "/partners/dashboard"
                      : "/"
                  }
                  className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    window.location.href = "/api/auth/signout";
                  }}
                  className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/partners"
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>

    {/* Mobile Navigation Drawer - Outside header for proper z-index stacking */}
    {mobileMenuOpen && (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-[60] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Drawer */}
        <div className="fixed inset-y-0 right-0 w-64 bg-[var(--surface)] shadow-xl z-[70] md:hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <span className="text-lg font-semibold text-[var(--foreground)]">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto py-4" role="navigation" aria-label="Mobile navigation">
              <Link
                href="/browse"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block px-4 py-3 text-base font-medium transition-colors",
                  isActive("/browse")
                    ? "text-[var(--primary)] bg-[var(--primary)]/10"
                    : "text-[var(--foreground)] hover:bg-[var(--surface)]"
                )}
                aria-current={isActive("/browse") ? "page" : undefined}
              >
                Browse
              </Link>

              <Link
                href="/categories"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block px-4 py-3 text-base font-medium transition-colors",
                  isActive("/categories")
                    ? "text-[var(--primary)] bg-[var(--primary)]/10"
                    : "text-[var(--foreground)] hover:bg-[var(--surface)]"
                )}
                aria-current={isActive("/categories") ? "page" : undefined}
              >
                Categories
              </Link>

              <Link
                href="/ai-advisor-chat"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block px-4 py-3 text-base font-medium transition-colors",
                  isActive("/ai-advisor-chat")
                    ? "text-[var(--primary)] bg-[var(--primary)]/10"
                    : "text-[var(--foreground)] hover:bg-[var(--surface)]"
                )}
                aria-current={isActive("/ai-advisor-chat") ? "page" : undefined}
              >
                AI Advisor
              </Link>

              <Link
                href="/compass"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block px-4 py-3 text-base font-medium transition-colors inline-flex items-center gap-2",
                  isActive("/compass")
                    ? "text-[var(--primary)] bg-[var(--primary)]/10"
                    : "text-[var(--foreground)] hover:bg-[var(--surface)]"
                )}
                aria-current={isActive("/compass") ? "page" : undefined}
              >
                <CompassIcon className="h-5 w-5" aria-hidden="true" />
                Compass Router
              </Link>

              <Link
                href={getPartnersLink()}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block px-4 py-3 text-base font-medium transition-colors",
                  (isActive("/partners") || isActive("/admin"))
                    ? "text-[var(--primary)] bg-[var(--primary)]/10"
                    : "text-[var(--foreground)] hover:bg-[var(--surface)]"
                )}
                aria-current={isActive("/partners") || isActive("/admin") ? "page" : undefined}
              >
                {!session?.user
                  ? "Partner"
                  : normalizedUserRole === "admin"
                  ? "Admin"
                  : "Dashboard"}
              </Link>
            </nav>

            {/* Footer Actions */}
            <div className="border-t border-[var(--border)] p-4">
              {!session?.user ? (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full px-4 py-2 mb-2 text-center text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] rounded-lg transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/partners"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full px-4 py-2 text-center text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors"
                  >
                    Get started
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/account/security"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full px-4 py-2 mb-2 text-center text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] rounded-lg transition-colors"
                  >
                    Account Security
                  </Link>
                  <Link
                    href={
                      normalizedUserRole === "admin"
                        ? "/admin"
                        : normalizedUserRole === "partner"
                        ? "/partners/dashboard"
                        : "/"
                    }
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full px-4 py-2 mb-2 text-center text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] rounded-lg transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      window.location.href = "/api/auth/signout";
                    }}
                    className="w-full px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors text-center"
                  >
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    )}
  </>
  );
}
