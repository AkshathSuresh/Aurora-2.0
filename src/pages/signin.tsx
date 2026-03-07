// src/pages/signin.tsx
import { getProviders, signIn } from "next-auth/react";
import Layout from "@/components/Layout";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SignIn({ providers }: { providers: Record<string, any> }) {
  const router = useRouter();
  const { error } = router.query;
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    // map common NextAuth errors to friendly messages
    const map: Record<string, string> = {
      AccessDenied: "Sign-in blocked: your account is not authorised to access this site.",
      OAuthAccountNotLinked: "Please sign in with the same provider you used earlier.",
      Configuration: "Provider not configured correctly (check GOOGLE_CLIENT_ID/SECRET).",
      Defaults: "Sign-in failed. Check console/network for details.",
    };
    setInfo(map[String(error)] ?? `Sign-in error: ${String(error)}`);
  }, [error]);

  return (
    <Layout>
      <div className="max-w-md mx-auto py-24 px-6">
        <h1 className="text-3xl font-bold mb-4">Sign in to Aurora Admin</h1>

        {info && (
          <div className="mb-4 p-3 rounded bg-rose-50 text-rose-700">
            {info}
            <div className="mt-2 text-xs text-slate-500">
              If you think this is wrong, ensure the email you're using is included in <code>ADMIN_EMAILS</code> in <code>.env.local</code>.
            </div>
          </div>
        )}

        <div className="space-y-3">
          {providers &&
            Object.values(providers).map((provider: any) => (
              <div key={provider.name}>
                <button
                  onClick={() =>
                    signIn(provider.id, { callbackUrl: "/admin" })
                  }
                  className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700"
                >
                  Sign in with {provider.name}
                </button>
              </div>
            ))}
        </div>

        <div className="mt-6 text-sm text-slate-500">
          Troubleshooting tips:
          <ul className="list-disc ml-5 mt-2">
            <li>Make sure <code>NEXTAUTH_URL</code> and Google redirect URI are set to <code>http://localhost:3000</code>.</li>
            <li>If you whitelist admins via <code>ADMIN_EMAILS</code>, ensure your Google email is included (case-insensitive).</li>
            <li>Open DevTools → Network and watch <code>/api/auth/callback/google</code> and <code>/api/auth/session</code>.</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const providers = await getProviders();
  return { props: { providers } };
};
