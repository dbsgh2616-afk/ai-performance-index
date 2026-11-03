"use client";

// 1인칭 우주선 전방 시야. 화면 가운데(소실점)를 향해 날아가는 느낌을 캔버스 하나로 그린다.
//  - 별: 가운데에서 나와 바깥으로 뻗으며 지나간다. 가까울수록 빠르고 길고 밝다.
//  - 행성: 멀리서 천천히 다가오며 점점 커지다가 화면 옆으로 빠져나간다.
//  - 앞서 가는 우주선: 우리보다 앞에서 같은 방향으로 날아가며 점점 멀어진다. (뒷모습, 엔진 불꽃)
//  - 가로지르는 우주선: 가끔 화면을 옆으로 가로지른다. (옆모습, 불꽃 꼬리)
// 내용 뒤에 깔리고 클릭을 막지 않는다. "애니메이션 줄이기"를 켠 기기에서는 멈춘 그림 한 장만 그린다.
import { useEffect, useRef } from "react";

type Vec = { x: number; y: number; z: number };
type Star = Vec & { tint: string };
type PlanetKind = { colors: [string, string, string]; glow: string; ring?: string; bands?: boolean };
type Planet = Vec & { r: number; kind: PlanetKind };
type RearShip = Vec & { vz: number; vx: number; hue: string; phase: number; delay: number };
type Crosser = { x: number; y: number; size: number; speed: number; dir: 1 | -1; hue: string; wait: number };

const STAR_COUNT = 280;
const TINTS = ["255,255,255", "255,255,255", "255,255,255", "165,243,252", "244,114,182", "196,181,253"];
const SPEED = 0.16; // 별이 1초에 가까워지는 깊이. 클수록 빠르다.
const MAX_TRAIL = 46; // 별 꼬리의 최대 길이(px)
const NEAR = 0.03; // 이 깊이보다 가까워지면 화면 밖으로 나간 것으로 보고 멀리서 다시 만든다.
const FOCAL = 0.18; // 투영 배율. 클수록 가운데에서 더 빨리 퍼진다.

const PLANET_KINDS: PlanetKind[] = [
  { colors: ["#fde68a", "#f472b6", "#4c1d95"], glow: "244,114,182", ring: "253,230,138", bands: true },
  { colors: ["#a5f3fc", "#3b82f6", "#1e1b4b"], glow: "96,165,250" },
  { colors: ["#c4b5fd", "#7c3aed", "#0f0a2e"], glow: "167,139,250", ring: "196,181,253" },
  { colors: ["#fecdd3", "#fb7185", "#4c0519"], glow: "251,113,133", bands: true },
  { colors: ["#99f6e4", "#14b8a6", "#042f2e"], glow: "45,212,191" },
];
const SHIP_HUES = ["#22d3ee", "#f472b6", "#a78bfa", "#fbbf24"];

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function spawnStar(initial: boolean): Star {
  // 가운데 근처에 몰리지 않게 원반 안에서 고르게 흩뿌린다.
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.08 + Math.sqrt(Math.random()) * 1.4;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    z: initial ? 0.05 + Math.random() * 0.95 : 1,
    tint: pick(TINTS),
  };
}

function spawnPlanet(initial: boolean): Planet {
  const side = Math.random() < 0.5 ? -1 : 1;
  return {
    x: side * rand(0.3, 0.85),
    y: rand(-0.55, 0.35),
    z: initial ? rand(0.35, 0.95) : 1,
    r: rand(0.11, 0.22),
    kind: pick(PLANET_KINDS),
  };
}

function spawnRearShip(initialDelay: number): RearShip {
  return {
    x: rand(0.04, 0.4) * (Math.random() < 0.5 ? -1 : 1),
    y: rand(-0.12, 0.3),
    z: 0.08,
    vz: rand(0.03, 0.055),
    vx: rand(-0.012, 0.012),
    hue: pick(SHIP_HUES),
    phase: rand(0, 6.28),
    delay: initialDelay,
  };
}

function spawnCrosser(initial: boolean): Crosser {
  return {
    x: 0,
    y: rand(0.12, 0.8),
    size: rand(60, 110),
    speed: rand(150, 230),
    dir: Math.random() < 0.5 ? 1 : -1,
    hue: pick(SHIP_HUES),
    wait: initial ? rand(3, 9) : rand(16, 32),
  };
}

// ── 그리기 도우미 ─────────────────────────────────────────────

function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kind: PlanetKind, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // 대기의 빛 번짐
  const halo = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.7);
  halo.addColorStop(0, `rgba(${kind.glow},0.35)`);
  halo.addColorStop(1, `rgba(${kind.glow},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
  ctx.fill();

  // 고리: 뒤쪽 절반은 행성 아래에, 앞쪽 절반은 행성 위에 그린다.
  const ring = (front: boolean) => {
    if (!kind.ring) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.38);
    ctx.scale(1, 0.26);
    ctx.strokeStyle = `rgba(${kind.ring},0.55)`;
    ctx.lineWidth = r * 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.75, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  ring(false);

  // 구 본체: 왼쪽 위에서 빛을 받는다.
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.1);
  body.addColorStop(0, kind.colors[0]);
  body.addColorStop(0.5, kind.colors[1]);
  body.addColorStop(1, kind.colors[2]);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // 줄무늬(가스 행성)
  if (kind.bands) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-0.2);
    [-0.55, -0.15, 0.25, 0.6].forEach((offset, index) => {
      ctx.fillStyle = index % 2 === 0 ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
      ctx.fillRect(-r, offset * r - r * 0.09, r * 2, r * 0.18);
    });
    ctx.restore();
  }

  // 그늘진 쪽(오른쪽 아래)
  const shade = ctx.createRadialGradient(x - r * 0.45, y - r * 0.45, r * 0.7, x - r * 0.45, y - r * 0.45, r * 1.7);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(2,3,12,0.7)");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ring(true);
  ctx.restore();
}

// 앞서 가는 우주선의 뒷모습. 날개 폭이 2인 단위 좌표에 그리고 s배로 키운다.
function drawRearShip(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hue: string, tilt: number, flicker: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;

  // 엔진 불꽃 두 개 (뒷모습에서는 우리 쪽으로 빛이 번진다)
  for (const ex of [-0.36, 0.36]) {
    const glow = ctx.createRadialGradient(ex, 0.2, 0, ex, 0.2, 0.75 * flicker);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.25, hue);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ex, 0.2, 0.75 * flicker, 0, Math.PI * 2);
    ctx.fill();
  }

  // 날개
  const wing = ctx.createLinearGradient(-1, 0, 1, 0);
  wing.addColorStop(0, "#475569");
  wing.addColorStop(0.5, "#e2e8f0");
  wing.addColorStop(1, "#475569");
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-1, 0.22);
  ctx.lineTo(-0.28, -0.12);
  ctx.lineTo(0.28, -0.12);
  ctx.lineTo(1, 0.22);
  ctx.lineTo(0.32, 0.38);
  ctx.lineTo(-0.32, 0.38);
  ctx.closePath();
  ctx.fill();
  // 날개 끝 색 띠
  ctx.fillStyle = hue;
  ctx.fillRect(-1, 0.16, 0.2, 0.07);
  ctx.fillRect(0.8, 0.16, 0.2, 0.07);

  // 몸통과 꼬리날개
  ctx.fillStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(0, -0.62);
  ctx.lineTo(0.07, -0.1);
  ctx.lineTo(-0.07, -0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.ellipse(0, 0.05, 0.27, 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(34,211,238,0.85)";
  ctx.beginPath();
  ctx.ellipse(0, -0.05, 0.12, 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 화면을 가로지르는 우주선의 옆모습. 오른쪽을 향하게 그리고, 왼쪽으로 가면 뒤집는다.
function drawCrosser(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: 1 | -1, hue: string, flicker: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * size, size);

  // 불꽃 꼬리
  const tail = ctx.createLinearGradient(-0.5, 0, -2.6 * flicker, 0);
  tail.addColorStop(0, hue);
  tail.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(-0.5, -0.07);
  ctx.lineTo(-2.6 * flicker, 0);
  ctx.lineTo(-0.5, 0.07);
  ctx.closePath();
  ctx.fill();

  // 뒷날개
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.moveTo(-0.55, -0.02);
  ctx.lineTo(-0.85, -0.36);
  ctx.lineTo(-0.3, -0.04);
  ctx.closePath();
  ctx.fill();

  // 몸통
  const hull = ctx.createLinearGradient(0, -0.2, 0, 0.2);
  hull.addColorStop(0, "#f8fafc");
  hull.addColorStop(1, "#64748b");
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(1, 0.02);
  ctx.quadraticCurveTo(0.4, -0.2, -0.5, -0.12);
  ctx.lineTo(-0.55, 0.1);
  ctx.quadraticCurveTo(0.3, 0.2, 1, 0.02);
  ctx.closePath();
  ctx.fill();

  // 아래 날개와 색 띠, 조종석 유리, 엔진 빛
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.moveTo(0.1, 0.1);
  ctx.lineTo(-0.5, 0.36);
  ctx.lineTo(-0.35, 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hue;
  ctx.fillRect(-0.45, -0.01, 0.9, 0.03);
  ctx.fillStyle = "rgba(125,211,252,0.9)";
  ctx.beginPath();
  ctx.ellipse(0.5, -0.07, 0.17, 0.06, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-0.55, 0, 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stars = Array.from({ length: STAR_COUNT }, () => spawnStar(true));
    const planets = Array.from({ length: 3 }, () => spawnPlanet(true));
    const rearShips = [spawnRearShip(0.2), spawnRearShip(4), spawnRearShip(8)];
    const crossers = [spawnCrosser(true)];
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = performance.now();
    let clock = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (now: number) => {
      const dt = reduceMotion ? 0 : Math.min(0.05, (now - last) / 1000); // 탭을 오래 떠났다 돌아와도 한꺼번에 튀지 않게 한다.
      last = now;
      clock += dt;
      ctx.clearRect(0, 0, width, height);

      // 소실점은 화면 가운데보다 약간 위. 조종석에서 앞을 보는 눈높이다.
      const cx = width / 2;
      const cy = height * 0.4;
      const k = Math.max(width, height) * 0.5 * FOCAL;
      const project = (v: Vec, depth = v.z) => ({ px: cx + (v.x / depth) * k, py: cy + (v.y / depth) * k });

      // 별
      for (const star of stars) {
        const previousZ = star.z;
        star.z -= SPEED * dt;
        const { px, py } = project(star);
        if (star.z <= NEAR || px < -20 || px > width + 20 || py < -20 || py > height + 20) {
          Object.assign(star, spawnStar(false));
          continue;
        }

        // 지난 프레임의 위치에서 지금 위치까지 이어 그려 꼬리를 만든다. (가까울수록 길다)
        const trailZ = reduceMotion ? star.z : previousZ + SPEED * 0.05 * (1 - star.z) * 2;
        const tail = project(star, trailZ);
        let { px: tx, py: ty } = tail;
        // 화면 가장자리의 별은 같은 거리를 가도 화면에서는 훨씬 길게 그려지므로 꼬리 길이를 제한한다.
        const length = Math.hypot(px - tx, py - ty);
        if (length > MAX_TRAIL) {
          tx = px + ((tx - px) / length) * MAX_TRAIL;
          ty = py + ((ty - py) / length) * MAX_TRAIL;
        }
        const closeness = 1 - star.z;
        ctx.strokeStyle = `rgba(${star.tint},${Math.min(1, 0.15 + closeness * 1.1).toFixed(2)})`;
        ctx.lineWidth = 0.4 + closeness * 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      // 행성: 멀리서 다가오며 커진다. 먼 것부터 그려 가까운 것이 위에 오게 한다.
      planets.sort((a, b) => b.z - a.z);
      for (const planet of planets) {
        planet.z -= 0.03 * dt;
        const { px, py } = project(planet);
        const radius = (planet.r / planet.z) * k;
        if (planet.z < 0.07 || radius > 380 || px + radius < -50 || px - radius > width + 50 || py - radius > height + 50) {
          Object.assign(planet, spawnPlanet(false));
          continue;
        }
        drawPlanet(ctx, px, py, radius, planet.kind, Math.min(1, (1 - planet.z) * 7) * 0.92);
      }

      // 앞서 가는 우주선: 우리보다 빠르게 앞으로 날아가며 점점 작아진다.
      for (const ship of rearShips) {
        if (ship.delay > 0) {
          ship.delay -= dt;
          continue;
        }
        ship.z += ship.vz * dt;
        ship.x += ship.vx * dt;
        if (ship.z > 0.7) {
          Object.assign(ship, spawnRearShip(rand(1, 6)));
          continue;
        }
        const { px, py } = project(ship);
        const size = (0.06 / ship.z) * k;
        const fade = Math.min(1, ship.z * 10) * Math.min(1, (0.7 - ship.z) * 6);
        const tilt = Math.sin(clock * 0.9 + ship.phase) * 0.09;
        const flicker = 0.85 + Math.sin(clock * 22 + ship.phase) * 0.15;
        drawRearShip(ctx, px, py, size, ship.hue, tilt, flicker, fade);
      }

      // 가로지르는 우주선: 가끔 화면 옆을 지나간다.
      for (const crosser of crossers) {
        if (crosser.wait > 0) {
          crosser.wait -= dt;
          if (crosser.wait <= 0) crosser.x = crosser.dir === 1 ? -crosser.size * 3 : width + crosser.size * 3;
          continue;
        }
        crosser.x += crosser.dir * crosser.speed * dt;
        const out = crosser.dir === 1 ? crosser.x > width + crosser.size * 3 : crosser.x < -crosser.size * 3;
        if (out) {
          Object.assign(crosser, spawnCrosser(false));
          continue;
        }
        const bob = Math.sin(clock * 1.3 + crosser.y * 10) * 3;
        drawCrosser(ctx, crosser.x, crosser.y * height + bob, crosser.size, crosser.dir, crosser.hue, 0.9 + Math.sin(clock * 25) * 0.1);
      }

      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10" aria-hidden />;
}
