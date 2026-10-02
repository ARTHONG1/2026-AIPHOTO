# Progress
## Session 2026-09-29
- 현황 파악, 계획 작성
- 에셋 생성, 카탈로그·서버 플로우·UI 재작성, 빌드·브라우저 검증, 문서화 완료
- App Hosting 첫 배포(build-001) 실패: src/app/page.tsx 1행에 'l.co' 혼입 → 수정 후 build-002 배포 성공(/, /booth, /studio 200)
- 로비 제목 3D 글자·빛줄기 연출로 재작성(잘림 수정), 합성 프롬프트 재작성(재조명·단일 신체·장면 물리), 출력 2:3 2K, 입력 1536px, 모델은 PHOTOBOOTH_IMAGE_MODEL로 교체 가능 → 배포
- 얼굴 유지: '전체 다시 그리기' 문구가 새 얼굴을 만들던 원인 → 편집 고정(LOCK) 프롬프트, gemini-2.5-flash 얼굴 검출 + 얼굴 확대 참고 이미지(src/ai/face.ts), 얼굴만 다듬는 2차 패스(PHOTOBOOTH_FACE_REFINE=0으로 끔). 가상 인물로 실제 생성 비교 후 배포, 배포 서버에서 산호초+우주 유영+망토 성공 확인. sharp 0.33.5 명시
## Session 2026-09-30
- 모델 실측(가상 인물): 3.1-flash-image 1K 12~18초, 3-pro-image 1K ~28초/2K ~60초, 얼굴 유지 비슷 → 기본 3.1 Flash 1K 1회 합성, 실패 시 Pro 대체, 2차 패스 제거. 배포 사이트 실측 13.4초
- 동작 44개를 pose-geometry 한 스타일로 통일(카드용 컬러 SVG, 모델용 흑백 PNG)
- UI 재작성: 촬영(서는 위치 실루엣, 5초 링 카운트다운), 스튜디오(단계 진행 표시, 고른 것 트레이, 카테고리 개수, 소품 순서), 생성 화면(단계 진행), 결과(원본 비교, QR 중 타이머 멈춤), 토스트, 모바일 390px 확인
- 사용자 요청으로 기본 모델을 gemini-3-pro-image(1K)로 변경, 대체 모델은 3.1 Flash. 생성 화면 예상 시간 30초로 조정. 배포는 아직 안 함
- build-006 배포 후 사용자 피드백: 새 UI가 이전보다 별로, 동작 통일만 원했음 → 촬영·스튜디오·생성·결과 화면과 globals.css, toast를 build-004(직전 UI) 소스로 되돌림. 동작 통일(SVG/PNG)과 Pro 1회 합성은 유지. 새 UI는 .planning/backup-2026-09-30-ui-rewrite/에 보관
- build-007 배포(UI 복원). 합성 품질: 원인은 편집형 프롬프트(배경 앞에 오려 붙인 느낌, 동작 불일치). "현장 한 장 촬영" 프롬프트(TASK→IDENTITY→SCENE→POSE→ITEM→LIGHT→RULES)로 교체, 가상 인물 Pro 1K로 열대우림+티포즈+화석, 우주정거장+손흔들기+가운+비커, 산호초+브이+헬멧 확인(약 25~30초). 배경 이미지를 앞에 두면 소품이 복제돼서 제외
- 이어서: src/app/page.tsx 1행 혼입 문자열('dldjtj wlsgodgo', 한/영 전환 누락 입력) 제거, tsc·next build(임시 복사본) 통과, 새 합성 프롬프트 포함해 App Hosting 배포 완료(photo011235 계정). 배포 사이트 /, /booth, /studio 응답 확인
- 얼굴 보존: SFace 유사도로 측정(가상 인물). 원인 1) 머리~무릎 구도라 얼굴이 1K에서 약 70px로 작게 그려짐 → 허벅지 중간 구도로 변경. 2) 모델이 얼굴을 매번 새로 그림 → 합성 후 실제 얼굴을 YuNet(opencv-js, public/models) 5점으로 맞춰 옮겨 붙이는 로컬 단계(src/ai/face.ts, 1~3초, API 없음). AI 결과 0.49~0.75 → 0.72~0.88. Gemini로 얼굴 다시 그리기 2차 패스는 +10~29초에 효과가 들쭉날쭉해서 버림. Gemini 좌표는 눈 거리 25~250% 오차라 정렬에 못 씀. 가드: 잔차 0.09, 고개 0.2, 가림 0.45, 얼굴 덮는 소품·쉿/쌍안경 제외, 손/모자 근처는 눈썹~입만
- 시간: Pro 1K 23~36초, 부하 시 44~71초 → 38초 넘으면 Flash(12~18초)로 전환. 생성 화면 문구 "30초~1분". apphosting memoryMiB 1024(opencv-js 약 80MB 추가)
- 사용자 요청: Pro만 사용. 38초 제한과 Flash 전환 제거, PHOTOBOOTH_FALLBACK_MODEL 기본값 비움(apphosting.yaml에서도 삭제). 오류 시 재시도 모델은 환경 변수로만 켤 수 있음
## Session 2026-10-01
- 사용자 요청: 네컷 대신 1컷, 포토 프린트 크기에 맞춘 위아래 제목 프레임 여러 개를 결과 화면에서 고르기
- src/lib/frames.ts(프레임 10개: 과학대제전 기본, 심플, 필름, 우주, 실험 노트, 과학자 ID, 매거진, 네온, 레트로 게임, 힘찬이), scripts/build-frames.mjs(HTML → Chrome 헤드리스 캡처 → 사진 칸 뚫기, 날짜 숫자 글꼴 woff2 서브셋), public/frames/
- 과학대제전 프레임은 사용자 프레임.png(600x1800)를 키우지 않고 공식 포스터(2480x3484)에서 제목을 남색 배경 기준으로 따 내고 소녀·로봇·도시 그림을 씀
- 결과: 1200x1800 JPEG, JFIF 300dpi(4x6in). 인쇄는 @page 4in 6in margin 0. Playwright로 결과 화면·프레임 전환·크기·밀도, PDF 1쪽 288x432pt 확인. 모바일 390px 확인. tsc, next build 통과. 배포는 안 함
## Session 2026-10-02
- tsc, next build 검증 통과
- 1컷 프레임 10종, Pro 단독 설정, 얼굴 보존 모듈 포함 최신 버전 Firebase App Hosting 배포 완료 (/, /booth, /studio, /frames/festival.webp 200 응답 확인)
- Git 변경 정리 및 원격(origin/main) 푸시 완료 (커밋 136cdad)
- AR 라이브 포토 기능 구현:
  - Cloudinary 의존성 제거, 프로젝트 자체 Firebase/GCP Cloud Storage 버킷(ai-hancut-photos-699923719631) 생성 및 연동
  - src/lib/storage.ts(사진 및 메타데이터 업로드/조회), src/app/actions.ts(uploadForQrAction)
  - /live/[id] AR 라이브 포토 웹 뷰어(src/app/live/[id]/page.tsx, src/components/live/live-photo-view.tsx): 터치 반응형 3D 패럴랙스 줌·파티클 애니메이션, 스마트폰 후면 카메라 기반 AR 오버레이 모드, 3초 라이브 영상(MP4/WebM) 갤러리 저장, 4x6 고화질 인쇄본 저장 지원
  - 결과 화면(src/components/studio/result-view.tsx)의 QR 생성 버튼을 AR 라이브 포토 연동으로 업그레이드
- AR 라이브 포토가 휴대폰에서 빈 화면으로 보이던 문제 수정: 버킷에 CORS 헤더가 없어 crossOrigin 이미지 로딩이 실패함. /api/live/[id]/photo 같은 주소 경유로 사진 제공, 로딩·실패 안내, AR 전환 시 애니메이션 재시작. 다른 세션이 바꾼 프로젝트 기본값(.firebaserc, genkit.ts, storage.ts의 project-0c1d3dab)은 원래 project-1e3fbae0로 되돌림(로컬은 .env.local 사용). 커밋 fab8a44, App Hosting 배포 완료, 배포본 /live/Lrr3xTzX 사진 표시 확인

## Session 2026-10-03 — 렌즈 효과 작업 재개
- 작업 시작 시 남아 있던 변경: 전신 인물 분할 보강(전체 + 확대 영역 마스크), 인물 위치 기반 초점 영역, 패닝 가장자리 보존, 합성 인물 크기 프롬프트.
- Playwright CLI로 기존 jump.png에 보케/패닝/틸트시프트/소프트포커스 적용: 모두 PNG 1024x1536 출력. 처리 시간 1519/782/694/175ms (별도 최초 패닝 모델 로딩 포함 5643ms). 네 화면 스크린샷 직접 확인.
- 삭제된 dev-lens 페이지의 .next/types 생성 캐시 제거 후 npm.cmd run typecheck 통과.
- TEMP 주석이 있는 lens-test 화면, lens-test-generate API, public/__lens-test 이미지를 .planning/lens-verification-2026-10-03/로 이동해 보존. 생성 API는 호출하지 않음.
- 임시 화면 생성 타입도 정리한 뒤 typecheck 재통과. 제품 코드 수정은 기존 변경을 유지함.
- 스크린샷: .playwright-cli/lens-{bokeh,panning,tilt-shift,soft-focus}.png
- 이번 세션에서는 프로덕션 빌드, 실제 AI 합성, 인쇄/QR 전체 흐름, 배포는 수행하지 않음.

## Session 2026-10-03 — 최종 검증·배포·Git 반영
- 사용자 승인: 렌즈 효과 작업 전부 끝까지 마무리(실제 합성, 검증, 배포, Git 반영).
- 변경 검토: 전신 인물의 전체/확대 영역 분할 마스크 병합, 실제 인물 중심을 따르는 보케 초점, 패닝 윤곽 보존, 전신 구도 인물 크기 및 패닝 프롬프트 유지.
- .planning/lens-verification-*/를 Git 제외: 임시 테스트 사진/API 백업은 로컬에 보존. Firebase는 기존 .planning 제외 설정을 사용.
- npm.cmd run typecheck 및 git diff --check 통과. 격리 복사본에서 npm.cmd run build 통과(Next 15.0.7, 제품 경로만 포함). 기존 Genkit/OpenTelemetry의 선택적 exporter-jaeger 의존성 경고 존재.
- 가상 인물(subject.jpg, 기존 생성 스크립트에서 fictional Korean man으로 생성한 자료)로 Pro 1K 실제 패닝 합성 성공: 31.9초. 얼굴 각도/표정 차이 보호 조건(residual 0.474)으로 얼굴 옮겨 붙이기는 생략.
- 브라우저 검증: 최초 Playwright CLI 자동화는 홈 useEffect 세션 초기화와 주입 시점 경쟁, 이후 PC 메모리 부족(가용 약 180MB)으로 지연. 작업용 Playwright 세션 닫고 Chrome DevTools 격리 세션으로 최종 검증 완료. 제품 동작 변경 없음.
- 프로덕션 빌드의 모의 AI로 네 효과 모두 실제 결과 화면 진입 및 1200x1800 출력·스크린샷 확인. 프레임 10종 전환, JPEG 300x300dpi, 저장 링크 생성, 인쇄 호출(실제 종이 출력은 생략, print stub)과 4in x 6in margin 0 스타일 확인.
- QR 실제 업로드 성공: /live/PE-rYBky (가상 인물의 소프트포커스 검증 출력). 배포된 라이브 페이지의 canvas 720x1080 사진/파티클 표시 및 모바일 가로 넘침 없음 확인. 라이브 페이지는 img가 아닌 canvas 렌더링임.
- Firebase CLI(photo011235 계정)로 apphosting:ai-hancut 배포 성공.
- 배포 URL: https://ai-hancut--project-1e3fbae0-3a3e-4723-ae1.asia-east1.hosted.app
- 배포본 /, /booth, /studio, /frames/festival.webp, /api/live/PE-rYBky/photo 모두 200. /lens-test, /api/lens-test-generate, /__lens-test/base.png 모두 404(임시 자료 제거 확인).
- 실제 카메라/프린터 하드웨어 촬영·출력은 검증하지 않음. 기존 카메라/AR 코드는 변경하지 않음.
- 스크린샷: .playwright-cli/final-result.png, final-bokeh.png, final-panning.png, final-tilt-shift.png, final-live-mobile.png. Git에 사진·키 포함하지 않음.

## 2026-10-03 기본 클로즈업과 원본 얼굴 유지
- 사용자 제약: Google 모델만, 촬영은 한 장. 기본은 클로즈업, 선택한 구도에서만 전신/넓은 배경을 보여 줌.
- 기본 머리~가슴 위 클로즈업; 다리/넓은 팔 포즈도 기본 구도를 넓히지 않고 보이는 부분만 표현. 배경 참조는 장소/색/분위기의 참조이며 전체 풍경 재현을 요구하지 않음.
- 구도 지시와 얼굴 각도 유지의 충돌 제거. 명시적으로 다른 얼굴 시점을 고른 경우만 각도 변경. 포즈 안내는 팔다리만, 조명은 얼굴 윤곽/피부/표정을 바꾸지 않도록 지시.
- Gemini 3 Pro 1K, 한 번 생성 유지. 출력 4:5(공식 Google SDK 문서 및 설치된 Genkit 스키마 지원 확인); 프레임 창의 수직 잘림을 줄임. 전신은 높이 86% 목표, 넓은 포즈는 가로 여유와 자연스러운 비율 우선. 모델이 수치 위치를 정확히 지키는 것은 보장하지 않음.
- 카메라 ideal 1920x1440: 같은 한 장에서 원본 얼굴 디테일 확보, 낮은 해상도 장비는 ideal 제약으로 기존 해상도 허용. 업스케일하지 않음.
- 기존 가상 인물 사진으로 Google 실제 합성 7회(전후 4회 및 지시 수정/최종 구도 확인 3회). 중간 기본 구도가 전신으로 돌아가는 현상 발견, 기본/전신 조건을 분리한 뒤 최종 클로즈업 결과 확인. 최종 클로즈업 35.5초, 풀샷 33.5초(표본 1개씩).
- 얼굴 복원이 일부 조명에서 mismatch 0.47~0.64로 생략됨. 안전 제한은 완화하지 않았으며 원본과 동일한 얼굴이나 모든 조합의 품질 개선을 보장하지 않음.
- Playwright CLI: 가상 1920x1440 카메라로 요청 1회, 촬영본 960x1440, 촬영 -> studio 진입 확인. 실제 하드웨어는 미검증. 최종 클로즈업 4:5 결과로 프레임 10종 1200x1800 모두 확인, 모바일 가로 넘침 및 pageerror 없음.
- 검증 사진/스크립트는 .planning/lens-verification-2026-10-03-identity 및 로컬 Temp/.playwright-cli에만 보관, 저장소/배포 자료에 포함하지 않음.
