// Design Ref: §9 보안 — 로그인 뒤 화면은 계정이 아직 있고 세션 번호가 맞을 때만 보여준다.
// Cache Components 때문에 이 컴포넌트는 <Suspense> 안에서 쓴다. ((main)/layout.tsx)
import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/guard";

export async function AuthGate({ children }: { children: ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
