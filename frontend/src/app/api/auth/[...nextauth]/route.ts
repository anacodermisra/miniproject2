import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { BASE } from "@/lib/api";

const secret = process.env.NEXTAUTH_SECRET;
if (!secret && process.env.NODE_ENV !== "development") {
  throw new Error("NEXTAUTH_SECRET environment variable must be set in non-development environments.");
}

const handlerConfig = {
  secret,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        try {
          const res = await fetch(`${BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email_or_username: email, password }),
          });

          if (!res.ok) return null;

          const data = await res.json();

          return {
            id: String(data.user.id),
            email: data.user.email,
            name: data.user.display_name,
            token: data.access_token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.token = user.token;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.token = token.token;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

const { handlers, signIn, signOut, auth } = NextAuth(handlerConfig);

export const GET = handlers.GET;
export const POST = handlers.POST;
