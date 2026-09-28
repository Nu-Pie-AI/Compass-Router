import Link from "next/link";
import {
  Users,
  FolderKanban,
  Mail,
  BarChart3,
  MessageSquare,
  UserCheck,
  ShoppingCart,
  Shield,
  FileText,
  Zap,
  Settings,
  Globe,
} from "lucide-react";

interface CategoryCardProps {
  slug: string;
  name: string;
  icon?: string;
  productCount: number;
  description?: string;
}

// Map category slugs to icons
const getCategoryIcon = (slug: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    crm: <Users className="w-8 h-8" />,
    "project-management": <FolderKanban className="w-8 h-8" />,
    marketing: <Mail className="w-8 h-8" />,
    analytics: <BarChart3 className="w-8 h-8" />,
    communication: <MessageSquare className="w-8 h-8" />,
    "human-resources": <UserCheck className="w-8 h-8" />,
    "e-commerce": <ShoppingCart className="w-8 h-8" />,
    security: <Shield className="w-8 h-8" />,
    documentation: <FileText className="w-8 h-8" />,
    automation: <Zap className="w-8 h-8" />,
    operations: <Settings className="w-8 h-8" />,
    website: <Globe className="w-8 h-8" />,
  };

  return iconMap[slug] || <FolderKanban className="w-8 h-8" />;
};

export function CategoryCard({
  slug,
  name,
  icon,
  productCount,
  description,
}: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${slug}`}
      className="group glass-panel rounded-xl p-6 hover:shadow-ambient transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 block"
    >
      {/* Icon */}
      <div className="mb-4 text-[var(--primary)] group-hover:text-[var(--secondary)] transition-colors">
        {getCategoryIcon(slug)}
      </div>

      {/* Category Name */}
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2 group-hover:text-[var(--primary)] transition-colors">
        {name}
      </h3>

      {/* Solution Count */}
      <p className="text-sm text-[var(--muted-foreground)] mb-2">
        {productCount} {productCount === 1 ? "solution" : "solutions"}
      </p>

      {/* Description */}
      {description && (
        <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
          {description}
        </p>
      )}
    </Link>
  );
}
