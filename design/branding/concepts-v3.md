# 의생게임 미니멀 로고 v3

2026-10-12. 사용자 피드백: “별로야. 심플해야해.”

v2의 가운·교재·청진기 복합 그림은 거절되었다. 이번 시안은 글자 중심에 청진기 심벌 하나만 남긴 가로형 로고다.

- 이름 후보 유지: **의생게임**. 새 확정으로 기록하지 않는다.
- 레포 이름 제안 유지: `uisaeng-game`. 실제 레포 생성·개명 없음.
- 형태: 작은 청진기 + 한글 워드마크. 의생은 굵게, 게임은 가볍게.
- 색 의도: 남색 `#173B63` 한 가지. 생성 결과의 모든 픽셀이 동일한 지정색이라는 보장은 아니다.
- 부제·앱 아이콘·복합 삽화 생략.
- 이미지: [logo-minimal-v3.png](logo-minimal-v3.png).
- 제작: 기본 제공 `image_gen.imagegen`, 투명 배경 요청. 출력 원본을 그대로 복사했으며 알파 채널 후처리 없음.
- 규칙 버전: `branding-concept-v3`.
- 검토: 의생게임 네 글자와 청진기 형태 확인. 검토용 래스터이며 최종 승인·벡터 제작·게임 화면 적용 전이다.
- 이전 시안 보존.

## 생성 프롬프트

```text
Use case: logo-brand.
Create ONE extremely simple finished logo for a Korean medical-student-to-doctor life simulation game.
Exact Korean wordmark: "의생게임".
A single horizontal lockup: one SMALL minimal monoline stethoscope symbol on the left, followed by the Korean wordmark on the right. The icon should be the height of the letters, not an oversized illustration. The stethoscope must have just two short earpieces, a smooth U shaped tube and one clean circular chestpiece: very few strokes, no double outlines, no interior details, no frame. A calm precise small medical cue.
Typography is the main focus: beautiful clean Korean sans lettering, medium-bold, a little soft at corners but not bubbly, excellent spacing, all four characters clear and spelled correctly. "의생" slightly heavier than "게임", same size and baseline, all in the SAME single flat dark navy color #173B63.
Very restrained professional Korean indie game wordmark, like a carefully crafted typographic logo. It must read beautifully at a small web-header size. Deliberate simplicity. No visual storytelling beyond the small stethoscope.
Transparent background. Leave modest clear space around the horizontal logo. No concept board, no comparisons, no app icon demonstrations, no subtitle, no English, no repo text, no numbers, no book, no coat, no person, no plant, no heartbeat, no cross, no badge, no circle enclosing the logo, no gradients, no shadows, no texture, no fake embossed styling, no 3D.
ONE COLOR, flat vector-like edges, minimal geometry.
```

