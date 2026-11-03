// 개발용 시험 데이터 실행. 운영 DB에는 실행하지 않는다.
// 실행: npm run seed:dev   (실수로 운영 DB에 넣지 않도록 --yes를 붙여야 한다)
import { getDb } from "../lib/db";
import { seedDev } from "../lib/db/seed-dev";

async function main() {
  if (!process.argv.includes("--yes")) {
    throw new Error("개발용 DB에만 실행하세요. 확인했다면 --yes를 붙여 다시 실행합니다.");
  }

  const result = await seedDev(getDb());
  console.log(`시험용 월 입력 ${result.monthlyInputCount}건, 설문 설정값 ${result.settingCount}건, 인프라 지표 ${result.infraCount}건을 확인했습니다.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
