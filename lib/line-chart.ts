// 선그래프용 계산 도우미 — 화면을 모르는 순수 함수다.

export type Point = { x: number; y: number };

// 값이 있는 칸이 이어진 구간(run)의 위치 목록. 값이 없는 칸(null)에서 선이 끊긴다.
// 예: [1, 2, null, 4] → [[0, 1], [3]]
export function runsOf(values: (number | null)[]): number[][] {
  const runs: number[][] = [];
  let current: number[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length > 0) runs.push(current);
      current = [];
    } else {
      current.push(index);
    }
  });
  if (current.length > 0) runs.push(current);
  return runs;
}

// 점들을 지나는 부드러운 곡선(SVG path). 주식 차트처럼 점 사이에서 출렁이지 않게
// 단조 3차 보간(Fritsch–Carlson)을 쓴다. 점이 1개면 빈 문자열.
export function smoothPath(points: Point[]): string {
  const count = points.length;
  if (count < 2) return "";

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push((points[i + 1].y - points[i].y) / dx[i]);
  }

  const tangent: number[] = [slope[0]];
  for (let i = 1; i < count - 1; i += 1) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[count - 2]);

  // 구간 안에서 곡선이 튀지 않도록 기울기를 제한한다.
  for (let i = 0; i < count - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const size = Math.hypot(a, b);
    if (size > 3) {
      tangent[i] = (3 * a * slope[i]) / size;
      tangent[i + 1] = (3 * b * slope[i]) / size;
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  let path = `M${round(points[0].x)},${round(points[0].y)}`;
  for (let i = 0; i < count - 1; i += 1) {
    const third = dx[i] / 3;
    path += ` C${round(points[i].x + third)},${round(points[i].y + tangent[i] * third)}`;
    path += ` ${round(points[i + 1].x - third)},${round(points[i + 1].y - tangent[i + 1] * third)}`;
    path += ` ${round(points[i + 1].x)},${round(points[i + 1].y)}`;
  }
  return path;
}

// 세로축 눈금: 최댓값을 깔끔한 수로 올리고 같은 간격으로 나눈다.
export function niceScale(max: number, steps = 4): { top: number; ticks: number[] } {
  const safeMax = Math.max(1, max);
  const unit = 10 ** Math.floor(Math.log10(safeMax)) / 5;
  const top = Math.ceil(safeMax / unit) * unit;
  return { top, ticks: Array.from({ length: steps + 1 }, (_, i) => (top / steps) * i) };
}
