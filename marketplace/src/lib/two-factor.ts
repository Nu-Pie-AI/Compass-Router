import { authenticator } from "otplib";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import { decryptText, encryptText, hashSecret, verifySecret, createNumericCode } from "@/lib/security";
import { sendTwoFactorCodeEmail } from "@/lib/email";

type TwoFactorUser = {
  id: string;
  email: string;
  name?: string | null;
  twoFactorMethod?: "EMAIL" | "TOTP" | "BOTH" | null;
  totpSecretEncrypted?: string | null;
};

export function needsEmailOtp(user: TwoFactorUser) {
  return user.twoFactorMethod === "EMAIL" || user.twoFactorMethod === "BOTH" || !user.totpSecretEncrypted;
}

export async function createEmailTwoFactorChallenge(user: TwoFactorUser) {
  const code = createNumericCode();
  const codeHash = await hashSecret(code);

  const challenge = await prisma.twoFactorChallenge.create({
    data: {
      userId: user.id,
      codeHash,
      method: "EMAIL",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendTwoFactorCodeEmail(user.email, code, user.name);
  return challenge;
}

export async function createTotpTwoFactorChallenge(user: TwoFactorUser) {
  return prisma.twoFactorChallenge.create({
    data: {
      userId: user.id,
      codeHash: await hashSecret(createNumericCode()),
      method: "TOTP",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}

export async function verifyEmailTwoFactorChallenge(challengeId: string, code: string) {
  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { id: challengeId },
    include: { user: true },
  });

  if (!challenge || challenge.method !== "EMAIL" || challenge.consumedAt || challenge.expiresAt < new Date()) {
    return null;
  }

  if (challenge.attempts >= 5) {
    return null;
  }

  const valid = await verifySecret(code, challenge.codeHash);
  if (!valid) {
    await prisma.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  await prisma.twoFactorChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return challenge.user;
}

export async function verifyTotpChallengeBinding(challengeId: string, userId: string) {
  const challenge = await prisma.twoFactorChallenge.findFirst({
    where: {
      id: challengeId,
      userId,
      method: "TOTP",
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!challenge || challenge.attempts >= 5) {
    return null;
  }

  return challenge;
}

export async function recordTwoFactorChallengeFailure(challengeId: string) {
  await prisma.twoFactorChallenge.update({
    where: { id: challengeId },
    data: { attempts: { increment: 1 } },
  }).catch(() => null);
}

export async function consumeTwoFactorChallenge(challengeId: string) {
  await prisma.twoFactorChallenge.update({
    where: { id: challengeId },
    data: { consumedAt: new Date() },
  });
}

export function createTotpSecret(email: string) {
  const secret = authenticator.generateSecret();
  const service = "Compass";
  return {
    secret,
    otpauth: authenticator.keyuri(email, service, secret),
  };
}

export async function createTotpQrCode(otpauth: string) {
  return QRCode.toDataURL(otpauth);
}

export function encryptTotpSecret(secret: string) {
  return encryptText(secret);
}

export function verifyTotpCode(encryptedSecret: string, code: string) {
  const secret = decryptText(encryptedSecret);
  return authenticator.verify({ token: code, secret });
}

export async function createBackupCodes(userId: string) {
  const plainCodes = Array.from({ length: 8 }, () =>
    `${createNumericCode(4)}-${createNumericCode(4)}`
  );

  await prisma.twoFactorBackupCode.deleteMany({ where: { userId } });
  await prisma.twoFactorBackupCode.createMany({
    data: await Promise.all(
      plainCodes.map(async (code) => ({
        userId,
        codeHash: await hashSecret(code),
      }))
    ),
  });

  return plainCodes;
}

export async function verifyBackupCode(userId: string, code: string) {
  const candidates = await prisma.twoFactorBackupCode.findMany({
    where: { userId, usedAt: null },
  });

  for (const candidate of candidates) {
    if (await verifySecret(code, candidate.codeHash)) {
      await prisma.twoFactorBackupCode.update({
        where: { id: candidate.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }

  return false;
}
