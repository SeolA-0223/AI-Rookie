# AI-Rookie

규정 변경 누락 방지 MVP 저장소입니다.

## 구조
- `backend`: 변경 탐지, 영향 매핑, 위험도 분류, 초안 생성 API
- `frontend`: 대시보드 UI 샘플
- `shared`: API 계약
- `data/samples`: 샘플 데이터
- `docs`: 기획/설계 문서
- `tests`: Node 테스트

## 실행
1. API 서버 실행
   - `node backend/src/server.js`
2. 헬스체크
   - `GET http://localhost:3000/health`
3. 분석 실행
   - `POST http://localhost:3000/analyze`

`/analyze`는 body가 없어도 샘플 데이터를 사용해 결과를 반환합니다.

## 테스트
- `node --test tests/*.test.js`
