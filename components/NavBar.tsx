// Design Ref: §4.2 공통 틀 — 조회자에게는 [대시보드]만 보이고, 관리자에게는 모든 메뉴가 보인다.
import Link from "next/link";

import { logoutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/guard";

const ADMIN_LINKS = [
  { href: "/input", label: "입력" },
  { href: "/settings", label: "설정" },
  { href: "/history", label: "이력" },
  { href: "/evidence", label: "증적" },
  { href: "/admin/accounts", label: "계정" },
] as const;

export async function NavBar() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  return (
    <nav className="flex flex-wrap items-center gap-4 text-sm">
      <Link href="/" className="font-bold">
        AI 성과지수 관리 서비스
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/">대시보드</Link>
        {isAdmin &&
          ADMIN_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span>
          {user.name}({isAdmin ? "관리자" : "조회자"})
        </span>
        <form action={logoutAction}>
          <button type="submit" className="rounded border border-zinc-400 px-2 py-1">
            로그아웃
          </button>
        </form>
      </div>
    </nav>
  );
}

export function NavBarFallback() {
  return <div className="h-6 text-sm text-zinc-500">불러오는 중…</div>;
}
