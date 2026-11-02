# 배포 준비 안내

> PLAN 작업 15. 이 문서에는 **값이 없고 이름만** 있습니다. 비밀 값은 `.env`와 Vercel 환경 변수에만 적습니다.
> 실제 배포는 Part 5에서 합니다.

## 1. 환경 변수 목록

| 이름 | 용도 | 어디에 넣나 | 비고 |
|------|------|------------|------|
| `DATABASE_URL` | DB(PostgreSQL) 접속 주소 | `.env`, Vercel | 비밀 값. Neon에서 받은 주소를 그대로 넣는다. |
| `SESSION_SECRET` | 로그인 증표를 서명하는 비밀 값 | `.env`, Vercel | 32자 이상의 무작위 문자열. 아래 명령으로 만든다. |
| `INITIAL_ADMIN_ID` | 첫 관리자 아이디 | `.env` (시드 실행할 때만) | 운영 DB에 시드를 한 번 넣을 때만 필요하다. |
| `INITIAL_ADMIN_PASSWORD` | 첫 관리자 비밀번호 | `.env` (시드 실행할 때만) | 8자 이상, 영문+숫자. 시드 뒤에는 `.env`에서 지워도 된다. |
| `INITIAL_ADMIN_NAME` | 첫 관리자 이름 | `.env` (선택) | 없으면 "관리자"로 만든다. |

- `NEXT_PUBLIC_`으로 시작하는 이름은 쓰지 않는다. (브라우저에 그대로 노출된다)
- `.env`는 GitHub에 올리지 않는다. (`.gitignore`에 등록되어 있다)

`SESSION_SECRET`으로 쓸 무작위 문자열은 터미널에서 이 명령으로 만든다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. 처음 한 번만 하는 일 (운영 DB 준비)

1. **DB 만들기**: Vercel Marketplace의 Neon(PostgreSQL)에서 데이터베이스를 만들고 접속 주소를 받는다.
2. **`.env`에 넣기**: 위 표의 `DATABASE_URL`, `SESSION_SECRET`, `INITIAL_ADMIN_ID`, `INITIAL_ADMIN_PASSWORD`를 직접 적는다.
3. **표 만들기**: 아래 명령으로 `drizzle/` 폴더의 SQL을 DB에 적용한다. (표 6개와 변경 이력 수정 방지 장치가 만들어진다)

   ```bash
   npm run db:migrate
   ```

4. **서비스 6개와 첫 관리자 넣기**: 서비스 이름은 `lib/db/seed-data.ts`에서 실제 이름으로 바꾼 뒤 실행한다. 다시 실행해도 안전하며, 서비스 이름만 갱신된다.

   ```bash
   npm run seed
   ```

5. 이후 계정은 앱의 **계정 관리** 화면에서 추가한다.

> 개발용 시험 데이터(`npm run seed:dev -- --yes`)는 운영 DB에 넣지 않는다.

## 3. Vercel에 올릴 때 (Part 5)

- Vercel 프로젝트의 환경 변수에 `DATABASE_URL`, `SESSION_SECRET`을 넣는다. (`INITIAL_ADMIN_*`는 넣지 않아도 된다)
- 배포 전에 `npm run lint`, `npm test`, `npm run build`가 통과하는지 확인한다.
- PDF 증적자료의 한글 글꼴은 `next.config.ts`의 `outputFileTracingIncludes`로 배포 파일에 포함된다.
- 모든 통신은 HTTPS이며 Vercel이 기본으로 제공한다. 로그인 쿠키는 운영에서 `Secure`로 설정된다.

## 4. DB 없이 화면 먼저 보기

실제 DB를 만들기 전에도 내 컴퓨터에서 화면을 확인할 수 있다. 임시 DB(메모리)와 앱이 함께 뜨고, 종료하면 데이터가 사라진다. `.env`와 운영 DB에는 영향이 없다.

```bash
npm run dev:local
```

접속 주소는 `http://localhost:3100`이고, 로컬 확인용 계정(관리자 `admin`, 조회자 `viewer`)은 터미널에 표시된다.

## 5. 자주 쓰는 명령

| 명령 | 하는 일 |
|------|--------|
| `npm run dev` | 개발 서버 (`.env`의 DB를 쓴다) |
| `npm run dev:local` | 임시 DB와 함께 화면 확인 |
| `npm test` | 자동 시험 (계산, 로그인, 입력, 증적자료 등) |
| `npm run lint` / `npm run build` | 코드 검사 / 배포용 빌드 |
| `npm run db:generate` | DB 구조(`lib/db/schema.ts`)를 바꾼 뒤 SQL 파일 만들기 |
| `npm run db:migrate` | SQL 파일을 DB에 적용 |
| `npm run seed` | 서비스 6개와 첫 관리자 넣기 |
