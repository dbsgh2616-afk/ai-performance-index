// Design Ref: §9 보안 — 모든 화면은 로그인 뒤에만 열린다. 로그인하지 않으면 /login으로 보낸다.
// 로그인 증표가 맞으면 요청할 때마다 만료 시각을 30분 뒤로 새로 갱신한다. (30분 동안 사용이 없으면 끝남)
// 계정이 삭제되었는지, 세션 번호가 맞는지는 DB가 필요해서 lib/auth/guard.ts에서 확인한다.
import { NextResponse, type NextRequest } from "next/server";

import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySessionToken,
} from "./lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 화면은 누구나 열 수 있다.
  if (pathname === "/login") {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    if (request.cookies.has(SESSION_COOKIE)) {
      loginUrl.searchParams.set("expired", "1");
    }
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions());
  return response;
}

export const config = {
  // 정적 파일(_next, 아이콘 등)은 제외한다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
