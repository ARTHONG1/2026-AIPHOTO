# AI한컷 과학 포토부스

카메라로 사진을 찍고 배경·동작·소품·구도를 고르면 Vertex AI(Gemini 이미지 모델)가 과학 테마 사진으로 합성해 주는 키오스크용 웹앱입니다. Next.js 15, React 18, Genkit 1.x로 만들었습니다.

화면 흐름은 처음 화면 → 촬영(10초 카운트다운) → 스튜디오(배경 → 동작 → 소품, 최대 3개 → 구도) → 생성(30초~1분) → 결과(프레임 선택, 인쇄·저장, QR, 60초 뒤 자동 초기화)입니다. 프리셋은 배경·동작·소품·구도 각 50개이며 [src/lib/presets.ts](src/lib/presets.ts)에서 관리합니다.

구도는 실제 촬영 기법만 담았고 줌인·줌아웃, 카메라 각도, 자리 잡기, 렌즈, 빛과 노출, 셔터와 특수 기법으로 나뉩니다. 구도는 그림 없이 글 지시로만 AI에 전달되고, 고르지 않으면 기본 클로즈업(머리부터 가슴 위까지)를 씁니다. 더치앵글과 어안 렌즈는 AI가 정확히 그리지 못해서, 생성이 끝난 뒤 서버에서 사진을 12도 돌려 잘라 내거나 가운데를 볼록하게 왜곡합니다. 아웃포커스, 패닝, 틸트시프트, 소프트 포커스도 AI 결과만으로는 효과가 약해서, 결과를 받은 직후 브라우저에서 마무리합니다([src/lib/lens-effects.ts](src/lib/lens-effects.ts)). MediaPipe로 사람을 오려 내고 사람만 또렷하게 둔 채 배경만 흐리거나(아웃포커스, 빛망울 포함) 옆으로 흘리고(패닝), 사람 높이의 띠만 남기고 위아래를 흐립니다(틸트시프트). 롱샷처럼 얼굴이 작아지는 구도에서는 얼굴 닮은 정도가 기본 구도보다 낮을 수 있습니다.

결과 화면과 QR로 여는 라이브 포토(/receive/[id])에서는 사진을 누르면 크게 볼 수 있습니다([src/components/photo-zoom.tsx](src/components/photo-zoom.tsx)). 라이브 포토에는 스티커 꾸미기와 AR 카메라가 있습니다. 스티커는 과학 스티커 16종(SVG)과 이모지 16종이며([src/components/live/stickers.ts](src/components/live/stickers.ts)), 끌어서 옮기고 손잡이나 두 손가락으로 크기·방향을 바꿉니다. 스티커 위치·크기·방향만 그 휴대폰의 localStorage에 남고 사진 자체는 저장하지 않습니다. 꾸민 결과는 고화질 저장과 라이브 영상에 함께 들어갑니다. AR 카메라([src/components/live/ar-camera.tsx](src/components/live/ar-camera.tsx))의 기본 효과 '사진 속으로'는 MediaPipe Image Segmenter로 사람만 오려 내고, 사진과 함께 전달받은 배경 ID에 해당하는 원본(사람 없는 배경)을 뒤에 깝니다. 배경 빛에 맞춰 사람 색을 보정하고, 윤곽에 빛 테두리와 별가루를 더하며, 고개를 움직이면 배경이 따라 움직입니다. 배경은 화면에서 바꿀 수 있습니다. 그 밖에 MediaPipe Face Landmarker로 얼굴을 따라가는 우주 헬멧, 아인슈타인 머리, 실험 고글, 행성 왕관, 아이디어 전구, 내 사진 홀로그램이 있습니다. 모든 효과에서 표정 마법이 작동합니다(입 크게 벌리기는 로켓, 눈 꼭 감기는 번개, 눈썹 올리기는 별과 행성, 활짝 웃기는 반짝이와 하트). 사진과 5초 영상으로 저장하고 공유할 수 있습니다. MediaPipe wasm(jsDelivr)과 얼굴 모델(Google Storage)은 AR 카메라를 열 때 CDN에서 받습니다.

결과 화면의 `전후 비교`와 휴대폰의 `변신 전후 비교 보기`를 누르면 원본 사진과 AI 사진을 손잡이로 밀어 비교할 수 있습니다([src/components/before-after.tsx](src/components/before-after.tsx)). 두 사진은 AI 사진과 같은 4:5 틀에 맞추고, 원본은 머리가 잘리지 않도록 위를 덜 자릅니다. 비교는 보기 전용이라 저장·인쇄·QR·공유는 지금처럼 최종 완성본만 사용합니다. 프레임을 고르면 완성 사진 보기로 돌아갑니다.

## 인쇄 프레임

결과 화면에서 프레임 10가지 중 하나를 고릅니다. 기본은 제28회 인천과학대제전 공식 포스터의 제목과 그림으로 만든 과학대제전 프레임이고, 심플·필름·우주·실험 노트·과학자 ID·매거진·네온·레트로 게임·힘찬이가 있습니다. 모든 결과물은 4×6인치(10×15cm) 세로 한 장, 1200×1800px, 300dpi JPEG이라 포토 프린터에서 늘어나거나 여백 없이 그대로 뽑힙니다. 인쇄 버튼은 용지를 4×6인치, 여백 0으로 지정해 브라우저 인쇄 창을 엽니다. 프린터 설정에서 용지 4×6(10×15cm), 테두리 없음, 배율 100%를 고르면 됩니다. 테두리 없이 뽑으면 가장자리가 2~3% 잘리므로 글자는 가장자리에서 45px 이상 안쪽에 둡니다.

프레임 정의(사진 칸 위치, 날짜 위치)는 [src/lib/frames.ts](src/lib/frames.ts)에 있고, 그림은 node scripts/build-frames.mjs 로 public/frames/에 만듭니다. 이 스크립트는 HTML로 그린 프레임을 Chrome 헤드리스로 캡처해 사진 칸을 뚫고, 날짜용 숫자 글꼴을 작게 잘라 둡니다. Chrome과 Python fontTools(brotli 포함)가 필요하고, --sheet 를 주면 전체 미리보기를 임시 폴더에 저장합니다. 원본 포스터와 글꼴은 assets-src/frames/, assets-src/fonts/에 있습니다.

## 이미지 합성

한 장의 촬영 사진에서 얼굴 참조를 추출하며 추가 촬영은 하지 않습니다. 기본 구도는 얼굴과 어깨 중심의 클로즈업으로 잡고 배경은 일부만 보여줍니다. 다리 동작도 기본 구도를 넓히지 않으며, 풀샷 등 전신 구도를 선택한 경우 인물의 전체 윤곽이 사진 높이의 약 86%를 차지하도록 지시합니다. 합성 출력은 인쇄 프레임의 사진 창에 가까운 4:5 비율로 만들어 머리·발 잘림과 불필요한 여백을 줄입니다. 롱샷·여백 구도처럼 명시적으로 작은 인물을 선택한 구도는 그대로 유지합니다. 렌즈 효과의 인물 분할은 전체 사진과 인물 주변 확대 영역을 함께 확인해 작은 손·발의 누락을 줄입니다. 아웃포커스의 초점 영역은 인물 위치를 따라가며, 패닝은 인물 윤곽 주변을 부드럽게 섞어 가장자리 손실을 줄입니다. 완성된 효과는 프레임·인쇄·저장·QR 사진에 함께 반영됩니다.

AI 합성은 한 번의 요청입니다. 원본 사진, 얼굴 확대 사진, 배경·동작·소품 참조 이미지를 함께 보내고, "그 장소에서 한 장으로 찍은 실사 사진"을 인물이 크게 보이는 구도로 만들되 얼굴의 실제 특징·각도·표정은 유지하고 동작 안내 그림의 팔다리 방향만 따르라는 지시를 붙입니다. 옆모습 등 구도가 명시적으로 다른 얼굴 시점을 요구하는 경우에만 각도를 바꾸며, 조명 변경도 얼굴 윤곽을 바꾸지 않도록 제한합니다. 모델은 gemini-3-pro-image(1K)만 씁니다. 보통 25~35초 걸리고, 요청이 몰리면 1분을 넘기도 합니다.

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
| PHOTOBOOTH_TURN_URLS | WebRTC 중계 서버 주소. 여러 주소는 쉼표로 구분 |
| PHOTOBOOTH_TURN_USERNAME | TURN 인증 사용자 이름 |
| PHOTOBOOTH_TURN_CREDENTIAL | TURN 인증 비밀번호. 호스팅 시크릿으로 관리 |
| PHOTOBOOTH_MOCK_AI | 1이면 AI 호출 생략 |

키는 저장소에 넣지 말고 .env.local 또는 App Hosting 시크릿으로 관리합니다.

## AR 라이브 포토 (Live Photo)

결과 화면에서 "AR 라이브 포토 받기 (QR)"를 누르면 고유 QR 코드가 생성됩니다. 스마트폰 카메라로 스캔하면 전용 웹 뷰어(`/receive/[id]`)로 접속하고, 부스 PC에서 휴대폰으로 암호화된 WebRTC DataChannel을 통해 사진을 직접 받습니다. 서버에는 사진을 업로드하지 않고 연결 정보만 잠시 메모리에 둡니다.

- **인터랙티브 라이브 모션:** 사진을 터치하거나 재생 버튼을 누르면 부드러운 3D 패럴랙스 줌과 반짝이는 과학 파티클 효과, 미래지향적 사운드가 재생됩니다.
- **AR 카메라 모드:** 스마트폰 후면 카메라를 켜서 인쇄된 종이 사진을 비추면, 증강현실(AR)로 종이 위에서 움직이는 홀로그램 사진이 재생됩니다.
- **스마트폰 저장:** 1200×1800 300dpi 원본 인쇄 사진 다운로드와 3초짜리 움직이는 라이브 영상(MP4/WebM) 저장을 지원합니다.
- **사진 보관:** 부스와 휴대폰의 메모리에서만 엽니다. 받기 완료 전 부스가 처음 화면으로 돌아가면 연결과 사진이 폐기됩니다. 받은 휴대폰에서는 계속 사용할 수 있으며, 새로고침 전에 저장 버튼으로 사진을 저장해야 합니다.
- **다시 열기·공유:** `/receive`에서 휴대폰에 저장한 사진을 골라 AR을 다시 열 수 있습니다. 공유 버튼은 링크 대신 사진 파일을 공유합니다. 예전 `/live/[id]` 링크는 로컬 사진 선택 안내로 대체됩니다.

PC와 휴대폰 모두 외부에서 접속할 수 있는 HTTPS 주소를 사용합니다. Wi-Fi와 LTE 등 다른 네트워크 사이의 전달에는 TURN 설정과 실제 기기 검증이 필요합니다. 연결 정보는 단일 Node 프로세스의 RAM에 있으므로 여러 인스턴스·worker를 사용하지 않습니다. 재시작이나 배포 시 기존 QR이 만료될 수 있습니다. 자세한 운영 조건과 검증 방법은 [docs/PHOTO-TRANSFER.md](docs/PHOTO-TRANSFER.md)를 참고하세요.

PC에서 QR을 만들 때와 휴대폰에서 사진을 받기 전·후에 사진 미보관 안내를 보여 줍니다. QR에는 연결 정보만 들어 있고 사진은 암호화해 전달된다는 설명, 직접 저장해야 사진이 남는다는 안내를 제공합니다. 펼쳐 보는 설명에는 WebRTC·임시 메모리·중계 서버의 역할을 적었습니다. 공통 문구는 [src/components/photo-privacy-notice.tsx](src/components/photo-privacy-notice.tsx)에서 관리합니다.

QR을 만들면 결과 패널에 [Magic Tree](https://github.com/Slifronic/magic-tree)의 QR 땅이 스캔할 수 있는 QR로 먼저 나오고, `QR을 눌러보세요` 안내가 표시됩니다. QR을 누르면 잎이 날아올라 3D 나무로 바뀌고, 다시 누르면 QR로 돌아옵니다. `QR 나무 크게 보기`로 원본 페이지처럼 전체 화면에서 볼 수 있습니다. QR 화면에는 잔디 테두리 위에 스캔 유도 빛이 깜빡이고, 바람 소리와 전환 화음은 `소리 끄기`로 끌 수 있습니다. 그래픽 장애에는 평면 QR과 재시도 버튼을 표시합니다. 휴대폰에는 실제 수신 진행률과 사진 도착 고리를 표시하며, 전송 방식은 기존 WebRTC를 유지합니다. 검증은 `npm run test:qr-portal`로 실행합니다.

## 프리셋 에셋 다시 만들기

node scripts/build-assets.mjs 를 실행하면 public/의 원본 이미지와 [scripts/pose-geometry.mjs](scripts/pose-geometry.mjs)의 포즈 정의로 public/presets/와 public/brand/를 새로 만듭니다. 동작 50개는 모두 같은 좌표 정의에서 그립니다. 카드는 연필 스케치 화풍의 데생 인형 SVG([scripts/sketch.mjs](scripts/sketch.mjs))이고, AI에는 팔다리 방향만 담은 흑백 PNG를 보냅니다. --sheet 옵션을 주면 포즈 전체 미리보기 이미지를 임시 폴더에 저장합니다. 구도 카드는 같은 데생 인형을 콘티처럼 그린 연필 스케치 SVG이며 [scripts/composition-geometry.mjs](scripts/composition-geometry.mjs)에서 정의합니다. 동작·구도 카드만 다시 만들 때는 --cards 옵션을 씁니다. 배경·소품 카드는 AVIF, AI에 보내는 참조 이미지는 WebP로 저장합니다(Gemini는 AVIF 참조를 받지 않습니다).

배경과 소품은 모두 참조 이미지로 AI에 전달됩니다. 새 항목은 원본 PNG를 assets-src/backgrounds/ 또는 assets-src/props/에 <id>.png로 넣고(소품은 흰 배경), presets.ts에 같은 id로 bgImage/propImage 항목을 추가한 뒤 build-assets.mjs를 다시 실행합니다.

## 배포 (Firebase App Hosting)

apphosting.yaml에 런타임 설정이 있습니다. App Hosting 서비스 계정에 Vertex AI 사용자 역할이 필요합니다.

## 라이선스

Michael Bleigh의 Magic Markup(Apache License 2.0)을 바탕으로 인천봉수초 교사 홍찬우가 만든 2차 창작물입니다. 자세한 내용은 앱의 저작권 안내와 LICENSE를 참고하세요.

QR 나무 화면은 Magic Tree(MIT License, Copyright (c) 2026 Magic Tree contributors)의 코드를 바탕으로 합니다. 라이선스 전문은 [src/lib/magic-tree/LICENSE](src/lib/magic-tree/LICENSE)와 앱의 저작권 안내에 있습니다.
