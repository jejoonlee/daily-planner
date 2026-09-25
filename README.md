# Life Flow

일정, 할 일, 프로젝트, 운동, 가계부와 아침 푸시 알림을 제공하는 개인용 PWA입니다.

## 시작하기

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. Supabase를 연결하기 전 목업 화면을 확인하려면 `.env.local`에서 `NEXT_PUBLIC_ALLOW_DEMO_LOGIN=true`로 설정하세요. 운영 환경에서는 이 값을 반드시 `false`로 유지해야 합니다. 현재 데이터 화면은 로컬 상태로 동작하며, Supabase 영구 저장 연결은 다음 구현 단계입니다.

계정 생성부터 테스트 배포까지는 [배포 가이드](docs/deployment.md)를 순서대로 따라가세요.

## 검증

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## GitHub 작업 방식

1. `feat/...` 또는 `fix/...` 브랜치를 만듭니다.
2. 변경 사항과 DB migration을 함께 커밋합니다.
3. Pull Request를 만들고 CI와 Preview 배포를 확인합니다.
4. Squash merge로 `main`에 반영합니다.

## 주요 경로

- `src/components/life-flow-app.tsx`: 현재 앱 UI와 사용자 흐름
- `src/app/manifest.ts`: PWA manifest
- `public/sw.js`: 서비스 워커와 푸시 알림 처리
- `supabase/migrations`: 데이터베이스 스키마와 RLS
- `.github/workflows/ci.yml`: GitHub Actions 검증
