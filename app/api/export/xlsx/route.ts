import { handleEvidenceExport } from "@/lib/evidence/handler";

export async function GET(request: Request) {
  return handleEvidenceExport(request, "xlsx");
}
