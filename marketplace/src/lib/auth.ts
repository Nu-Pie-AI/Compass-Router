import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import {
  consumeTwoFactorChallenge,
  createEmailTwoFactorChallenge,
  createTotpTwoFactorChallenge,
  needsEmailOtp,
  recordTwoFactorChallengeFailure,
  verifyBackupCode,
  verifyEmailTwoFactorChallenge,
  verifyTotpChallengeBinding,
  verifyTotpCode,
} from "@/lib/two-factor";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: process.env.AZURE_AD_TENANT_ID || "common",
            allowDangerousEmailAccountLinking: false,
            authorization: {
              params: {
                scope: "openid profile email",
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        challengeId: { label: "Challenge ID", type: "text" },
        twoFactorCode: { label: "Two-factor code", type: "text" },
        twoFactorMethod: { label: "Two-factor method", type: "text" },
        userId: { label: "User ID", type: "text" },
        backupCode: { label: "Backup code", type: "text" },
      },
      async authorize(credentials) {
        if (
          credentials?.challengeId &&
          credentials?.twoFactorCode &&
          credentials.twoFactorMethod === "EMAIL"
        ) {
          const user = await verifyEmailTwoFactorChallenge(
            credentials.challengeId,
            credentials.twoFactorCode
          );

          if (!user) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        }

        if (
          credentials?.challengeId &&
          credentials?.userId &&
          credentials.twoFactorMethod !== "EMAIL" &&
          (credentials?.twoFactorCode || credentials?.backupCode)
        ) {
          const challenge = await verifyTotpChallengeBinding(
            credentials.challengeId,
            credentials.userId
          );

          if (!challenge) return null;

          const user = await prisma.user.findUnique({ where: { id: credentials.userId } });
          if (!user || !user.twoFactorEnabled) return null;

          const validTotp =
            credentials.twoFactorCode && user.totpSecretEncrypted
              ? verifyTotpCode(user.totpSecretEncrypted, credentials.twoFactorCode)
              : false;
          const validBackup = credentials.backupCode
            ? await verifyBackupCode(user.id, credentials.backupCode)
            : false;

          if (!validTotp && !validBackup) {
            await recordTwoFactorChallengeFailure(challenge.id);
            return null;
          }

          await consumeTwoFactorChallenge(challenge.id);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        }

        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          return null;
        }

        if (user.twoFactorEnabled) {
          if (needsEmailOtp(user)) {
            const challenge = await createEmailTwoFactorChallenge(user);
            throw new Error(`TWO_FACTOR_REQUIRED:${challenge.id}:EMAIL:${user.id}`);
          }

          const challenge = await createTotpTwoFactorChallenge(user);
          throw new Error(`TWO_FACTOR_REQUIRED:${challenge.id}:TOTP:${user.id}`);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "credentials" && user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (dbUser?.twoFactorEnabled) {
          if (needsEmailOtp(dbUser)) {
            const challenge = await createEmailTwoFactorChallenge(dbUser);
            return `/two-factor/verify?challengeId=${challenge.id}&method=EMAIL&userId=${dbUser.id}`;
          }

          const challenge = await createTotpTwoFactorChallenge(dbUser);
          return `/two-factor/verify?challengeId=${challenge.id}&method=TOTP&userId=${dbUser.id}`;
        }
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      } else if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // After login, redirect based on user role
      // Check if URL contains callbackUrl parameter
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
