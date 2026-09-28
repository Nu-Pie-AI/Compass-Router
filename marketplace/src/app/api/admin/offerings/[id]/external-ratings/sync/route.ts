import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enrichOfferingExternalRatings } from "@/lib/external-ratings";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "true";

    const result = await enrichOfferingExternalRatings(id, { dryRun });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("External ratings sync error:", error);
    return NextResponse.json({ error: "Failed to sync external ratings" }, { status: 500 });
  }
}
