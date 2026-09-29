import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { notifyAdmin, sendSignupConfirmation } from "@/lib/email";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.parse(body);
    const email = parsed.email.trim().toLowerCase();
    const { password } = parsed;
    const name = parsed.name?.trim() || undefined;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "user",
      },
    });

    const notifications = await Promise.allSettled([
      sendSignupConfirmation(user.email, user.name),
      notifyAdmin(
        "New user signup",
        `${user.name || user.email} created a Compass account.`,
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin`
      ),
    ]);
    for (const notification of notifications) {
      if (notification.status === "rejected") {
        console.error("Signup notification failed:", notification.reason);
      }
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
