"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { toastSuccess, toastError } from "@/lib/toast-helpers";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  company: z.string().optional(),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message must not exceed 1000 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send message");
      }

      toastSuccess(
        "Message sent successfully!",
        "We'll get back to you within 24 hours."
      );
      reset();
    } catch (error) {
      console.error("Error sending contact form:", error);
      toastError(
        "Failed to send message",
        error instanceof Error ? error.message : "Please try again later."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name Field */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium mb-2 text-[var(--foreground)]"
        >
          Name <span className="text-[var(--error)]">*</span>
        </label>
        <input
          id="name"
          type="text"
          {...register("name")}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-[var(--surface)] text-[var(--foreground)]"
          placeholder="John Doe"
        />
        {errors.name && (
          <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Email Field */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium mb-2 text-[var(--foreground)]"
        >
          Email <span className="text-[var(--error)]">*</span>
        </label>
        <input
          id="email"
          type="email"
          {...register("email")}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-[var(--surface)] text-[var(--foreground)]"
          placeholder="john@example.com"
        />
        {errors.email && (
          <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
        )}
      </div>

      {/* Company Field (Optional) */}
      <div>
        <label
          htmlFor="company"
          className="block text-sm font-medium mb-2 text-[var(--foreground)]"
        >
          Company <span className="text-[var(--muted-foreground)]">(Optional)</span>
        </label>
        <input
          id="company"
          type="text"
          {...register("company")}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-[var(--surface)] text-[var(--foreground)]"
          placeholder="Acme Inc."
        />
      </div>

      {/* Message Field */}
      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium mb-2 text-[var(--foreground)]"
        >
          Message <span className="text-[var(--error)]">*</span>
        </label>
        <textarea
          id="message"
          {...register("message")}
          rows={6}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-[var(--surface)] text-[var(--foreground)] min-h-[150px]"
          placeholder="Tell us how we can help..."
        />
        {errors.message && (
          <p className="text-red-600 text-sm mt-1">{errors.message.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
