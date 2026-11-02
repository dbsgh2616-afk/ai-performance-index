// Design Ref: §9 보안 — 비밀번호는 bcryptjs로 섞어 저장한다. 8자 이상, 영문+숫자.
// Plan SC: 7 보안 규칙
import bcrypt from "bcryptjs";

const HASH_COST = 10;

export const PASSWORD_RULE_MESSAGE = "8자 이상, 영문과 숫자를 포함하세요.";

// 규칙: 8자 이상이며 영문과 숫자를 모두 포함해야 한다. (PRD 7번)
export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, HASH_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
