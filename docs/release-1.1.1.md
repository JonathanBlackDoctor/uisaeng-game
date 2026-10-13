# 의생게임 1.1.1

1.1.0 고정 이후 완료된 논문 지표 교체를 별도 묶음으로 배포한다. 사용자의 진행 중 작업 완료 후 묶음 배포 지시를 따른다.

- 진행 화면·회고·공유 결과의 길러낸 제자를 발표한 논문으로 교체한다.
- 연구 활동·연구 모임·연구 직업에서 쓴 진행을 누적해 논문을 한 편씩 완성한다. 연구력과 교수 경력이 진행 속도에 영향을 준다.
- 기존 제자 기록을 논문 수로 환산하지 않는다. 과거 저장은 유지하고 업데이트 이후의 연구만 집계한다.
- 논문 진행률·제목·발표 기록을 저장하고 새로고침·중복 입력·배속 변경으로 중복 집계하지 않는다.

논문 수와 진행 속도는 조정 가능한 창작 게임 설정이며 실제 연구 생산성을 예측하지 않는다. 완료된 소스를 새 고정본으로 만들어 전체 검사·타입·빌드와 이전 공개 저장 호환을 검증한다. 브라우저 접근 제한에 대해서는 사용자가 승인한 개별 UI 검수·통합 자동검사 및 공개 상태의 직접 확인 절차를 따른다.

## 검증과 공개 배포

2026-10-14 1.1.1 공개 배포 완료. [게임](https://jonathanblackdoctor.github.io/uisaeng-game/) · [배포 커밋 b4cebc6](https://github.com/JonathanBlackDoctor/uisaeng-game/commit/b4cebc69f5b04c19419472e693b0c62a85349392).

새 고정본164파일의 원격 변경21파일을 반영했다. Vitest458개·Node37개·실제 이전 공개 저장 복사본의 호환5개, 총500개와 타입 검사·Pages 운영 빌드 통과. [Game checks](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38437721722)와 [Pages](https://github.com/JonathanBlackDoctor/uisaeng-game/actions/runs/38437721526) 성공. 공개 HTML·version.json·index-DefXRjRO.js·index-BlBRWvOb.css·OG의 실제 바이트와 SHA-256은 검증 빌드와 모두 일치했다.

브라우저 접근 권한 거부는 그대로 보존하며 우회하거나 반복 시도하지 않았다. 사용자 승인대로 완료된 개별 UI 검수와 고정본의 자동검사를 사용했다. 동일 공개 저장의 1.1.0 업데이트 복원은 사용자가 직접 확인했으며, 1.1.1 업데이트 후에도 “버전 1.1.1이고 진행 기록도 그대로”라고 직접 확인했다. 자동 호환 검사 성공과 인간의 실제 탭 확인을 구분한다.

최종 근거는 `.orchestrator/github-sync/release-1.1.1-state.json`, 공개 자산 대조는 `.orchestrator/ui-qa/release-1.1.1/public-resources.json`. 고정 이후의 장면 애니메이션 등 추가 변경은 포함하지 않았다. 현재 작업 폴더 전체를 이 결과로 인증하지 않는다. JS 약765kB 안내와 일부 개원·추가 진료 경로의 재정 균형 검토가 남는다.
