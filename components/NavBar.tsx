// Design Ref: §4.2 공통 틀 — 조회자에게는 [대시보드]만 보이고, 관리자에게는 모든 메뉴가 보인다.
import Link from "next/link";

import { logoutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/guard";

const ADMIN_LINKS = [
  { href: "/input", label: "입력" },
  { href: "/settings", label: "설정" },
  { href: "/infra", label: "인프라" },
  { href: "/history", label: "이력" },
  { href: "/evidence", label: "증적" },
  { href: "/admin/accounts", label: "계정" },
] as const;

export async function NavBar() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  return (
    <nav className="flex flex-wrap items-center gap-4 text-sm">
      <Link href="/" className="flex items-center gap-2 font-bold">
        {/* 로고: 고리가 있는 작은 행성 */}
        <span className="relative inline-block h-4 w-4" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#f5d0fe,#a855f7_60%,#2e1065)] shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
          <span className="absolute -inset-x-1 top-1/2 h-1.5 -translate-y-1/2 -rotate-12 rounded-full border border-cyan-300/70" />
        </span>
        <span className="bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">AI성과활용지수</span>
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="hover:text-fuchsia-400">대시보드</Link>
        {isAdmin &&
          ADMIN_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-fuchsia-400">
              {link.label}
            </Link>
          ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span>
          {user.name}({isAdmin ? "관리자" : "조회자"})
        </span>
        <form action={logoutAction}>
          <button type="submit" className="rounded border border-fuchsia-500/50 px-2 py-1 hover:bg-fuchsia-500/10">
            로그아웃
          </button>
        </form>
      </div>
    </nav>
  );
}

export function NavBarFallback() {
  return <div className="h-6 text-sm text-zinc-400">불러오는 중…</div>;
}
