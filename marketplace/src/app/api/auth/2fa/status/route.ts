import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      twoFactorEnabled: true,
      twoFactorMethod: true,
      _count: { select: { twoFactorBackupCodes: { where: { usedAt: null } } } },
    },
  });

  return NextResponse.json({
    twoFactorEnabled: user?.twoFactorEnabled || false,
    twoFactorMethod: user?.twoFactorMethod || null,
    backupCodesRemaining: user?._count.twoFactorBackupCodes || 0,
  });
}
