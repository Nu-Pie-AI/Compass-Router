import crypto from "crypto";
import bcrypt from "bcryptjs";

const TOKEN_BYTES = 32;

export function createPublicToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createNumericCode(length = 6) {
  const max = 10 ** length;
  return crypto.randomInt(0, max).toString().padStart(length, "0");
}

export async function hashSecret(value: string) {
  return bcrypt.hash(value, 10);
}

export async function verifySecret(value: string, hash: string) {
  return bcrypt.compare(value, hash);
}

function encryptionKey() {
  const configured = process.env.AUTH_ENCRYPTION_KEY;
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
    return crypto.createHash("sha256").update(configured).digest();
  }

  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error("AUTH_ENCRYPTION_KEY or NEXTAUTH_SECRET must be configured");
  }

  return crypto.createHash("sha256").update(process.env.NEXTAUTH_SECRET).digest();
}

export function encryptText(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptText(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted payload");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
