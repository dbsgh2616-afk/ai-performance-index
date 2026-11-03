// AI 인프라 계기판: 입력값 검사, 저장, 변경 이력, 계기판 구간 판정을 확인한다.
import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { InfraCockpit } from "../components/dashboard/InfraCockpit";
import { changeLogs, infraMetrics } from "../lib/db/schema";
import { seedBase } from "../lib/db/seed";
import { seedDev } from "../lib/db/seed-dev";
import type { AppDb } from "../lib/db/types";
import { dialLevel, loadInfra, parseInfraForm, saveInfraMetrics } from "../lib/infra";
import { createTestDb } from "./helpers/db";

let db: AppDb;
let close: () => Promise<void>;
const actor = { id: 1, name: "김관리" };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const FULL = { yearMonth: "2026-11", gpu: "74.5", memory: "68", storage: "78.25", uptime: "99.62", token_cost: "1,500,000", source: "월간 보고" };

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedBase(db, { loginId: "admin01", password: "Passw0rd1" });
});

afterAll(async () => {
  await close();
});

describe("인프라 입력 검사", () => {
  it("올바른 값은 통과하고 빈 출처는 null이 된다", () => {
    expect(parseInfraForm(form({ ...FULL, source: "" }))).toEqual({
      ok: true,
      data: { yearMonth: "2026-11", values: { gpu: 74.5, memory: 68, storage: 78.25, uptime: 99.62 }, tokenCost: 1_500_000, source: null },
    });
  });

  it("모두 비어 있으면 저장할 것이 없다는 뜻(null)이고, 일부만 비면 오류", () => {
    expect(parseInfraForm(form({ yearMonth: "2026-11" }))).toEqual({ ok: true, data: null });
    expect(parseInfraForm(form({ ...FULL, memory: "" }))).toMatchObject({ ok: false, error: expect.stringContaining("메모리 사용률") });
    expect(parseInfraForm(form({ ...FULL, token_cost: "" }))).toMatchObject({ ok: false, error: expect.stringContaining("토큰 사용료") });
  });

  it("범위를 벗어나거나 글자·잘못된 월은 한국어 오류로 거부한다", () => {
    expect(parseInfraForm(form({ ...FULL, gpu: "101" }))).toMatchObject({ ok: false, error: expect.stringContaining("100 이하") });
    expect(parseInfraForm(form({ ...FULL, gpu: "-1" }))).toMatchObject({ ok: false });
    expect(parseInfraForm(form({ ...FULL, uptime: "abc" }))).toMatchObject({ ok: false });
    expect(parseInfraForm(form({ ...FULL, storage: "50.123" }))).toMatchObject({ ok: false });
    expect(parseInfraForm(form({ ...FULL, token_cost: "-5" }))).toMatchObject({ ok: false, error: expect.stringContaining("토큰 사용료") });
    expect(parseInfraForm(form({ ...FULL, token_cost: "1.5" }))).toMatchObject({ ok: false });
    expect(parseInfraForm(form({ ...FULL, yearMonth: "2026-13" }))).toMatchObject({ ok: false, error: expect.stringContaining("월 형식") });
  });
});

describe("인프라 저장과 변경 이력", () => {
  const data = { yearMonth: "2026-11", values: { gpu: 74.5, memory: 68, storage: 78.25, uptime: 99.62 }, tokenCost: 1_500_000, source: "월간 보고" };

  it("처음 저장하면 값 6개의 이력이 남고, 입력자가 기록된다", async () => {
    const { changes } = await saveInfraMetrics(db, data, actor);
    expect(changes).toBe(6);
    const snapshot = await loadInfra(db, "2026-11");
    expect(snapshot).toMatchObject({ values: data.values, tokenCost: 1_500_000, source: "월간 보고", enteredByName: "김관리" });
  });

  it("같은 값을 다시 저장하면 이력이 늘지 않는다", async () => {
    expect((await saveInfraMetrics(db, data, actor)).changes).toBe(0);
  });

  it("값을 고치면 바뀐 항목만 이전 값·새 값이 이력에 남고, 이전 값은 지워지지 않는다", async () => {
    const { changes } = await saveInfraMetrics(db, { ...data, values: { ...data.values, gpu: 80 } }, { id: 1, name: "박담당" });
    expect(changes).toBe(1);
    const logs = await db.select().from(changeLogs).where(eq(changeLogs.targetType, "infra_metric"));
    const gpuLog = logs.find((row) => row.fieldName === "gpu_usage_pct" && row.oldValue === "74.5");
    expect(gpuLog).toMatchObject({ newValue: "80", changedByName: "박담당", targetId: "2026-11" });
    expect(await db.select().from(infraMetrics)).toHaveLength(1);
  });

  it("없는 달은 null", async () => {
    expect(await loadInfra(db, "2020-01")).toBeNull();
  });

  it("DB에서도 0~100 범위를 지킨다", async () => {
    await expect(
      db.insert(infraMetrics).values({
        yearMonth: "2026-01",
        gpuUsagePct: 120,
        memoryUsagePct: 1,
        storageUsagePct: 1,
        uptimePct: 99,
        enteredById: 1,
        enteredByName: "김관리",
      }),
    ).rejects.toThrow();
  });

  it("시연 데이터에는 1~11월 인프라 값이 들어 있다", async () => {
    const result = await seedDev(db);
    expect(result.infraCount).toBe(11);
    // 시연 데이터의 마지막 달: GPU와 스토리지가 '주의' 구간
    const november = await loadInfra(db, "2026-11");
    expect(november).not.toBeNull();
  });
});

describe("계기판 구간 판정", () => {
  it("사용률은 70 미만 정상, 85 미만 주의, 그 이상 위험", () => {
    expect(dialLevel("usage", 69.9)).toBe("ok");
    expect(dialLevel("usage", 70)).toBe("warn");
    expect(dialLevel("usage", 84.9)).toBe("warn");
    expect(dialLevel("usage", 85)).toBe("danger");
  });

  it("가동률은 99.5 이상 정상, 99 이상 주의, 그 미만 위험", () => {
    expect(dialLevel("uptime", 99.9)).toBe("ok");
    expect(dialLevel("uptime", 99.5)).toBe("ok");
    expect(dialLevel("uptime", 99.2)).toBe("warn");
    expect(dialLevel("uptime", 98.7)).toBe("danger");
  });
});

describe("계기판 화면", () => {
  const snapshot = {
    yearMonth: "2026-11",
    values: { gpu: 74, memory: 68, storage: 90, uptime: 99.62 },
    tokenCost: 2_000_000,
    source: null,
    enteredByName: "김관리",
    enteredAt: new Date("2026-11-02T00:00:00Z"),
  };
  const roi = { months: 11, hours: 1500, benefit: 99_000_000, cost: 88_000_000, monthlyCost: 6_500_000, tokenCost: 16_500_000, roiPct: 12.5 };
  const costs = { gpuCapex: 100_000_000, gpuCount: 8, capexTotal: 240_000_000, amortMonthly: 4_000_000, opexMonthly: 2_500_000 };

  it("GPU 도입비용·GPU 갯수·토큰 사용료·월 총비용이 나오고 가운데에 추정 ROI가 있다", () => {
    const html = renderToStaticMarkup(<InfraCockpit snapshot={snapshot} yearMonth="2026-11" isAdmin roi={roi} costs={costs} tokenSeries={[1_000_000, 1_800_000, 2_000_000]} />);
    // GPU 도입비용: 1억원, 도입비 합계(2.4억원)의 42%
    expect(html).toContain("GPU 도입비용");
    expect(html).toContain("1억원");
    expect(html).toContain("도입비 합계의 42%");
    // GPU 갯수: 8대, 대당 1억원 ÷ 8 = 1,250만원
    expect(html).toContain("GPU 갯수");
    expect(html).toContain("8대");
    expect(html).toContain("대당 1,250만원");
    // 토큰 사용료: 이번 달 200만원, 전월(180만원) 대비 11.1% 증가
    expect(html).toContain("토큰 사용료");
    expect(html).toContain("200만원");
    expect(html).toContain("전월 대비 ▲ 11.1%");
    // 월 총비용: 상각 400만 + 운영 250만 + 토큰 200만 = 850만원
    expect(html).toContain("월 총비용");
    expect(html).toContain("850만원");
    expect(html).toContain("상각 400 · 운영 250 · 토큰 200 (만원)");
    // 가운데 ROI
    expect(html).toContain("추정 ROI");
    expect(html).toContain("+12.5%");
    expect(html).toContain("효과 9,900만원 · 비용 8,800만원");
    // 사용률로 정한 종합 경고등: 스토리지 90%는 위험
    expect(html).toContain("MASTER WARNING");
    expect(html).toContain("/infra?month=2026-11");
  });

  it("값이 없으면 '데이터 없음', 조회자에게는 입력 링크가 보이지 않는다", () => {
    const html = renderToStaticMarkup(<InfraCockpit snapshot={null} yearMonth="2026-11" isAdmin={false} roi={null} costs={null} />);
    expect(html).toContain("데이터 없음");
    expect(html).not.toContain("/infra");
    expect(html).not.toContain("MASTER");
  });

  it("그 달 인프라 값이 없어도 도입비용·GPU 갯수는 보이고, 토큰 사용료만 '데이터 없음'", () => {
    const html = renderToStaticMarkup(<InfraCockpit snapshot={null} yearMonth="2026-11" isAdmin roi={null} costs={costs} />);
    expect(html).toContain("1억원");
    expect(html).toContain("8대");
    expect(html).toContain("데이터 없음");
  });
});
