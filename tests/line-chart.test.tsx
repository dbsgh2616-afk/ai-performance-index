// 선그래프: 곡선 계산 도우미와 월별 AI 지수 그래프 그리기를 확인한다.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScoreChart, type GaugeMonth } from "../components/dashboard/ScoreChart";
import { niceScale, runsOf, smoothPath } from "../lib/line-chart";

describe("선그래프 도우미", () => {
  it("값이 없는 달에서 구간이 끊긴다", () => {
    expect(runsOf([1, 2, null, 4])).toEqual([[0, 1], [3]]);
    expect(runsOf([null, null])).toEqual([]);
    expect(runsOf([5, 6, 7])).toEqual([[0, 1, 2]]);
  });

  it("점이 2개 이상일 때만 곡선을 만든다", () => {
    expect(smoothPath([{ x: 0, y: 0 }])).toBe("");
    const path = smoothPath([
      { x: 0, y: 100 },
      { x: 10, y: 50 },
      { x: 20, y: 60 },
    ]);
    expect(path.startsWith("M0,100 C")).toBe(true);
    expect(path.match(/C/g)).toHaveLength(2);
  });

  it("곡선이 점 사이에서 위아래로 튀지 않는다 (평평한 구간은 평평하게)", () => {
    const path = smoothPath([
      { x: 0, y: 50 },
      { x: 10, y: 50 },
      { x: 20, y: 10 },
    ]);
    // 첫 구간의 제어점 y는 모두 50이어야 한다.
    const [, first] = path.split(" C");
    const ys = first.split(" ").slice(0, 3).map((pair) => Number(pair.split(",")[1]));
    expect(ys).toEqual([50, 50, 50]);
  });

  it("세로축 눈금은 깔끔한 수로 올림한다", () => {
    expect(niceScale(10689).top).toBe(12000);
    expect(niceScale(10689).ticks).toEqual([0, 3000, 6000, 9000, 12000]);
    expect(niceScale(0).top).toBeGreaterThan(0);
  });
});

const month = (label: string, total: number | null, extra: Partial<GaugeMonth> = {}): GaugeMonth => ({
  label,
  total,
  penalty: false,
  isFocus: false,
  ...extra,
});

describe("월별 AI 지수 그래프", () => {
  it("제목, 값 안내, 우주선이 그려진다", () => {
    const html = renderToStaticMarkup(
      <ScoreChart months={[month("1월", 1000), month("2월", 2000), month("3월", 1500, { isFocus: true })]} />,
    );
    expect(html).toContain("월별 AI 지수");
    expect(html).toContain("1월: 1,000.0");
    expect(html).toContain("3월: 1,500.0");
    expect(html).toContain("rotate(");
  });

  it("값이 없는 달은 별을 그리지 않고, 보안사고 달은 안내가 붙는다", () => {
    const html = renderToStaticMarkup(
      <ScoreChart months={[month("1월", 1000), month("2월", null), month("3월", 500, { penalty: true })]} />,
    );
    expect(html).not.toContain("2월:");
    expect(html).toContain("보안사고 -50%");
  });

  it("데이터가 하나도 없어도 오류 없이 그려진다", () => {
    const html = renderToStaticMarkup(<ScoreChart months={[month("1월", null), month("2월", null)]} />);
    expect(html).toContain("월별 AI 지수");
  });
});
