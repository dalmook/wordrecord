# 받아쓰기 앱 (GitHub Pages) — Firebase 연동 버전

## 파일
- `index.html` — 화면/레이아웃, Firebase SDK & 구성 토글
- `styles.css` — 모바일 세로 화면 최적화 스타일
- `script.js` — 로직(받아쓰기/실전쓰기, Web Speech, 기록 저장, Firestore 옵션)
- `data.json` — 언어/급수별 문제 (샘플)

## Firebase 사용법
1. Firebase 콘솔에서 **웹 앱 추가** 후 구성값 복사
2. `index.html` 상단의 `window.firebaseConfig`에 값 채우기
3. `window.FIREBASE_ENABLED = true` 로 변경
4. Firestore 보안 규칙은 필요에 맞게 설정(개발: 테스트 규칙, 배포: 제한 규칙)

## GitHub Pages 배포
- 리포지토리에 4개 파일 업로드 → **Settings → Pages → Deploy from branch**
- 모바일 브라우저 자동 재생 제한이 있으므로 **▶ 버튼**으로 재생하세요.
