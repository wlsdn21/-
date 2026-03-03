# Changelog

모든 주요 변경사항이 이 파일에 문서화됩니다.

이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

---

## [Unreleased]

### 추가 예정
- 단위 테스트 추가
- 국제화(i18n) 지원

---

## [1.3.0] - 2026-01-18

### Added
- **다중 통화 지원**: EUR (유로), JPY (엔화), CNY (위안) 추가
  - EUR: € 기호, EUR 접미사, "유로" 한글 인식
  - JPY: ¥ 기호, JPY/円 접미사, "엔" 한글 인식
  - CNY: ¥ 기호, CNY/RMB/元 접미사, "위안" 한글 인식
  - 12개의 새로운 정규식 패턴 추가 (각 통화당 3개)
  - 팝업 UI에 통화별 토글 추가
  - JPY/CNY 배타적 토글 구현 (¥ 기호 충돌 해결)
  - 기본값: 모두 비활성화 (USD만 활성)

### Technical
- `background.js`: 다중 통화 환율 자동 가져오기
- `content.js`: 통화별 조건부 변환 로직
- `popup.html/js`: 다중 통화 설정 UI

---

## [1.2.0] - 2026-01-18

### Added
- **한국어 통화 패턴 지원**: "2,000억 달러", "100만 달러" 같은 형식 자동 변환
  - 새로운 정규식 패턴 `KOREAN_CURRENCY_REGEX` 추가
  - 한국어 단위(만/억/조) + 한국어 통화명(달러) 조합 인식
  - 기존 변환 로직 재사용으로 성능 영향 최소화

---

## [1.1.0] - 2026-01-18

### Fixed
- **메모리 누수 방지**: 페이지 언로드 시 MutationObserver 정리하는 이벤트 리스너 추가
  - SPA 환경에서 메모리 누수 방지
  - `beforeunload` 이벤트로 리소스 정리

### Changed
- **에러 UX 개선**: API 실패 시 사용자에게 에러 메시지 표시
  - `lastFetchError` 필드 추가하여 에러 상세 정보 저장
  - 팝업에서 에러 메시지 시각적으로 표시
- **주석 정확성 개선**: background.js의 alarm 주기 주석을 실제 동작과 일치하도록 수정

### Security
- **Content Security Policy (CSP) 추가**: manifest.json에 CSP 정책 추가
  - `script-src 'self'` - 자체 스크립트만 허용
  - `object-src 'self'` - 자체 객체만 허용
  - XSS 공격 위험 감소

---

## [1.0.0] - 2026-01-18

### 초기 릴리스

#### 기능
- ✅ USD/USDT/USDC를 원화(KRW)로 자동 변환
- ✅ 다양한 환율 소스 지원
  - 국제 환율 (USD/KRW)
  - 업비트 USDT
  - 업비트 USDC
  - 사용자 지정 환율
- ✅ 김치 프리미엄 자동 계산
- ✅ 한국어/영어 단위 인식 (k, m, b, t, 만, 억, 조)
- ✅ 음수 금액 처리 (손익 표시)
- ✅ 억/조 단위 표시 옵션
- ✅ 소수점 자릿수 조절 (0-4자리)
- ✅ 사이트별 활성화 설정
  - 화이트리스트 모드
  - 모든 사이트 적용 모드
- ✅ 자동 환율 갱신 (30초 간격)
- ✅ 다중 API 폴백 시스템

#### 기술 스택
- Manifest V3 (최신 Chrome Extension API)
- MutationObserver + RequestAnimationFrame (성능 최적화)
- Chrome Storage API
- Chrome Alarms API

#### 지원 사이트 (기본)
- Hyperliquid.xyz
- Lighter.xyz
- Binance.com
- OKX.com
- Bitget.com
- KuCoin.com
- BingX.com

---

## 변경 이력 형식

### Added (추가)
새로운 기능이 추가되었을 때

### Changed (변경)
기존 기능이 변경되었을 때

### Deprecated (폐기 예정)
곧 제거될 기능

### Removed (제거)
제거된 기능

### Fixed (수정)
버그 수정

### Security (보안)
보안 관련 변경사항
