"use client";

// 1인칭 우주선 전방 시야: 별이 화면 가운데(소실점)에서 나와 바깥으로 뻗으며 지나간다.
// 가까운 별일수록 빠르고 길고 밝다. 내용 뒤에 깔리고 클릭을 막지 않는다.
// "애니메이션 줄이기"를 켠 기기에서는 멈춘 별 그림만 한 번 그린다.
import { useEffect, useRef } from "react";

type Star = { x: number; y: number; z: number; tint: string };

const COUNT = 280;
const TINTS = ["255,255,255", "255,255,255", "255,255,255", "165,243,252", "244,114,182", "196,181,253"];
const SPEED = 0.16; // 1초에 가까워지는 깊이. 클수록 빠르다.
const MAX_TRAIL = 46; // 별 꼬리의 최대 길이(px)
const NEAR = 0.03; // 이 깊이보다 가까워지면 화면 밖으로 나간 것으로 보고 멀리서 다시 만든다.

function spawn(initial: boolean): Star {
  // 가운데 근처에 몰리지 않게 원반 안에서 고르게 흩뿌린다.
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.08 + Math.sqrt(Math.random()) * 1.4;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    z: initial ? 0.05 + Math.random() * 0.95 : 1,
    tint: TINTS[Math.floor(Math.random() * TINTS.length)],
  };
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stars = Array.from({ length: COUNT }, () => spawn(true));
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = performance.now();

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
      const dt = Math.min(0.05, (now - last) / 1000); // 탭을 오래 떠났다 돌아와도 한꺼번에 튀지 않게 한다.
      last = now;
      ctx.clearRect(0, 0, width, height);

      // 소실점은 화면 가운데보다 약간 위. 조종석에서 앞을 보는 눈높이다.
      const cx = width / 2;
      const cy = height * 0.4;
      const scale = Math.max(width, height) * 0.5;

      for (const star of stars) {
        const previousZ = star.z;
        if (!reduceMotion) star.z -= SPEED * dt;

        const px = cx + (star.x / star.z) * scale * 0.18;
        const py = cy + (star.y / star.z) * scale * 0.18;
        if (star.z <= NEAR || px < -20 || px > width + 20 || py < -20 || py > height + 20) {
          Object.assign(star, spawn(false));
          continue;
        }

        // 지난 프레임의 위치에서 지금 위치까지 이어 그려 꼬리를 만든다. (가까울수록 길다)
        const trail = reduceMotion ? star.z : previousZ + SPEED * 0.05 * (1 - star.z) * 2;
        let tx = cx + (star.x / trail) * scale * 0.18;
        let ty = cy + (star.y / trail) * scale * 0.18;
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

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10 motion-reduce:opacity-60" aria-hidden />;
}
