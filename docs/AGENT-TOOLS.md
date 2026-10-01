# Agent tools — 포토부스

Preview: http://127.0.0.1:3012
Start: VS Code 작업 "Vibe: 포토부스 미리보기" (폴더를 열면 자동 실행, 수동: node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3012)

Playwright CLI 0.1.21:
`& 'C:/Users/user/AppData/Local/VibeCoding/AgentTools/music-213f3ed1d0/node_modules/.bin/playwright-cli.cmd' -s=photobooth open http://127.0.0.1:3012`
공식 Skill: .agents/skills/playwright-cli/SKILL.md. 명령을 실행할 때 위 절대 경로를 사용합니다.
Context7 MCP 4.1.1: server name context7.
Chrome DevTools MCP 1.10.1: server name chrome_devtools. 전용 격리 브라우저와 프로젝트 범위 사용.
설정: .codex/config.toml. 기존 사용자 모델·인증은 유지합니다. Codex에서 프로젝트 신뢰 후 새 세션에 적용됩니다.
설치 재사용 및 구성 완료. 실제 Codex 세션 도구 호출은 별도 검증 필요.
카메라 촬영과 AI 이미지 생성은 하드웨어 권한 및 API 설정이 필요하며 환경 설치만으로 검증되지 않습니다.
