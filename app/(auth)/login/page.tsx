// Design Ref: §4.3 로그인 (`/login`)
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-8 shadow-sm dark:border-white/15 dark:bg-zinc-900">
        <h1 className="mb-6 text-center text-xl font-bold">AI성과활용지수</h1>
        <Suspense fallback={<p className="text-center text-sm text-zinc-500">불러오는 중…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
