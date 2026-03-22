# 🚁 드론 탐험대

드론으로 촬영한 지역 명소 사진을 **Google Gemini AI**로 게임 배경으로 변환하고, 그 위에서 플레이하는 **HTML5 Canvas 드론 조종 게임**입니다.

## 🎮 게임 방법

1. **API 키 설정** — Google AI Studio에서 발급받은 Gemini API 키를 입력합니다.
2. **배경 만들기** — 드론 사진을 업로드하고 원하는 스타일을 선택 후 AI로 배경 이미지를 생성합니다.
3. **게임 시작** — 생성된 배경 위에서 드론을 조종해 장애물을 피하고 코인을 수집하세요!

## 🕹️ 조작법

| 플랫폼 | 조작 |
|--------|------|
| PC     | 방향키 (↑↓←→) 또는 WASD |
| 모바일 | 화면 하단 D-pad 버튼 |

## 🎯 점수 & 등급

- 💰 코인 수집: **+10점**
- ❤️ 목숨: **3개** (장애물에 닿으면 1개 감소, 1.5초 무적)

| 점수 | 등급 |
|------|------|
| 200점 이상 | 🏆 |
| 100점 이상 | 🥇 |
| 50점 이상  | 🥈 |
| 그 이하    | 🌟 |

## 🧱 장애물 종류

- 🏔️ 산 — 느리고 크다
- 🦅 새 — 빠르고 위아래로 날아다닌다
- 🏢 빌딩 — 높이가 높다
- ⛈️ 먹구름 — 넓고 느리다

## 🛠️ 기술 스택

- **Vanilla HTML5 / CSS3 / ES2022+** (빌드 도구 없음)
- **Google Gemini API** (`gemini-2.0-flash-preview-image-generation`)
- **HTML5 Canvas 2D API** — 게임 엔진
- **Google Fonts** (Jua, Nanum Gothic)
- **Netlify** — 정적 호스팅

## 🚀 배포 (Netlify)

1. 이 저장소를 GitHub에 push
2. [Netlify](https://netlify.com)에서 GitHub 저장소 연결
3. Build settings는 비워두고 **Publish directory** = `.` (루트)
4. **Deploy site** 클릭

또는 Netlify CLI 사용:

```bash
npx netlify deploy --dir . --prod
```

## 📁 파일 구조

```
drone-game/
├── index.html       # 메인 HTML (3개 화면)
├── css/
│   └── style.css    # 전체 스타일
├── js/
│   └── app.js       # 게임 엔진 + API 로직
├── netlify.toml     # Netlify 설정
└── README.md
```

## 🔑 API 키 발급

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. "Create API key" 클릭
3. 생성된 키를 앱의 API 키 입력란에 붙여넣기
4. 입력한 키는 브라우저 `localStorage`에 저장되어 재방문 시 자동 복원됩니다.

## ⚠️ 주의사항

- API 키는 클라이언트에서 직접 Gemini API를 호출하므로, 브라우저 개발자 도구에서 노출될 수 있습니다.
- 개인 프로젝트 / 테스트 용도로만 사용하세요.
- 상업적 배포 시에는 서버사이드 프록시를 통해 API 키를 보호하세요.
