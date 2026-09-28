import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

function getRequestIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);

    const offering = await prisma.offering.findFirst({
      where: { slug, status: "published" },
      select: { id: true },
    });

    if (!offering) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    await prisma.$transaction([
      prisma.offeringView.create({
        data: {
          offeringId: offering.id,
          userId: session?.user?.id,
          sessionId: req.headers.get("x-session-id") || undefined,
          ipAddress: getRequestIp(req),
          userAgent: req.headers.get("user-agent") || "",
          referrer: req.headers.get("referer") || "",
        },
      }),
      prisma.offering.update({
        where: { id: offering.id },
        data: { viewCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Offering view tracking error:", error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
