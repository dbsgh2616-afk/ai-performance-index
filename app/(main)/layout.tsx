// Design Ref: §4.2 공통 틀 — 로그인 정보를 읽는 부분은 <Suspense> 안에 둔다. (Cache Components)
import { Suspense, type ReactNode } from "react";

import { AuthGate } from "@/components/AuthGate";
import { NavBar, NavBarFallback } from "@/components/NavBar";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/40 px-6 py-3 backdrop-blur-xl">
        <Suspense fallback={<NavBarFallback />}>
          <NavBar />
        </Suspense>
      </header>
      <div className="mx-auto w-full max-w-7xl flex-1 p-6">
        <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </div>
    </div>
  );
}
