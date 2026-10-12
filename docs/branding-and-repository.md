# 의생게임 로고와 GitHub 레포

2026-10-13 기록. 사용자는 이 채팅에서 심플한 v3 로고와 레포 이름을 승인했다.

> 좋아. 이걸로 하자. 색깔은 바꿀 수 있고, 깃 레포는 그걸로 새로 만들어서 나중에 배포할 수 있도록 해.

- 게임 이름: **의생게임**.
- 승인 로고: 작은 청진기 하나와 한글 워드마크를 결합한 `design/branding/logo-minimal-v3.png`.
- 레포: **uisaeng-game**, https://github.com/JonathanBlackDoctor/uisaeng-game .
- 현재 비공개. 미래 배포를 위한 레포 생성·준비 승인으로, 지금의 공개 배포 승인은 아니다.
- 색상은 고정하지 않는다. `game/src/brand.css`의 `--brand-color`로 변경한다. 게임에는 기존 화면과 맞는 초록색을 기본 적용한다. 투명 PNG를 CSS mask로 표시하여 원본 이미지 재생성 없이 색을 바꾼다.
- 원본은 생성형 래스터다. 벡터 원본이라고 표기하지 않는다. 초기 두 복합 시안과 추상 시안은 승인 대상이 아니다.

## 빌드와 미래 배포

`game/`에서 `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`를 실행한다. 결과 폴더는 `game/dist/`다.

기본 경로는 기존 로컬 현황판과 같은 `/game/`다. 빌드 시 `VITE_BASE_PATH`를 지정하면 정적 호스트에 맞출 수 있다.

| 호스팅 위치 | VITE_BASE_PATH |
| --- | --- |
| 도메인 루트 | `/` |
| GitHub Pages 프로젝트 경로 | `/uisaeng-game/` |
| 기존 로컬 현황판 | `/game/` 또는 변수 미지정 |

PowerShell 예시:

```powershell
$env:VITE_BASE_PATH = '/uisaeng-game/'
pnpm --dir game build
Remove-Item Env:VITE_BASE_PATH
```

`.github/workflows/game-ci.yml`은 테스트·빌드와 정적 산출물 보관까지만 한다. Pages 활성화·호스트 연결·도메인 설정·공개 배포는 수행하지 않는다. 실제 호스트와 공개 범위는 배포할 때 정한다.

연구 원본, 로컬 실행기 상태, 브라우저 저장 기록, 의존성 설치 폴더와 빌드 출력은 레포 업로드 대상이 아니다. 기존 `.gitignore`를 유지한다. 공개 전 실제 전체 생애 검증·콘텐츠·자산 사용 조건은 별도 확인해야 하며, 레포 생성은 게임 전체 완성을 의미하지 않는다.
