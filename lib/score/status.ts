// 서비스 상태등 — 선택한 달에 서비스별로 입력이 끝났는지, 기다리는 중인지, 근거(출처)가 비었는지 알려 준다.
// 화면과 DB를 모르는 순수 함수다. 지수 계산에는 쓰지 않는다.
import type { MonthScore, ScoreData } from "./index";

export type ServiceStatusKind = "done" | "pending" | "unverified";

export type ServiceStatus = {
  serviceId: number;
  serviceName: string;
  kind: ServiceStatusKind;
  reasons: string[]; // 왜 그 상태인지 (입력 완료면 빈 목록)
};

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

export function serviceStatuses(data: ScoreData, month: MonthScore): ServiceStatus[] {
  return month.services.map((service) => {
    const input = data.inputs.find((row) => row.serviceId === service.serviceId && row.yearMonth === month.yearMonth);
    const setting = data.settings.find((row) => row.serviceId === service.serviceId && row.half === month.half);

    const missing: string[] = [];
    if (!input) missing.push("호출횟수 미입력");
    if (!setting) missing.push("업무절감시간·업무기여도 미입력");
    if (missing.length > 0) {
      return { serviceId: service.serviceId, serviceName: service.serviceName, kind: "pending", reasons: missing };
    }

    // 값은 다 있지만 출처가 비어 있으면 증적자료에 "근거 미확인"으로 나온다. (PRD 5번)
    const noSource: string[] = [];
    if (isBlank(input?.source)) noSource.push("호출횟수 출처 없음");
    if (isBlank(setting?.survey?.source)) noSource.push("설문 출처 없음");
    return {
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      kind: noSource.length > 0 ? "unverified" : "done",
      reasons: noSource,
    };
  });
}
