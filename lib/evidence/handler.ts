// Design Ref: §7 서버 기능 — GET /api/export/pdf?year=, /api/export/xlsx?year= (관리자만)
// 오류 응답은 DESIGN 6장 형식({ error: { code, message } })을 따른다.
import { getCurrentUser } from "../auth/guard";
import { currentYear } from "../date";
import { getDb } from "../db";
import { buildEvidencePdf } from "./pdf";
import { buildEvidenceReport } from "./report";
import { buildEvidenceXlsx } from "./xlsx";

type ExportKind = "pdf" | "xlsx";

const CONTENT_TYPES: Record<ExportKind, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function handleEvidenceExport(request: Request, kind: ExportKind): Promise<Response> {
  // 화면에서 숨겨도 안전하지 않다. 파일을 내려줄 때마다 서버에서 관리자인지 확인한다.
  const user = await getCurrentUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  if (user.role !== "admin") return errorResponse(403, "FORBIDDEN", "관리자만 증적자료를 출력할 수 있습니다.");

  const yearParam = new URL(request.url).searchParams.get("year");
  if (yearParam !== null && !/^20\d{2}$/.test(yearParam)) {
    return errorResponse(400, "VALIDATION_ERROR", "연도는 2000~2099 사이의 4자리 숫자여야 합니다.");
  }
  const year = yearParam === null ? currentYear() : Number(yearParam);

  try {
    // 출력 일시와 출력자는 파일에 찍힌다. (PRD 5번)
    const report = await buildEvidenceReport(getDb(), year, user.name);
    const body = kind === "pdf" ? await buildEvidencePdf(report) : await buildEvidenceXlsx(report);

    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": CONTENT_TYPES[kind],
        "Content-Disposition": `attachment; filename="evidence-${year}.${kind}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("증적자료 출력 오류:", error instanceof Error ? error.message : "알 수 없는 오류");
    return errorResponse(500, "INTERNAL_ERROR", "증적자료를 만들지 못했습니다. 다시 시도하세요.");
  }
}
