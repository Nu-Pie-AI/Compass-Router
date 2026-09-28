"use client";

import { useState } from "react";
import { offeringTemplates, OfferingTemplate } from "@/lib/offering-templates";
import { X, Sparkles } from "lucide-react";

interface TemplateSelectorProps {
  onSelectTemplate: (template: OfferingTemplate) => void;
  onClose: () => void;
}

export function TemplateSelector({ onSelectTemplate, onClose }: TemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { value: "all", label: "All Templates" },
    { value: "PRODUCT", label: "Products" },
    { value: "SERVICE", label: "Services" },
    { value: "IMPLEMENTATION", label: "Implementation" },
    { value: "TRAINING", label: "Training" },
    { value: "MANAGED_SERVICE", label: "Managed Services" },
  ];

  const filteredTemplates =
    selectedCategory === "all"
      ? offeringTemplates
      : offeringTemplates.filter((t) => t.category === selectedCategory);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Choose a Template</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Start with a pre-filled form for common offering types</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--background)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-6 pt-4 border-b border-[var(--border)]">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.value
                    ? "bg-blue-600 text-white"
                    : "bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--background)]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className="text-left p-4 border border-[var(--border)] rounded-lg hover:border-blue-500 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-3xl">{template.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--foreground)] group-hover:text-blue-600 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">{template.description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-[var(--background)] rounded text-[var(--muted-foreground)]">
                      {template.data.offeringType.replace(/_/g, " ")}
                    </span>
                    {template.data.pricingModel && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                        {template.data.pricingModel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
                    {template.data.shortDescription}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--background)]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""} available
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Start from scratch instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
