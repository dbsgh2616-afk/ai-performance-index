// Design Ref: §4.9 계정 관리 (`/admin/accounts`) — 관리자만
import { Suspense } from "react";

import { listAccounts, MESSAGES } from "@/lib/accounts";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

import { CreateAccountForm, DeleteAccountForm, ResetPasswordForm } from "./account-forms";

export default function AccountsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
      <AccountsContent />
    </Suspense>
  );
}

async function AccountsContent() {
  const me = await requireAdmin();
  const rows = await listAccounts(getDb());
  const adminCount = rows.filter((row) => row.role === "admin").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">계정 관리</h1>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2 pr-3">아이디</th>
              <th className="py-2 pr-3">이름</th>
              <th className="py-2 pr-3">권한</th>
              <th className="py-2 pr-3">만든 날짜</th>
              <th className="py-2 pr-3">비밀번호</th>
              <th className="py-2">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isLastAdmin = row.role === "admin" && adminCount <= 1;
              return (
                <tr key={row.id} className="border-b border-zinc-200 align-top dark:border-zinc-800">
                  <td className="py-3 pr-3 font-medium">
                    {row.loginId}
                    {row.id === me.id && <span className="ml-2 text-xs text-zinc-500">(나)</span>}
                  </td>
                  <td className="py-3 pr-3">{row.name}</td>
                  <td className="py-3 pr-3">{row.role === "admin" ? "관리자" : "조회자"}</td>
                  <td className="py-3 pr-3">{formatDateTime(row.createdAt).slice(0, 10)}</td>
                  <td className="py-3 pr-3">
                    <ResetPasswordForm accountId={row.id} loginId={row.loginId} />
                  </td>
                  <td className="py-3">
                    <DeleteAccountForm
                      accountId={row.id}
                      loginId={row.loginId}
                      disabledReason={isLastAdmin ? MESSAGES.lastAdmin : undefined}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CreateAccountForm />

      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
        <li>비밀번호를 잊으면 여기서 다시 설정합니다. 다시 설정하면 그 계정의 열려 있던 로그인은 끊어지고, 로그인 잠금도 풀립니다.</li>
        <li>계정을 삭제해도 그 계정이 남긴 입력 기록(입력자 이름)과 변경 이력은 그대로 남습니다.</li>
        <li>마지막 관리자 계정은 삭제할 수 없습니다.</li>
      </ul>
    </div>
  );
}
