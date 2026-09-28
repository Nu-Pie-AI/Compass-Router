import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-4 font-medium text-[var(--foreground)]">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/browse"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Browse Solutions
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Categories
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-medium text-[var(--foreground)]">For Partners</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/partners"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  List Your Product
                </Link>
              </li>
              <li>
                <Link
                  href="/partners/register"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Become a Partner
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Resources
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-medium text-[var(--foreground)]">Company</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-medium text-[var(--foreground)]">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-of-service"
                  className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-[var(--border)] pt-8">
          <p className="text-center text-sm text-[var(--muted-foreground)]">
            {"\u00A9"} {currentYear} Compass. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
