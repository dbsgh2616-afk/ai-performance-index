// Design Ref: §5.3 로그인 흐름, §9 보안 — 로그인 증표(세션)는 서명하고 HttpOnly 쿠키로 보낸다.
// 요청할 때마다 만료 시각을 30분 뒤로 새로 갱신한다. (proxy.ts)
// Plan SC: 7 보안 규칙 — 30분 동안 사용하지 않으면 자동 로그아웃
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "session";
export const SESSION_MINUTES = 30;
const SESSION_SECONDS = SESSION_MINUTES * 60;

export type SessionPayload = {
  accountId: number;
  sessionVersion: number;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET이 없거나 너무 짧습니다. .env에 32자 이상의 값을 넣어 주세요.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
  expiresInSeconds: number = SESSION_SECONDS,
): Promise<string> {
  return new SignJWT({ sv: payload.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.accountId))
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(getSecret());
}

// 서명이 틀렸거나 만료되었으면 null을 돌려준다.
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const accountId = Number(payload.sub);
    const sessionVersion = payload.sv;
    if (!Number.isInteger(accountId) || typeof sessionVersion !== "number") return null;
    return { accountId, sessionVersion };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}
