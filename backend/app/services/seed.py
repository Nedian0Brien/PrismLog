from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Log


def _dummy_logs(user_id: str) -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "user_id": user_id,
            "category": "reading",
            "title": "역행자",
            "summary": "실행력과 시스템 사고에 대한 핵심 정리",
            "tags": ["자기계발", "마인드셋"],
            "payload": {
                "author": "자청",
                "progress": 78,
                "pages_read": 218,
                "pages_total": 280,
                "rating": 4,
                "review": "실행력에 대한 생각을 바꿔준 책",
            },
            "created_at": now - timedelta(days=5),
        },
        {
            "user_id": user_id,
            "category": "reading",
            "title": "클린 코드",
            "summary": "1장~3장 핵심 원칙 메모",
            "tags": ["개발", "프로그래밍"],
            "payload": {
                "author": "로버트 마틴",
                "progress": 32,
                "pages_read": 148,
                "pages_total": 464,
                "rating": 0,
                "review": "",
            },
            "created_at": now - timedelta(days=2),
        },
        {
            "user_id": user_id,
            "category": "study",
            "title": "FastAPI 마스터 클래스",
            "summary": "라우팅/모델링 파트 복습",
            "tags": ["백엔드", "Python"],
            "payload": {
                "progress": 62,
                "chapters": [
                    "소개 및 환경설정",
                    "라우팅과 엔드포인트",
                    "Pydantic 모델",
                    "데이터베이스 연동",
                    "인증 및 보안",
                    "배포",
                ],
                "completed": [True, True, True, False, False, False],
                "goal": "주 3회 학습",
                "hours": 14,
            },
            "created_at": now - timedelta(days=3),
        },
        {
            "user_id": user_id,
            "category": "study",
            "title": "Next.js 심화",
            "summary": "Server Components 정리",
            "tags": ["프론트엔드", "React"],
            "payload": {
                "progress": 85,
                "chapters": [
                    "App Router 기초",
                    "Server Components",
                    "Data Fetching",
                    "Middleware",
                    "배포 최적화",
                ],
                "completed": [True, True, True, True, False],
                "goal": "주 2회 학습",
                "hours": 11,
            },
            "created_at": now - timedelta(days=1),
        },
        {
            "user_id": user_id,
            "category": "culture",
            "title": "쇼군 시즌 2",
            "summary": "8화까지 시청",
            "tags": ["드라마", "역사"],
            "payload": {
                "type": "TV",
                "status": "시청 중",
                "rating": 0,
                "playtime": "8화 / 10화",
            },
            "created_at": now - timedelta(days=4),
        },
        {
            "user_id": user_id,
            "category": "culture",
            "title": "오펜하이머",
            "summary": "재관람 후 평점 업데이트",
            "tags": ["전기", "드라마"],
            "payload": {"type": "영화", "status": "시청 완료", "rating": 5, "playtime": None},
            "created_at": now - timedelta(days=10),
        },
        {
            "user_id": user_id,
            "category": "culture",
            "title": "엘든 링: 나이트레인",
            "summary": "보스 러시 구간 진행",
            "tags": ["RPG", "액션"],
            "payload": {"type": "게임", "status": "플레이 중", "rating": 0, "playtime": "42시간"},
            "created_at": now - timedelta(days=6),
        },
    ]


def seed_dummy_data(db: Session, user_id: str = "demo-user") -> dict[str, int]:
    items = _dummy_logs(user_id=user_id)
    inserted = 0
    skipped = 0

    for item in items:
        exists = db.scalar(
            select(Log.id).where(
                Log.user_id == item["user_id"],
                Log.category == item["category"],
                Log.title == item["title"],
            )
        )
        if exists:
            skipped += 1
            continue

        db.add(
            Log(
                user_id=item["user_id"],
                category=item["category"],
                title=item["title"],
                summary=item["summary"],
                tags=item["tags"],
                payload=item["payload"],
                created_at=item["created_at"],
                updated_at=item["created_at"],
            )
        )
        inserted += 1

    db.commit()
    return {"inserted": inserted, "skipped": skipped}
