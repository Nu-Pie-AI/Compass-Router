import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { createBackupCodes, encryptTotpSecret } from "@/lib/two-factor";
import { authenticator } from "otplib";

export const runtime = "nodejs";

const schema = z.object({
  method: z.enum(["EMAIL", "TOTP", "BOTH"]),
  secret: z.string().optional(),
  code: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = schema.parse(await req.json());

    if ((body.method === "TOTP" || body.method === "BOTH")) {
      if (!body.secret || !body.code || !authenticator.verify({ token: body.code, secret: body.secret })) {
        return NextResponse.json({ error: "Invalid authenticator code" }, { status: 400 });
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorMethod: body.method,
        totpSecretEncrypted: body.secret ? encryptTotpSecret(body.secret) : undefined,
      },
    });

    const backupCodes = await createBackupCodes(session.user.id);

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication enabled",
      backupCodes,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    console.error("Enable 2FA error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
