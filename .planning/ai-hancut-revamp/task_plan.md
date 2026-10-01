# Task Plan: AI한컷 포토부스 로컬 복원 + 전면 리디자인

## Goal
Firebase Studio에서 가져온 포토부스를 로컬에서 개발·App Hosting 배포 가능한 상태로 복원하고, 렉 없는 새 디자인과 배경/포즈/소품 각 30개 이상으로 확장한다.

## Current Phase
Complete (실제 Vertex AI 호출 검증만 남음)

## Phases
- [x] Phase 1 현황 파악
- [x] Phase 2 에셋 파이프라인 (scripts/build-assets.mjs, pose-geometry.mjs)
- [x] Phase 3 프리셋 카탈로그(src/lib/presets.ts: 배경 32, 동작 44, 소품 32) + id 기반 서버 플로우, 오류 객체 반환, env 기반 Vertex 설정, PHOTOBOOTH_MOCK_AI
- [x] Phase 4 UI 재작성: / → /booth → /studio(단계형 + 결과), /editor는 /studio로 리다이렉트, 세션은 메모리+sessionStorage, JPEG 1024px
- [x] Phase 5 tsc 통과, next build 통과(임시 복사본), Playwright로 전체 흐름 확인(모의 AI, 가짜 카메라)
- [x] Phase 6 README, .env.example, apphosting.yaml

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 새 요소는 코드 생성(SVG 포즈, 텍스트 프롬프트 배경/소품) | 내장 image_gen 403, Vertex 대량 생성은 사용자 과금 |
| 이미지 생성 API 실제 호출 안 함 | AGENTS.md 제한 |
| 모델(gemini-3-pro-image), responseModalities 유지 | 기존에 동작 확인된 구성 |
| 구 에디터(하이라이트/주석) 제거 | 새 흐름에서 진입점 없음, git으로 복구 가능 |
| 커밋하지 않음 | 사용자 명시 요청 없음 |
