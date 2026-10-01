# 포토부스 작업 안내

이 프로젝트는 Next.js 15 / React 18 / TypeScript 기반 과학 포토부스입니다.
개발 서버: `VS Code 작업 "Vibe: 포토부스 미리보기" (폴더를 열면 자동 실행, 수동: node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3012)`, URL: http://127.0.0.1:3012.
기존 화면과 기능을 보존하며 요청 범위만 수정합니다. API 키를 저장소에 기록하지 않습니다.

<!-- vibe-agent-tools:start -->
## 개발 도구
구체적인 명령과 검증 상태는 docs/AGENT-TOOLS.md를 읽습니다.
- UI를 변경하면 Playwright CLI로 관련 화면을 열고 동작과 스크린샷을 확인합니다.
- Next.js/React/Genkit 등 버전별 API가 불확실할 때 Context7에서 공식 문서를 조회합니다. 서비스 장애 시 공식 문서를 직접 확인합니다.
- 브라우저 오류나 성능 문제는 Chrome DevTools MCP로 콘솔과 네트워크를 조사합니다.
- 모든 요청에서 세 도구를 강제로 실행하지 않습니다. 실제 확인한 범위만 보고합니다.
- 카메라, 이미지 생성 API, 외부 업로드는 단순 설치 검증에 실행하지 않습니다. 키·개인 사진·학생 정보를 외부 문서 조회에 보내지 않습니다.
<!-- vibe-agent-tools:end -->
