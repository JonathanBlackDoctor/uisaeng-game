# 의생게임

![의생게임](game/src/assets/uisaeng-logo.png)

의대생에서 의사로 이어지는 삶을 플레이하는 웹 인생 시뮬레이션입니다. 현재 개발 미리보기이며, 정식 전체 게임과 공개 서비스는 준비 중입니다.

## 개발

Node.js 24와 pnpm 11.25.0을 사용합니다.

```sh
cd game
pnpm install --frozen-lockfile
pnpm dev
```

기본 개발 경로는 `/game/`입니다.

## 검증과 빌드

```sh
pnpm test
pnpm build
```

정적 산출물은 `game/dist/`에 생성됩니다. 호스트에 맞는 `VITE_BASE_PATH`를 빌드 환경 변수로 지정할 수 있습니다. 도메인 루트는 `/`, 프로젝트 경로는 `/uisaeng-game/`를 사용합니다.

GitHub Actions는 테스트와 빌드를 검증하고 산출물을 보관합니다. 실제 배포는 활성화하지 않았습니다.

## 브랜드

이름은 **의생게임**, 레포 이름은 **uisaeng-game**입니다. 승인한 로고는 청진기 하나와 한글 워드마크이며, `game/src/brand.css`의 `--brand-color`로 색을 바꿉니다.

[로고와 배포 준비 기록](docs/branding-and-repository.md) · [게임 미리보기 범위](game/README.md)

## 프로젝트 범위

[80억 분의 1](https://1in8b.life/ko/)의 시간 흐름과 생애 선택 경험을 오마주하며 게임 코드는 독립적으로 작성합니다. [구현 방향](docs/homage-direction.md)을 따릅니다. 연구 원본·로컬 실행 상태·브라우저 저장 데이터는 이 레포에 올리지 않습니다.
