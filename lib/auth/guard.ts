// Design Ref: §9 보안 — 권한 확인은 화면이 아니라 서버에서 한다. (Data Access Layer)
// 서버 코드(페이지, Server Action, Route Handler)에서만 쓴다.
// Cache Components가 켜져 있어서, 이 함수를 부르는 컴포넌트는 <Suspense> 안에 있어야 한다.
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "../db";
import { accounts } from "../db/schema";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export type CurrentUser = {
  id: number;
  loginId: string;
  name: string;
  role: "admin" | "viewer";
};

// 로그인 증표가 맞고, 계정이 아직 있고, 세션 번호가 같을 때만 사용자를 돌려준다.
// 비밀번호를 재설정하거나 계정을 삭제하면 세션 번호가 달라져 열려 있던 세션이 끊긴다.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;

  const [account] = await getDb().select().from(accounts).where(eq(accounts.id, session.accountId)).limit(1);
  if (!account || account.sessionVersion !== session.sessionVersion) return null;

  return { id: account.id, loginId: account.loginId, name: account.name, role: account.role };
}

// 로그인하지 않았으면 로그인 화면으로 보낸다.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// 관리자가 아니면 대시보드로 돌려보낸다.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
