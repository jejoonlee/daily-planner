# Life Flow 테스트 배포 가이드

이 문서는 GitHub, Supabase, Vercel을 처음 설정하는 순서입니다. 실제 Google Calendar 데이터는 테스트 배포와 동기화 검증이 끝난 뒤 운영 DB에 가져옵니다.

## 0. 현재 배포 범위

- Supabase 이메일/비밀번호 인증은 연결할 수 있습니다.
- DB 스키마와 RLS migration은 준비되어 있습니다.
- 화면의 프로젝트, 할 일, 운동, 가계부 데이터는 아직 로컬 상태입니다. 새로고침하면 샘플 데이터로 돌아옵니다.
- 예약 푸시와 Google Calendar 동기화는 아직 구현 전입니다.

따라서 이번 배포는 공개 운영이 아니라 인증·PWA·DB 구조를 확인하는 테스트 배포입니다.

## 1. GitHub 저장소 만들기

1. GitHub에서 `New repository`를 선택합니다.
2. 저장소 이름은 예를 들어 `life-flow`로 지정합니다.
3. 개인 데이터 앱이므로 우선 `Private`을 권장합니다.
4. 이미 로컬에 README와 Git 기록이 있으므로 GitHub 화면에서 README, `.gitignore`, License를 새로 만들지 않습니다.
5. 생성된 저장소 주소를 복사합니다.

로컬 프로젝트에서 다음 순서로 실행합니다. `<GITHUB_REPOSITORY_URL>`은 복사한 주소로 바꿉니다.

```bash
git switch -c codex/pre-deploy-hardening
git status
git add .
git commit -m "chore: harden app for staging deployment"
git remote add origin <GITHUB_REPOSITORY_URL>
git push -u origin codex/pre-deploy-hardening
```

GitHub에서 Pull Request를 만들고 CI가 통과하면 `main`에 병합합니다. 비밀 값이 들어 있는 `.env.local`은 절대 커밋하지 않습니다.

## 2. Supabase 프로젝트 만들기

1. Supabase Dashboard에서 `New project`를 선택합니다.
2. 프로젝트 이름과 강한 Database Password를 설정합니다.
3. 실제 사용 위치와 가까운 Region을 선택합니다.
4. 프로젝트 생성 후 Project URL과 Publishable key를 확인합니다.
5. Service role key와 Database Password는 브라우저 코드, GitHub, 채팅에 공유하지 않습니다.

Supabase CLI를 준비하고 현재 migration을 적용합니다.

```bash
npx supabase@latest init
npx supabase@latest login
npx supabase@latest link --project-ref <PROJECT_REF>
npx supabase@latest db push --dry-run
npx supabase@latest db push
npx supabase@latest migration list
```

`--dry-run` 결과에서 예상하지 않은 삭제가 보이면 실제 `db push`를 실행하지 말고 먼저 확인합니다. 이후 스키마 변경은 Dashboard에서 직접 수정하지 않고 migration 파일로 관리합니다.

## 3. 로컬 인증 연결하기

프로젝트 루트에 `.env.local`을 만들고 다음 공개 값만 먼저 입력합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
NEXT_PUBLIC_ALLOW_DEMO_LOGIN=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Supabase Dashboard에서 다음을 설정합니다.

1. `Authentication → Users`에서 본인 이메일 계정을 만듭니다.
2. `Authentication → URL Configuration`의 Site URL을 우선 `http://localhost:3000`으로 둡니다.
3. Redirect URLs에 `http://localhost:3000/**`를 추가합니다.

그 다음 앱을 확인합니다.

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
```

등록한 Supabase 이메일과 비밀번호로 로그인되는지 확인합니다.

## 4. Vercel 테스트 배포

1. Vercel에서 `Add New → Project`를 선택합니다.
2. GitHub의 `life-flow` 저장소를 Import합니다.
3. Framework Preset이 Next.js인지 확인합니다.
4. Root Directory는 저장소 루트 그대로 둡니다.
5. Environment Variables에 아래 값을 Preview와 Production 각각 등록합니다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_ALLOW_DEMO_LOGIN=false
NEXT_PUBLIC_SITE_URL=https://<운영-도메인>
```

6. Deploy를 실행하고 생성된 `https://....vercel.app` 주소를 복사합니다.
7. Supabase `Authentication → URL Configuration`에서 테스트 주소를 Redirect URLs에 추가합니다.
8. 운영 도메인이 확정되면 Supabase Site URL과 Vercel의 `NEXT_PUBLIC_SITE_URL`을 정확한 운영 주소로 바꿉니다.

Vercel Preview 주소가 배포마다 달라지는 동안에는 Supabase가 안내하는 Preview URL 패턴을 사용할 수 있지만, 운영 주소는 와일드카드가 아닌 정확한 URL을 사용합니다.

## 5. 배포 직후 확인

- 등록한 계정으로 로그인되고 새로고침 후에도 로그인 세션이 유지되는지 확인합니다.
- 모바일 화면에서 하단 메뉴가 화면 하단에 고정되는지 확인합니다.
- 할 일 월간 달력, 칸반 드래그, Alt+M 키보드 이동을 확인합니다.
- 잘못된 금액과 빈 필드가 저장되지 않는지 확인합니다.
- 모달이 ESC로 닫히고 포커스가 원래 버튼으로 돌아오는지 확인합니다.
- Android Chrome에서 `홈 화면에 추가`로 PWA를 설치합니다.
- 설정의 `테스트 알림`으로 알림 권한과 서비스 워커를 확인합니다.
- Vercel 로그에 반복 오류가 없는지 확인합니다.

## 6. 그 다음 구현 순서

1. 화면의 로컬 상태를 Supabase CRUD로 교체합니다.
2. 프로젝트, 할 일, 운동, 가계부 데이터를 사용자별 RLS로 검증합니다.
3. Google OAuth와 Calendar 동기화 테이블을 migration으로 추가합니다.
4. 테스트 캘린더로 최초 전체 동기화와 `syncToken` 증분 동기화를 검증합니다.
5. 반복 일정, 종일 일정, 삭제 일정, Asia/Seoul 시간대를 확인합니다.
6. 예약 푸시 발송 서버와 VAPID 키를 연결합니다.
7. 마지막으로 운영 DB에서 실제 Google Calendar 최초 동기화를 실행합니다.

운영 Google Calendar 데이터를 수동으로 DB에 복사하거나 테스트 DB를 운영 DB로 덮어쓰지 않습니다. 각 환경에서 OAuth 연결 후 최초 동기화를 별도로 실행합니다.
