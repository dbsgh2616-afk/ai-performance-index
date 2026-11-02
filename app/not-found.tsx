// Design Ref: §8 오류 처리 — 없는 주소는 404 안내
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <h1 className="text-xl font-bold">페이지를 찾을 수 없습니다</h1>
      <Link href="/" className="underline">
        대시보드로 돌아가기
      </Link>
    </main>
  );
}
