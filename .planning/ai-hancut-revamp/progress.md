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
- Git 변경 정리 및 커밋 준비
