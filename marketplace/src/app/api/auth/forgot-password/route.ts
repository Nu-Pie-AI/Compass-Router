import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createPublicToken, hashToken } from "@/lib/security";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, "forgot-password", { limit: 5, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const { email } = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email } });
    let emailResult: Awaited<ReturnType<typeof sendPasswordResetEmail>> | null = null;

    if (user) {
      const token = createPublicToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
      emailResult = await sendPasswordResetEmail(
        user.email,
        `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`,
        user.name
      );
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists for that email, a reset link has been sent.",
      ...(process.env.NODE_ENV !== "production"
        ? {
            debug: {
              userFound: Boolean(user),
              emailSent: emailResult?.sent ?? false,
              emailSkipped: emailResult?.skipped ?? false,
            },
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
