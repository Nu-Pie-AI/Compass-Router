import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "accent" | "neutral" | "outline" | "success";
  className?: string;
}

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const variants = {
    primary: "bg-[var(--primary)] text-white",
    secondary: "bg-[var(--secondary)] text-white",
    accent: "bg-[var(--accent)] text-[var(--foreground)]",
    neutral: "bg-[var(--background)] text-[var(--muted-foreground)]",
    outline: "border border-[var(--border)] text-[var(--muted-foreground)] bg-transparent",
    success: "bg-[var(--accent-green)]/20 text-[var(--accent-green)] border border-[var(--accent-green)]/30"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
