import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorMethod: null,
        totpSecretEncrypted: null,
      },
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: session.user.id } }),
    prisma.twoFactorChallenge.deleteMany({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ success: true, message: "Two-factor authentication disabled" });
}
