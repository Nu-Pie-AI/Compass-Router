import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { createTotpQrCode, createTotpSecret } from "@/lib/two-factor";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const setup = createTotpSecret(user.email);
  const qrCode = await createTotpQrCode(setup.otpauth);

  return NextResponse.json({
    secret: setup.secret,
    otpauth: setup.otpauth,
    qrCode,
  });
}
