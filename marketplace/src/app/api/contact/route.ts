import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  company: z.string().optional(),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message must not exceed 1000 characters"),
});

/**
 * POST /api/contact
 * Handle contact form submissions
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, "contact", { limit: 5, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await req.json();

    // Validate request body
    const validationResult = contactSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { name, email, company, message } = validationResult.data;

    // TODO: In production, integrate with email service (SendGrid, Resend, etc.)
    // TODO: Store in database for record-keeping
    // TODO: Add rate limiting to prevent spam

    // For now, log to console (MVP)
    console.log("📧 Contact Form Submission:");
    console.log("  Name:", name);
    console.log("  Email:", email);
    console.log("  Company:", company || "N/A");
    console.log("  Message:", message);
    console.log("  Timestamp:", new Date().toISOString());

    // Simulate email sending (in production, call email service here)
    // Example: await sendEmail({ to: 'support@compass.com', from: email, subject: '...', body: '...' })

    return NextResponse.json(
      {
        success: true,
        message: "Your message has been received. We'll get back to you soon!",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing contact form:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process your request. Please try again later.",
      },
      { status: 500 }
    );
  }
}
