import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const clickSchema = z.object({
  clickType: z.enum(["website", "contact", "review", "partner_website", "partner_linkedin"]).default("website"),
});

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
    const body = await req.json().catch(() => ({}));
    const { clickType } = clickSchema.parse(body);

    const offering = await prisma.offering.findFirst({
      where: { slug, status: "published" },
      select: { id: true },
    });

    if (!offering) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const clickData = {
      id: randomUUID(),
      offeringId: offering.id,
      userId: session?.user?.id || null,
      sessionId: req.headers.get("x-session-id") || null,
      clickType,
      ipAddress: getRequestIp(req),
      userAgent: req.headers.get("user-agent") || "",
      referrer: req.headers.get("referer") || "",
    };

    try {
      await prisma.$executeRaw`
        INSERT INTO "offering_clicks"
          ("id", "offeringId", "userId", "sessionId", "clickType", "ipAddress", "userAgent", "referrer")
        VALUES
          (${clickData.id}, ${clickData.offeringId}, ${clickData.userId}, ${clickData.sessionId}, ${clickData.clickType}, ${clickData.ipAddress}, ${clickData.userAgent}, ${clickData.referrer})
      `;
    } catch {
      await prisma.offeringClick.create({
        data: {
          offeringId: clickData.offeringId,
          userId: clickData.userId || undefined,
          sessionId: clickData.sessionId || undefined,
          ipAddress: clickData.ipAddress,
          userAgent: clickData.userAgent,
          referrer: clickData.referrer,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Offering click tracking error:", error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
