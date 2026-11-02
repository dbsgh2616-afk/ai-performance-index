"use client";

// Design Ref: §8 오류 처리 — DB 오류 등으로 화면을 만들지 못했을 때 안내한다. (비밀 값은 보여주지 않는다)
export default function MainError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-bold">화면을 불러오지 못했습니다</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        데이터를 읽는 중 문제가 생겼습니다. 잠시 후 다시 시도하세요. 계속되면 관리자에게 알려 주세요.
      </p>
      <button type="button" onClick={reset} className="rounded border border-zinc-400 px-3 py-2 text-sm">
        다시 시도
      </button>
    </div>
  );
}
