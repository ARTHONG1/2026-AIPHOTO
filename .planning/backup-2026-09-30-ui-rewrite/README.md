# AI한컷 과학 포토부스

카메라로 사진을 찍고 배경·동작·소품을 고르면 Vertex AI(Gemini 이미지 모델)가 과학 테마 사진으로 합성해 주는 키오스크용 웹앱입니다. Next.js 15, React 18, Genkit 1.x로 만들었습니다.

화면 흐름은 처음 화면 → 촬영(5초 카운트다운, 서는 위치 안내선) → 스튜디오(배경 → 동작 → 소품 최대 3개) → 생성(약 30초) → 결과(액자 저장, QR, 원본 비교, 60초 뒤 자동 초기화)입니다. 프리셋은 배경 32개, 동작 44개, 소품 32개이며 [src/lib/presets.ts](src/lib/presets.ts)에서 관리합니다.

## 이미지 합성

한 번의 요청으로 합성합니다. 원본 사진, 얼굴 확대 사진(gemini-2.5-flash로 얼굴 위치를 찾아 자름), 배경·동작·소품 참조 이미지를 함께 보내고 "새 사람을 만들지 말고 원본을 편집하라"는 고정 지시를 붙입니다. 가상 인물로 비교했을 때 gemini-3.1-flash-image(1K)는 12~18초, gemini-3-pro-image는 1K 약 28초·2K 약 60초였고 얼굴 유지는 비슷했습니다. 배경·동작·소품 참조 이미지를 여러 장 함께 합성할 때는 Pro가 더 안정적이라 기본값은 Pro이고, Pro가 바쁘거나 실패하면 3.1 Flash로 한 번 다시 시도합니다.

## 로컬 실행

1. 의존성 설치: npm.cmd install
2. Google Cloud 인증(ADC): gcloud.cmd auth application-default login
3. 필요하면 .env.example을 .env.local로 복사해 값을 채웁니다.
4. 개발 서버: node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3012

PHOTOBOOTH_MOCK_AI=1로 실행하면 Vertex AI를 호출하지 않고 원본 사진을 결과로 돌려줍니다. 리허설이나 화면 점검용입니다.

## 환경 변수

| 이름 | 설명 |
| --- | --- |
| GOOGLE_CLOUD_PROJECT | Vertex AI 프로젝트 ID (없으면 기존 프로젝트 사용) |
| GOOGLE_CLOUD_LOCATION | Vertex AI 리전, 기본값 global |
| PHOTOBOOTH_IMAGE_MODEL | 합성 모델, 기본값 gemini-3-pro-image |
| PHOTOBOOTH_FALLBACK_MODEL | 기본 모델 실패 시 쓰는 모델, 기본값 gemini-3.1-flash-image |
| PHOTOBOOTH_IMAGE_SIZE | 1K(기본, Pro 약 30초) 또는 2K(선명, 약 60초) |
| PHOTOBOOTH_VISION_MODEL | 얼굴 위치 찾기 모델, 기본값 gemini-2.5-flash |
| CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET | QR 받기용 업로드. 없으면 QR 버튼이 안내 문구만 보여 줍니다 |
| PHOTOBOOTH_MOCK_AI | 1이면 AI 호출 생략 |

키는 저장소에 넣지 말고 .env.local 또는 App Hosting 시크릿으로 관리합니다.

## 프리셋 에셋 다시 만들기

node scripts/build-assets.mjs 를 실행하면 public/의 원본 이미지와 [scripts/pose-geometry.mjs](scripts/pose-geometry.mjs)의 포즈 정의로 public/presets/와 public/brand/를 새로 만듭니다. 동작 44개는 모두 같은 좌표 정의에서 그려서 한 가지 스타일로 맞춥니다. 카드에는 색이 있는 SVG를, AI에는 팔다리 방향만 담은 흑백 PNG를 보냅니다. --sheet 옵션을 주면 포즈 전체 미리보기 이미지를 임시 폴더에 저장합니다.

배경과 소품은 모두 참조 이미지로 AI에 전달됩니다. 새 항목은 원본 PNG를 assets-src/backgrounds/ 또는 assets-src/props/에 <id>.png로 넣고(소품은 흰 배경), presets.ts에 같은 id로 bgImage/propImage 항목을 추가한 뒤 build-assets.mjs를 다시 실행합니다.

## 배포 (Firebase App Hosting)

apphosting.yaml에 런타임 설정이 있습니다. Cloudinary를 쓰려면 firebase apphosting:secrets:set 으로 시크릿을 만든 뒤 apphosting.yaml의 주석을 해제합니다. App Hosting 서비스 계정에 Vertex AI 사용자 역할이 필요합니다.

## 라이선스

Michael Bleigh의 Magic Markup(Apache License 2.0)을 바탕으로 인천봉수초 교사 홍찬우가 만든 2차 창작물입니다. 자세한 내용은 앱의 저작권 안내와 LICENSE를 참고하세요.
