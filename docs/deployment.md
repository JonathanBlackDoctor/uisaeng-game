# 최신 공개 버전: 의생게임 1.0.0

2026-10-13 공개 배포 완료. https://jonathanblackdoctor.github.io/uisaeng-game/

커밋 cbcfebec126b37f4f2ac783f72a595838bbaf89b. OG 카드, 태블릿 레이아웃, 업데이트 알림, 연결 서사와 선택 빈도 조정, 정식1.0.0표시 및 개발용 문구 정리. 로컬311테스트·타입·빌드와 GitHub 검사/Pages 성공. 기존저장복원 및 공개화면 검수완료.

아래는 과거 배포 시점의 기록이며 현재 릴리스 상태가 아니다.

# 현재 버전 배포

2026-10-13 10:15 KST: 돈·생활 설정 강화 커밋 `5d60cd4497f4899f95f5c772230080567e91fb8e` 배포 완료. 최신 원격 `dfab3e1bc8d27b95b44eb2847e02617911954192`를 부모로 이어받았다. [배포](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38330926814)와 [게임 검사](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38330926769) 모두 성공. 고정 소스 `.orchestrator/releases/finance-20261013-1004`의 62개 파일 해시를 원격 트리와 대조했다. Vitest 215개와 Node 37개(총 252개), 타입 검사, Pages 빌드 통과. PC/390px 모바일에서 생활 시간 한도, 예금·투자, 월 이자/손실, 저장 복원을 검수했다. 공개 자산 `index-B1_PeWdz.js`, 기존 저장의 순자산·월 지출·생활/금융 설정과 console error/warn 0 확인. 공개 저장에서는 선택을 진행하지 않았다. 증거 `.orchestrator/ui-qa/finance-lifestyle-live.png`, 배포 상태 `.orchestrator/github-sync/economy-release-state.json`. 금리·물가·확률은 provisional. 스냅샷 이후 다른 채팅의 시작 배경·상세 능력 UI·회고 공유 변경은 이 배포 검증 범위에 포함하지 않으며 로컬 원본을 보존했다.

2026-10-13 09:21 KST: 대학생활 개선 커밋 `6602db54a69b1c318fd4282cc6adbc54d7575d29`을 같은 GitHub Pages 주소에 반영했다. [배포](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38326620195)와 [게임 검사](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38326620177) 모두 성공. 공개 자산 `index-DZTgpMV5.js` 확인, 사진 동아리 선택→20세 1개월·기록 4개→새로고침 복원 성공, console error/warn 0. 로컬 PC/390px 모바일에서 농구부 공동 활동 완료·실시간 소식·저장 복원을 확인했다. 증거는 `.orchestrator/github-sync/campus-release.json` 및 `.orchestrator/ui-qa/hq009/`. 전공·기관별 깊이 보강은 이어지는 승인 개발 범위다.

## GitHub Pages — 현재 공개 주소

2026-10-13 08:49 KST, 사용자 지정 GitHub 주소에 배포 완료. 사용자가 기존 저장소 공개 후 배포를 선택했고 이메일 sudo 인증을 완료했다.

접속: https://JonathanBlackDoctor.github.io/uisaeng-game/

원격 main 커밋 `a45e197a113c2ba3dd4e5fbe640bb484fc77ad15`. Pages Source는 GitHub Actions. [배포 실행](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38323897222)과 [게임 검사](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38323897110)가 모두 success다. 실제 공개 주소에서 게임 시작, 동아리 가입 선택, 20세 1개월·기록 2건·현금 29,100,000원 상태의 새로고침 복원을 확인했다. console error/warn 0. 증거는 `.orchestrator/github-sync/pages-pending.json`과 `.orchestrator/ui-qa/hq008/github-pages-live.jpg`. 전체 생애 검수는 기존 동일 소스 결과를 재사용하며, provisional 규칙과 미완료 콘텐츠는 유지한다.

저장은 접속 주소별 브라우저 IndexedDB에 보관된다. 기존 로컬/Sites 저장은 자동으로 옮겨지지 않는다. 다음 배포는 `.github/workflows/game-pages.yml`을 사용한다.

## 이전 Sites 비공개 배포

2026-10-13 08:30 KST, 사용자 요청으로 현재 버전을 Sites에 비공개 배포했다.

접속: https://uisaeng-game.alpaomegastartend.chatgpt.site

배포 성공은 Sites 도구의 succeeded 결과로 확인했다. 소유자만 접근한다. 기존 로컬 주소와 저장 공간은 별도이며 새 주소의 IndexedDB에 저장된다. 게임 소스는 변경하지 않았다. 현재 버전의 provisional 규칙과 기존 검수 한계는 유지한다.

사이트 정보는 sites/uisaeng-game/.openai/hosting.json, 배포·버전·커밋은 .orchestrator/deployments/uisaeng-game-status.json을 따른다. 후속 배포는 동일 project_id와 audience를 유지한다. 정적 파일 변경 시 현재 게임에서 루트 경로로 다시 빌드하고 사이트 소스 동기화 후 발행한다.
