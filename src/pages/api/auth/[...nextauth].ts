import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const adminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);
const allowAll = adminEmails.length === 0;

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  // Fail fast to avoid confusing OAuth errors at runtime
  throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET must be set for Google auth.");
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET must be set for NextAuth.");
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      // allow only admin emails (unless list is empty, then allow all for dev/testing)
      if (allowAll) return true;
      if (user?.email && adminEmails.includes(user.email.toLowerCase())) return true;
      // send AccessDenied so /signin can show a clear message
      return "/signin?error=AccessDenied";
    },
    async session({ session }) {
      return session;
    },
  },

  pages: {
    signIn: "/signin",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
