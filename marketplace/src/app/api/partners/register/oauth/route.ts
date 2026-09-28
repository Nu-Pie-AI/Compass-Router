import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { notifyAdmin, sendSignupConfirmation } from "@/lib/email";

export const runtime = "nodejs";

const schema = z.object({
  companyName: z.string().trim().min(2, "Company name is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyName } = schema.parse(await req.json());

    const existingPartner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    });

    if (existingPartner) {
      return NextResponse.json({
        success: true,
        message: "Partner profile already exists.",
        partnerId: existingPartner.id,
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true, name: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (currentUser.role === "admin" || currentUser.role === "vendor") {
      return NextResponse.json(
        { error: "This account type cannot be converted to a partner account." },
        { status: 400 }
      );
    }

    const partner = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { role: "partner" },
      });

      return tx.partner.create({
        data: {
          userId: session.user.id,
          companyName,
          onboardingStatus: "NOT_STARTED",
          approvalStatus: "PENDING",
          status: "pending",
          regions: [],
          complianceFlags: [],
        },
      });
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    await Promise.all([
      sendSignupConfirmation(currentUser.email, currentUser.name),
      notifyAdmin(
        "New OAuth partner signup pending approval",
        `${companyName} (${currentUser.email}) completed partner signup using a social account.`,
        `${baseUrl}/admin/partners/approve`
      ),
    ]);

    return NextResponse.json({
      success: true,
      message: "Partner account created successfully. Awaiting admin approval.",
      partnerId: partner.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }

    console.error("OAuth partner registration error:", error);
    return NextResponse.json({ error: "Failed to complete partner registration" }, { status: 500 });
  }
}
