import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(1500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const limited = rateLimit(req, "offering-contact", { limit: 5, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const { slug } = await params;
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const data = contactSchema.parse(body);

    const offering = await prisma.offering.findFirst({
      where: { slug, status: "published" },
      select: {
        id: true,
        title: true,
        partnerId: true,
        partner: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json({ error: "Offering not found" }, { status: 404 });
    }

    const contact = await prisma.$transaction(async (tx) => {
      const created = await tx.partnerContact.create({
        data: {
          name: data.name,
          email: data.email,
          company: data.company || null,
          phone: data.phone || null,
          message: data.message,
          offeringId: offering.id,
          partnerId: offering.partnerId,
          userId: session?.user?.id,
        },
      });

      await tx.partner.update({
        where: { id: offering.partnerId },
        data: { totalLeads: { increment: 1 } },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        contactId: contact.id,
        message: `Your message has been sent to ${offering.partner.companyName || "the partner"}.`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Offering contact error:", error);
    return NextResponse.json(
      { error: "Failed to send contact request" },
      { status: 500 }
    );
  }
}
