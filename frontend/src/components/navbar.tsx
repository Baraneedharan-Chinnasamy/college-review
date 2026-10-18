"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/feedback";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
      <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path d="M22 10 12 5 2 10l10 5 10-5Z" strokeLinejoin="round" />
          <path d="M6 12v5c3 2 9 2 12 0v-5" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        College<span className="text-indigo-600">Review</span>
      </span>
    </Link>
  );
}

/** Static header shown in the prerendered shell until the interactive navbar streams in. */
export function NavbarFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
      </div>
    </header>
  );
}

export function Navbar() {
  const { user, loading, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !menuRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const links = [
    { href: "/colleges", label: "Colleges", show: true },
    { href: "/my-reviews", label: "My reviews", show: Boolean(user) },
    { href: "/admin", label: "Manage", show: hasRole("admin", "teacher") },
  ].filter((link) => link.show);

  async function handleLogout() {
    await logout();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith(link.href)
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <span className="grid size-8 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  {initials(user.name)}
                </span>
                <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
              </button>
              {open && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200"
                >
                  <div className="border-b border-slate-100 px-3 pt-1 pb-3">
                    <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <div className="mt-2">
                      <Badge
                        tone={
                          user.role === "admin"
                            ? "rose"
                            : user.role === "teacher"
                              ? "indigo"
                              : "emerald"
                        }
                      >
                        {user.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="pt-2 sm:hidden">
                    {links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/colleges" className={buttonClasses("ghost", "sm", "sm:hidden")}>
                Colleges
              </Link>
              <Link href="/login" className={buttonClasses("ghost", "sm")}>
                Sign in
              </Link>
              <Link href="/register" className={buttonClasses("primary", "sm")}>
                Join
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
