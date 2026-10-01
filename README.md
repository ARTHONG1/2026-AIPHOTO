# AI한컷 과학 포토부스

카메라로 사진을 찍고 배경·동작·소품을 고르면 Vertex AI(Gemini 이미지 모델)가 과학 테마 사진으로 합성해 주는 키오스크용 웹앱입니다. Next.js 15, React 18, Genkit 1.x로 만들었습니다.

화면 흐름은 처음 화면 → 촬영(10초 카운트다운) → 스튜디오(배경 → 동작 → 소품, 최대 3개) → 생성(30초~1분) → 결과(프레임 선택, 인쇄·저장, QR, 60초 뒤 자동 초기화)입니다. 프리셋은 배경 32개, 동작 44개, 소품 32개이며 [src/lib/presets.ts](src/lib/presets.ts)에서 관리합니다.

## 인쇄 프레임

결과 화면에서 프레임 10가지 중 하나를 고릅니다. 기본은 제28회 인천과학대제전 공식 포스터의 제목과 그림으로 만든 과학대제전 프레임이고, 심플·필름·우주·실험 노트·과학자 ID·매거진·네온·레트로 게임·힘찬이가 있습니다. 모든 결과물은 4×6인치(10×15cm) 세로 한 장, 1200×1800px, 300dpi JPEG이라 포토 프린터에서 늘어나거나 여백 없이 그대로 뽑힙니다. 인쇄 버튼은 용지를 4×6인치, 여백 0으로 지정해 브라우저 인쇄 창을 엽니다. 프린터 설정에서 용지 4×6(10×15cm), 테두리 없음, 배율 100%를 고르면 됩니다. 테두리 없이 뽑으면 가장자리가 2~3% 잘리므로 글자는 가장자리에서 45px 이상 안쪽에 둡니다.

프레임 정의(사진 칸 위치, 날짜 위치)는 [src/lib/frames.ts](src/lib/frames.ts)에 있고, 그림은 node scripts/build-frames.mjs 로 public/frames/에 만듭니다. 이 스크립트는 HTML로 그린 프레임을 Chrome 헤드리스로 캡처해 사진 칸을 뚫고, 날짜용 숫자 글꼴을 작게 잘라 둡니다. Chrome과 Python fontTools(brotli 포함)가 필요하고, --sheet 를 주면 전체 미리보기를 임시 폴더에 저장합니다. 원본 포스터와 글꼴은 assets-src/frames/, assets-src/fonts/에 있습니다.

## 이미지 합성

AI 합성은 한 번의 요청입니다. 원본 사진, 얼굴 확대 사진, 배경·동작·소품 참조 이미지를 함께 보내고, "그 장소에서 한 장으로 찍은 실사 사진"을 허벅지 중간까지 오는 구도로 만들되 얼굴은 바꾸지 말고 동작 안내 그림의 팔다리 방향을 따르라는 지시를 붙입니다. 모델은 gemini-3-pro-image(1K)만 씁니다. 보통 25~35초 걸리고, 요청이 몰리면 1분을 넘기도 합니다.

AI는 사람을 새로 그리기 때문에 얼굴이 조금씩 달라집니다. 그래서 합성이 끝나면 서버에서 방문객의 실제 얼굴을 합성 사진의 얼굴 자리에 옮겨 붙입니다([src/ai/face.ts](src/ai/face.ts)). OpenCV YuNet(opencv-js)으로 두 사진의 눈·코·입 위치를 찾아 맞추고, 합성 사진의 밝기·색·조명에 맞춘 뒤 눈썹부터 턱까지만 부드럽게 섞습니다. 머리카락, 모자, 포즈, 배경은 AI가 그린 그대로입니다. API 호출 없이 1~3초 걸립니다. 고개를 많이 돌렸거나 표정이 크게 다르거나 모자 그림자·손 등으로 얼굴이 가려진 경우, 그리고 얼굴을 덮는 소품(사이버 마스크, VR 헤드셋, 보안경, AI 안경)이나 쉿·쌍안경 동작에서는 옮겨 붙이지 않고 AI 결과를 그대로 씁니다. 가상 인물 테스트에서 얼굴 유사도(OpenCV SFace)는 AI 결과 0.49~0.75에서 옮겨 붙인 뒤 0.72~0.88로 올라갔습니다.

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
| PHOTOBOOTH_FALLBACK_MODEL | 기본 모델이 오류를 낼 때 한 번 다시 시도할 모델. 기본값은 비어 있음(Pro만 사용) |
| PHOTOBOOTH_IMAGE_SIZE | 1K(기본) 또는 2K(선명하지만 Pro 약 60초로 1분 목표를 넘김) |
| PHOTOBOOTH_FACE_TRANSFER | 0이면 얼굴 옮겨 붙이기를 끔 |
| PHOTOBOOTH_STORAGE_BUCKET | AR 라이브 포토 및 인쇄본 저장용 Firebase/GCP 버킷 (기본값: ai-hancut-photos-699923719631) |
| PHOTOBOOTH_MOCK_AI | 1이면 AI 호출 생략 |

키는 저장소에 넣지 말고 .env.local 또는 App Hosting 시크릿으로 관리합니다.

## AR 라이브 포토 (Live Photo)

결과 화면에서 "AR 라이브 포토 받기 (QR)"를 누르면 고유 QR 코드가 생성됩니다. 스마트폰 카메라로 스캔하면 전용 웹 뷰어(`/live/[id]`)로 접속합니다.

- **인터랙티브 라이브 모션:** 사진을 터치하거나 재생 버튼을 누르면 부드러운 3D 패럴랙스 줌과 반짝이는 과학 파티클 효과, 미래지향적 사운드가 재생됩니다.
- **AR 카메라 모드:** 스마트폰 후면 카메라를 켜서 인쇄된 종이 사진을 비추면, 증강현실(AR)로 종이 위에서 움직이는 홀로그램 사진이 재생됩니다.
- **스마트폰 저장:** 1200×1800 300dpi 원본 인쇄 사진 다운로드와 3초짜리 움직이는 라이브 영상(MP4/WebM) 저장을 지원합니다.
- **저장소:** 외부 서비스 없이 프로젝트의 Firebase / Google Cloud Storage 버킷(`ai-hancut-photos-699923719631`)에 안전하게 저장됩니다.

## 프리셋 에셋 다시 만들기

node scripts/build-assets.mjs 를 실행하면 public/의 원본 이미지와 [scripts/pose-geometry.mjs](scripts/pose-geometry.mjs)의 포즈 정의로 public/presets/와 public/brand/를 새로 만듭니다. 동작 44개는 모두 같은 좌표 정의에서 그려서 한 가지 스타일로 맞춥니다. 카드에는 색이 있는 SVG를, AI에는 팔다리 방향만 담은 흑백 PNG를 보냅니다. --sheet 옵션을 주면 포즈 전체 미리보기 이미지를 임시 폴더에 저장합니다.

배경과 소품은 모두 참조 이미지로 AI에 전달됩니다. 새 항목은 원본 PNG를 assets-src/backgrounds/ 또는 assets-src/props/에 <id>.png로 넣고(소품은 흰 배경), presets.ts에 같은 id로 bgImage/propImage 항목을 추가한 뒤 build-assets.mjs를 다시 실행합니다.

## 배포 (Firebase App Hosting)

apphosting.yaml에 런타임 설정이 있습니다. App Hosting 서비스 계정에 Vertex AI 사용자 역할이 필요합니다.

## 라이선스

Michael Bleigh의 Magic Markup(Apache License 2.0)을 바탕으로 인천봉수초 교사 홍찬우가 만든 2차 창작물입니다. 자세한 내용은 앱의 저작권 안내와 LICENSE를 참고하세요.

