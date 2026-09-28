import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!partner) {
      return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "25", 10), 1), 100);
    const skip = (page - 1) * limit;

    const where = {
      partnerId: partner.id,
      ...(status && status !== "all" ? { status } : {}),
    };

    const [leads, total] = await Promise.all([
      prisma.partnerContact.findMany({
        where,
        include: {
          offering: { select: { id: true, slug: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.partnerContact.count({ where }),
    ]);

    return NextResponse.json({
      data: leads,
      meta: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Partner leads fetch error:", error);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
}
