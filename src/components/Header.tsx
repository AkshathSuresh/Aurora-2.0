// src/components/Header.tsx
import Link from "next/link";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/router";

export default function Header() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const router = useRouter();

  const isAdminPage = router.pathname.startsWith("/admin");

  /* -----------------------------------------------
     ADMIN HEADER (clean UI for admin pages only)
  ------------------------------------------------- */
  if (isAdminPage) {
    return (
      <header className="header border-b bg-white">
        <div className="container flex items-center justify-between py-3 md:py-4 px-4">

          {/* LEFT — Logo + Title */}
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.svg"
                alt="Aurora Logo"
                width={60}
                height={60}
                className="rounded-md w-10 h-10 md:w-[60px] md:h-[60px]"
              />
            </Link>

            <div className="flex flex-col leading-tight">
              <Link href="/" className="text-lg md:text-xl font-extrabold text-[color:var(--brand)]">
                Aurora 2.0
              </Link>
              <span className="text-[10px] md:text-xs text-slate-400 hidden sm:inline">
                Nature & Photography Club
              </span>
            </div>
          </div>

          {/* RIGHT — Slim Admin Options */}
          <nav className="flex items-center gap-2 md:gap-4">

            <Link
              href="/tags"
              className="text-xs md:text-sm text-slate-600 hover:text-[color:var(--brand)]"
            >
              Tags
            </Link>

            {!loading && session && (
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="px-2 md:px-4 py-1.5 md:py-2 rounded-md bg-red-50 text-red-600 text-xs md:text-sm hover:bg-red-100"
              >
                LogOut
              </button>
            )}
          </nav>
        </div>
      </header>
    );
  }

  /* -----------------------------------------------
     PUBLIC HEADER (normal pages)
  ------------------------------------------------- */
  return (
      <header className="header border-b bg-white">
        <div className="container flex items-center justify-between py-3 md:py-4 px-4">

          {/* LEFT — Logo + Title */}
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.svg"
                alt="Aurora Logo"
                width={60}
                height={60}
                className="rounded-md w-10 h-10 md:w-[60px] md:h-[60px]"
              />
            </Link>

            <div className="flex flex-col leading-tight">
              <Link href="/" className="text-xl md:text-2xl font-extrabold text-[color:var(--brand)]">
                Aurora 2.0
              </Link>
              <span className="text-[10px] md:text-xs text-slate-400 hidden sm:inline">
                Nature & Photography Club
              </span>
            </div>
          </div>

          {/* RIGHT — Public Navigation */}
          <nav className="flex items-center gap-2 md:gap-4">
            <Link href="/tags" className="text-xs md:text-sm text-slate-600 hover:text-[color:var(--brand)]">
              Tags
            </Link>

            {/* Show Admin link only if logged in */}
            {!loading && session && (
              <Link
                href="/admin"
                className="text-xs md:text-sm font-medium text-emerald-600 hover:underline hidden sm:inline"
              >
                Admin
              </Link>
            )}

            {/* Login / Logout */}
            {!loading && (
              <>
                {!session ? (
                  <button
                    onClick={() => signIn("google", { callbackUrl: "/admin" })}
                    className="btn btn-primary text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2"
                  >
                    Login
                  </button>
                ) : (
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="px-2 md:px-4 py-1.5 md:py-2 rounded-md bg-red-50 text-red-600 text-xs md:text-sm hover:bg-red-100"
                  >
                    LogOut
                  </button>
                )}
              </>
            )}
          </nav>
        </div>
      </header>
  );
}
