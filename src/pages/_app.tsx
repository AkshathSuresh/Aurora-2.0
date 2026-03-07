// src/pages/_app.tsx
import "../styles/globals.css";
import type { AppProps } from "next/app";
import React from "react";
import Head from "next/head";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SessionProvider } from "next-auth/react";
import { Inter } from "next/font/google";

/**
 * Supabase client (shared)
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Optimized Inter font loading (Next.js built-in font optimization)
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  display: "swap",
});

/**
 * Provide both Supabase client and NextAuth session to the app.
 * Keeps your existing Supabase usage (useSupabase hook) while enabling NextAuth.
 */
export const SupabaseContext = React.createContext<SupabaseClient>(supabaseClient);
export function useSupabase() {
  return React.useContext(SupabaseContext);
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SupabaseContext.Provider value={supabaseClient}>
      <SessionProvider session={session}>
        <Head>
          <meta name="viewport" content="width=device-width,initial-scale=1" />
        </Head>

        <div className={inter.className}>
          <Component {...pageProps} />
        </div>
      </SessionProvider>
    </SupabaseContext.Provider>
  );
}
