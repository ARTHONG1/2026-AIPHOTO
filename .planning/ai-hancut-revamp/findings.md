# Findings
- Next 15.0.7, React 18.3.1, Genkit 1.42 (@genkit-ai/google-genai vertexAI), 모델 gemini-3-pro-image, location global, projectId 하드코딩 project-1e3fbae0-3a3e-4723-ae1
- 흐름: / → /booth?autoStart=true (10초 카운트다운 촬영) → /editor?isGuided=true (배경→동작→프롬프트 다이얼로그 자동 열림 → 자동 생성) → 완료 다이얼로그(30초 후 처음으로)
- 렉 원인: 하이라이트 mousemove마다 reducer 업데이트 + 수 MB base64를 localStorage에 동기 저장, PNG 원본 캡처, 6.5MB 배경 PNG, box-shadow 애니메이션, 카메라 트랙 미해제
- 버그: QR은 생성 이미지가 아니라 baseImage 업로드, 하이라이트 canvas 크기 미설정(300x150), 마스크 소품 파일은 목록에 없음
- Cloudinary env(.env)는 로컬에 없음 → QR 기능은 키 설정 필요
- ADC(authorized_user) 존재, gcloud 계정 2개. firebase CLI 없음
- 기존 에셋: 배경 5, 동작 14, 소품 4(마스크 포함)

