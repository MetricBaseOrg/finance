import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { db } from "@/server/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

const adapter = {
  ...PrismaAdapter(db),
  // PrismaAdapter uses delete() which throws P2025 if the session is already gone.
  // deleteMany() silently no-ops on missing records, fixing the double-signout error.
  async deleteSession(sessionToken: string) {
    await db.session.deleteMany({ where: { sessionToken } });
  },
};

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter,
  session: { strategy: "database" },
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/verify-request",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM ?? "onboarding@resend.dev",
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
