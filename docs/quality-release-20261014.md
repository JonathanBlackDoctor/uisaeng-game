# 품질 개선 공개 배포 — 2026-10-14

[의생게임](https://JonathanBlackDoctor.github.io/uisaeng-game/)에 커밋 `c21fd3c6a2a0e3bde1cf051ed6ad36f73e205b50`을 배포했다. 부모는 `71372f44c40505c3261e5c05fbbe00b60f099973`, 트리는 `e490eeb69f3cd43bb62b8126fa5cc57ccc8e66e5`. 98파일 고정본 `.orchestrator/releases/quality-depth-release-20261013/manifest.json` 중 원격과 다른 35파일을 반영했다. 모든 고정본 해시와 후보 트리를 대조했고 무관한 파일 변경은 없다.

포함: 대학→은퇴 동기 네 사건과 선택에 따라 달라지는 공동작업 기회, 26개 전공의 직업 고민 및 실제 수련 선택 활용, 선택 직후 실제 수치/결과 피드백. 완료된 타이틀→배경→입학 오프닝, 세 항목 중심 능력 안내, 누적 진료/순자산 표시도 통합했다. 이전 1.0.0의 선택 빈도·진행 속도·연결 노트·태블릿 배치·OG·업데이트 알림은 이어받았다.

검증: Vitest315/20파일 + Node37, TypeScript 및 production build 통과. 이후 UI/검사 보완은 관련38개와 타입/빌드로 확인했다. [Game checks](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38418154238)와 [Pages](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38418154117) 모두 success. 공개 JS `index-ChZ30jh5.js`, CSS `index-BIRmlsRF.css`, 화면 `버전 1.0.0` 확인. 빌드 버전은 `6803919567b3dfc23f6df5c09e7072dd756a3428cf06df73b6272e265db45b6b`이다.

390×844/1024×768 실제 브라우저: 사진 동아리→영상의학과/서울대병원→봉직의→은퇴, 지민과의 네 만남·공동작업·수련 경험 선택·557기록과 회고 복원 확인. 공개 이전 저장의 20세6개월/건강64·행복34·지식53·관계65/미납140만원/선택4개가 업데이트 전후 완전히 동일하다. 공개 저장에서 선택을 진행하지 않았다. 가로 넘침·콘솔 경고/오류 없음. `.orchestrator/ui-qa/quality-depth/qa.json`, `public-restore.json`, `public-release.png`에 근거를 보존했다.

같은 시드42 미수련 경로는 37선택/능력4/이야기9/684개월로 유지했다. 읽기 시간을 포함한 사람의 실제 플레이 시간 측정은 하지 않았다. 사용성 평가자는 모집하지 않았고 직접 UI 완주와 자동 검사를 수행했다. 다른 전공의 UI 전체 완주는 자동 회귀와 구분한다. 실제 Safari 기기 검수는 하지 않았다. 창작 효과와 조정 수치는 시험 설정이며 정식 규칙 승인으로 기록하지 않는다. JS 587kB 번들 경고가 남는다.

다른 채팅의 이후 분과·교수 진로와 추가 장면·능력/배경 밸런스 작업은 진행 중이므로 이번 고정본에 넣지 않았다. 루트 수정·연구 원본·task-hold를 보존했다. 후속 배포는 위 커밋 이후 최신 원격 HEAD를 기준으로 병합해야 한다.
