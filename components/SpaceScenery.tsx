// 배경 장식: 행성과 우주선이 화면 뒤를 천천히 지나간다. 내용 뒤에 깔리고 클릭을 막지 않는다.
// 움직임을 줄이는 설정을 켠 기기에서는 보이지 않는다. (motion-reduce:hidden)
// 특별 손님(CAMEOS)은 장난으로 넣은 것이다. 외부에 보여줄 때는 CAMEOS를 빈 목록으로 바꾸면 사라진다.

type Planet = {
  size: number; // px
  top: string;
  duration: number; // 초
  delay: number; // 초. 음수면 이미 화면 중간쯤에서 시작한다.
  surface: string; // CSS background
  ring?: string; // 고리 색
  opacity: number;
};

const PLANETS: Planet[] = [
  {
    size: 140,
    top: "10%",
    duration: 170,
    delay: -60,
    surface: "radial-gradient(circle at 32% 30%, #fde68a, #f472b6 48%, #4c1d95 85%)",
    ring: "rgba(253, 230, 138, 0.55)",
    opacity: 0.5,
  },
  {
    size: 64,
    top: "68%",
    duration: 110,
    delay: -30,
    surface: "radial-gradient(circle at 35% 30%, #a5f3fc, #3b82f6 55%, #1e1b4b 90%)",
    opacity: 0.55,
  },
  {
    size: 96,
    top: "42%",
    duration: 230,
    delay: -150,
    surface: "radial-gradient(circle at 30% 30%, #c4b5fd, #7c3aed 50%, #0f0a2e 90%)",
    ring: "rgba(196, 181, 253, 0.4)",
    opacity: 0.4,
  },
  {
    size: 36,
    top: "84%",
    duration: 80,
    delay: -10,
    surface: "radial-gradient(circle at 35% 30%, #fecdd3, #fb7185 55%, #4c0519 95%)",
    opacity: 0.5,
  },
];

type Cameo = { name: string; initial: string; top: string; delay: number; hue: string };

const CAMEOS: Cameo[] = [
  { name: "일론 머스크", initial: "E", top: "18%", delay: 5, hue: "#22d3ee" },
  { name: "젠슨 황", initial: "J", top: "58%", delay: 20, hue: "#a3e635" },
  { name: "마크 저커버그", initial: "M", top: "32%", delay: 35, hue: "#60a5fa" },
  { name: "샘 울트론", initial: "S", top: "74%", delay: 50, hue: "#f472b6" },
];

// 작은 우주선(오른쪽을 향함). 위 통유리 안에 얼굴 모양 아이콘을 넣어 특별 손님을 표현한다.
function CameoShip({ cameo }: { cameo: Cameo }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="120" height="56" viewBox="0 0 120 56" aria-hidden>
        {/* 뒤로 나오는 불꽃 */}
        <path d="M18,36 L2,30 L2,42 Z" fill="#fbbf24" className="animate-pulse" />
        <path d="M18,36 L8,33 L8,39 Z" fill="#fff7ed" />
        {/* 몸체 */}
        <path d="M16,36 C30,24 78,24 108,36 C80,48 36,48 16,36 Z" fill="#e2e8f0" />
        <path d="M30,40 C54,46 80,44 100,38 C80,46 50,48 30,40 Z" fill={cameo.hue} opacity="0.9" />
        {/* 통유리 돔 + 얼굴 아이콘 */}
        <ellipse cx="62" cy="26" rx="19" ry="17" fill="rgba(165,243,252,0.35)" stroke="rgba(207,250,254,0.8)" strokeWidth="1.5" />
        <circle cx="62" cy="27" r="9.5" fill="#fcd9b6" />
        <text x="62" y="31" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4c1d95">
          {cameo.initial}
        </text>
      </svg>
      <span className="rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/90">{cameo.name}</span>
    </div>
  );
}

export function SpaceScenery() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden motion-reduce:hidden" aria-hidden>
      {PLANETS.map((planet, index) => (
        <div
          key={index}
          className="scenery-fly-left absolute left-0"
          style={{
            top: planet.top,
            width: planet.size,
            height: planet.size,
            opacity: planet.opacity,
            animationDuration: `${planet.duration}s`,
            animationDelay: `${planet.delay}s`,
          }}
        >
          <div className="h-full w-full rounded-full" style={{ background: planet.surface, boxShadow: "0 0 40px rgba(168,85,247,0.25)" }} />
          {planet.ring && (
            <div
              className="absolute left-1/2 top-1/2 rounded-full border-2"
              style={{ width: planet.size * 1.9, height: planet.size * 0.5, borderColor: planet.ring, transform: "translate(-50%, -50%) rotate(-18deg)" }}
            />
          )}
        </div>
      ))}

      {CAMEOS.map((cameo) => (
        <div key={cameo.name} className="scenery-cameo absolute left-0" style={{ top: cameo.top, animationDelay: `${cameo.delay}s` }}>
          <CameoShip cameo={cameo} />
        </div>
      ))}
    </div>
  );
}
