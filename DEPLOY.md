# PromeLaw 배포 메모

## URL 구조

- `/`: 공개 viewer 페이지
- `/edit/<PROME_LAW_EDIT_TOKEN>`: 숨겨진 편집 페이지
- `/api/state`: 현재 작업 상태 JSON
- `/api/events`: 실시간 갱신 알림 SSE

viewer는 `댓글`과 `isPublic: false`인 개정이유를 받지 않는다. edit API는 `X-PromeLaw-Edit-Token` 헤더 또는 `token` 쿼리가 맞아야 동작한다.

## 환경 변수

- `HOST`: 기본값 `127.0.0.1`, 배포에서는 `0.0.0.0`
- `PORT`: 기본값 `5173`, 배포 플랫폼의 포트 값 사용
- `PROME_LAW_EDIT_TOKEN`: edit URL에 들어갈 긴 토큰
- `PROME_LAW_DATA_DIR`: 상태 JSON과 토큰 저장 위치. 배포에서는 persistent disk 경로를 지정해야 한다.

## 실행

```bash
HOST=0.0.0.0 PORT=5173 PROME_LAW_DATA_DIR=/data python3 server.py
```

Docker:

```bash
docker build -t promelaw .
docker run -p 5173:8000 -v promelaw-data:/data -e PROME_LAW_EDIT_TOKEN='긴_비밀_토큰' promelaw
```

## 첫 부팅 데이터

`seed-state.json`은 Render의 persistent disk가 비어 있을 때 첫 상태로 사용된다. 따라서 md 파일이 GitHub에 누락되어도 서버는 이 JSON으로 부팅할 수 있다.

최신 작업환경으로 시드를 바꾸려면:

```bash
cp ~/Documents/prome-law.workspace.20260623-071406.json ./seed-state.json
```

## 도메인 연결

도메인은 viewer인 `/`로 연결한다. edit 주소는 공개 링크에 노출하지 말고, 편집자에게만 `/edit/<토큰>` 전체 주소를 공유한다.
