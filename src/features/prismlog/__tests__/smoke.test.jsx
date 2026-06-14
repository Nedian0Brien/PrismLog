import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NewLogForm } from "../forms";
import { DashboardPage, ReadingGridCard, SettingsPage, TimelinePage } from "../pages";
import { GameDetailPage, GamePlayLogModal, ReadingDetailPage, ReadingNoteModal, ReadingProgressModal, StudyPage, groupStudiesByEntity } from "../pages/recordsPage";

const phoneLayout = {
  width: 390,
  mode: "phone",
  isPhone: true,
  isTablet: false,
  isDesktop: false,
  isTabletUp: false,
};

describe("PrismLog feature smoke", () => {
  it("renders dashboard page", () => {
    const html = renderToStaticMarkup(
      <DashboardPage
        logs={[]}
        stats={[]}
        recentLogs={[]}
        todayLabel="2026년 3월 11일"
        ringValues={{ reading: 0, study: 0, culture: 0 }}
        loading={false}
        error={null}
        layout={phoneLayout}
      />
    );

    expect(html).toContain("기록 대시보드");
  });

  it("renders study new log form", () => {
    const html = renderToStaticMarkup(
      <NewLogForm
        category="study"
        onSubmit={async () => {}}
        layout={phoneLayout}
        apiBaseUrl=""
        isOpen
      />
    );

    expect(html).toContain("기록할 대상을 선택하세요");
  });

  it("renders reading grid card", () => {
    const html = renderToStaticMarkup(
      <ReadingGridCard
        book={{
          id: "reading-grid-1",
          title: "그리드 카드 테스트",
          author: "테스트 저자",
          progress: 42,
          readPages: 84,
          pages: 200,
          rating: 4,
          review: "좋은 책",
          tags: ["테스트"],
          cover: "",
        }}
        onEdit={() => {}}
        onAdd={() => {}}
        layout={phoneLayout}
      />
    );

    expect(html).toContain("그리드 카드 테스트");
  });

  it("renders reading detail page and progress modal", () => {
    const book = {
      id: "reading-detail-1",
      title: "상세 독서 테스트",
      author: "테스트 저자",
      progress: 55,
      readPages: 110,
      pages: 200,
      rating: 4,
      review: "메모 테스트",
      tags: ["독서", "상세"],
      cover: "",
      publisher: "테스트 출판사",
      publishedDate: "2025-01-10",
      description: "상세 설명입니다.",
      readingSessions: [
        {
          id: "reading-session-1",
          date: "2026-03-15T10:40:00.000Z",
          startedAt: "2026-03-15T10:10:00.000Z",
          endedAt: "2026-03-15T10:40:00.000Z",
          fromPages: 0,
          toPages: 32,
          totalPages: 200,
          pagesRead: 32,
          fromProgress: 0,
          toProgress: 16,
          progressDelta: 16,
          durationMinutes: 30,
        },
      ],
      readingNotes: [
        {
          id: "reading-note-1",
          date: "2026-03-15T10:45:00.000Z",
          page: 32,
          text: "기억할 문장",
        },
        {
          id: "reading-note-2",
          date: "2026-03-15T10:50:00.000Z",
          page: 34,
          text: "두 번째 메모",
        },
      ],
    };

    const detailHtml = renderToStaticMarkup(
      <ReadingDetailPage
        book={book}
        layout={phoneLayout}
        onBack={() => {}}
        onEdit={() => {}}
        onAdd={() => {}}
        onAddNote={() => {}}
      />
    );

    const modalHtml = renderToStaticMarkup(
      <ReadingProgressModal
        book={book}
        layout={phoneLayout}
        saving={false}
        error=""
        currentPages="110"
        totalPages="200"
        startTime="10:10"
        endTime="10:40"
        note="메모 테스트"
        onCurrentPagesChange={() => {}}
        onTotalPagesChange={() => {}}
        onStartTimeChange={() => {}}
        onEndTimeChange={() => {}}
        onNoteChange={() => {}}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );

    const noteModalHtml = renderToStaticMarkup(
      <ReadingNoteModal
        book={book}
        layout={phoneLayout}
        saving={false}
        error=""
        page="32"
        note="기억할 문장"
        onPageChange={() => {}}
        onNoteChange={() => {}}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(detailHtml).toContain("Reading Detail");
    expect(detailHtml).toContain("상세 독서 테스트");
    expect(detailHtml).toContain("32p");
    expect(detailHtml).toContain("읽음");
    expect(detailHtml).toContain("메모 스니펫");
    expect(detailHtml).toContain("독서 피드");
    expect(detailHtml).not.toContain("NaN");
    expect(modalHtml).toContain("읽은 페이지 추가");
    expect(modalHtml).toContain("독서 시작 시각");
    expect(modalHtml).toContain("독서 종료 시각");
    expect(noteModalHtml).toContain("페이지 정보");
    expect(noteModalHtml).toContain("p.");
  });

  it("renders timeline and settings pages", () => {
    const timelineLogs = [
      {
        id: "timeline-reading-1",
        category: "reading",
        title: "테스트 독서 로그",
        summary: "타임라인 렌더 확인",
        created_at: "2026-03-12T09:00:00.000Z",
        payload: { pages_read: 12, pages_total: 120 },
      },
    ];
    const timelineHtml = renderToStaticMarkup(
      <TimelinePage logs={timelineLogs} loading={false} layout={phoneLayout} />
    );
    const settingsHtml = renderToStaticMarkup(
      <SettingsPage
        readingLogs={[]}
        studyLogs={[]}
        cultureLogs={[]}
        layout={phoneLayout}
        backupState={{
          saving: false,
          error: "",
          result: {
            fileName: "prismlog-backup-demo-user-20260614T123000Z.json",
            counts: { entities: 1, logs: 3 },
          },
        }}
        onCreateBackup={() => {}}
      />
    );

    expect(timelineHtml).toContain("테스트 독서 로그");
    expect(settingsHtml).toContain("설정");
    expect(settingsHtml).toContain("Google Drive 백업");
    expect(settingsHtml).toContain("Drive에 저장");
    expect(settingsHtml).toContain("prismlog-backup-demo-user-20260614T123000Z.json");
    expect(settingsHtml).toContain("로그 3개");
  });

  it("renders series episodes on the watched date in timeline", () => {
    const timelineLogs = [
      {
        id: "timeline-series-1",
        category: "culture",
        title: "세브란스",
        created_at: "2026-03-10T09:00:00.000Z",
        entity: {
          title: "세브란스",
          category: "시리즈",
          entity_metadata: {
            title: "세브란스",
            type: "시리즈",
            seasons: [
              {
                season_number: 1,
                episodes: [
                  { episode_number: 1, name: "좋은 소식입니다", overview: "첫 번째 에피소드 줄거리" },
                  { episode_number: 2, name: "반쪽짜리 루틴", overview: "마지막 에피소드 줄거리" },
                ],
              },
            ],
          },
        },
        payload: {
          type: "시리즈",
          watched_episode_count: 2,
          progress: 100,
          seasons: [
            {
              season_number: 1,
              episodes: [
                { episode_number: 1, name: "좋은 소식입니다", overview: "첫 번째 에피소드 줄거리" },
                { episode_number: 2, name: "반쪽짜리 루틴", overview: "마지막 에피소드 줄거리" },
              ],
            },
          ],
          episode_watch_dates: {
            "1-1": "2026-03-18T21:00:00.000Z",
            "1-2": "2026-03-18T22:00:00.000Z",
          },
        },
      },
    ];

    const timelineHtml = renderToStaticMarkup(
      <TimelinePage logs={timelineLogs} loading={false} layout={phoneLayout} />
    );

    expect(timelineHtml).toContain("세브란스");
    expect(timelineHtml).toContain("+2화");
    expect(timelineHtml).toContain("S1 · E1");
    expect(timelineHtml).toContain("마지막 에피소드 줄거리");
    expect(timelineHtml).not.toContain("첫 번째 에피소드 줄거리");
  });

  it("assigns unique timeline item keys for series entries split across watched dates", () => {
    const timelineLogs = [
      {
        id: "timeline-series-2",
        category: "culture",
        title: "안도르",
        created_at: "2026-03-10T09:00:00.000Z",
        entity: {
          title: "안도르",
          category: "시리즈",
          entity_metadata: {
            title: "안도르",
            type: "시리즈",
            seasons: [
              {
                season_number: 1,
                episodes: [
                  { episode_number: 1, name: "E1" },
                  { episode_number: 2, name: "E2" },
                ],
              },
            ],
          },
        },
        payload: {
          type: "시리즈",
          watched_episode_count: 2,
          progress: 100,
          seasons: [
            {
              season_number: 1,
              episodes: [
                { episode_number: 1, name: "E1" },
                { episode_number: 2, name: "E2" },
              ],
            },
          ],
          episode_watch_dates: {
            "1-1": "2026-03-17T21:00:00.000Z",
            "1-2": "2026-03-18T22:00:00.000Z",
          },
        },
      },
    ];

    const timelineHtml = renderToStaticMarkup(
      <TimelinePage logs={timelineLogs} loading={false} layout={phoneLayout} />
    );

    expect(timelineHtml).toContain('data-item-key="timeline-series-2-series-2026-03-19"');
    expect(timelineHtml).toContain('data-item-key="timeline-series-2-series-2026-03-18"');
  });

  it("renders game detail page and gameplay log modal", () => {
    const game = {
      id: "game-detail-1",
      type: "게임",
      title: "하데스 II",
      status: "플레이 중",
      rating: 4.5,
      tags: ["로그라이크"],
      poster: "",
      releaseDate: "2026-03-01",
      summary: "탈출 루트를 다시 깎는 중",
      gameSessions: [
        {
          id: "game-session-1",
          date: "2026-03-15T12:00:00.000Z",
          playedAt: "2026-03-15T12:00:00.000Z",
          durationMinutes: 95,
          note: "보스 패턴 연습",
        },
      ],
    };

    const detailHtml = renderToStaticMarkup(
      <GameDetailPage
        item={game}
        layout={phoneLayout}
        onBack={() => {}}
        onEdit={() => {}}
        onAddSession={() => {}}
      />
    );
    const modalHtml = renderToStaticMarkup(
      <GamePlayLogModal
        item={game}
        layout={phoneLayout}
        saving={false}
        error=""
        durationMinutes="95"
        playedDate="2026-03-15"
        note="보스 패턴 연습"
        onDurationChange={() => {}}
        onPlayedDateChange={() => {}}
        onNoteChange={() => {}}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(detailHtml).toContain("Game Detail");
    expect(detailHtml).toContain("플레이 캘린더");
    expect(detailHtml).toContain("플레이 로그");
    expect(detailHtml).toContain("하데스 II");
    expect(modalHtml).toContain("게임 플레이 기록");
    expect(modalHtml).toContain("플레이 시간");
    expect(modalHtml).toContain("플레이 날짜");
  });

  it("groups study activities by entity and keeps activities in study timeline data", () => {
    const studyLogs = [
      {
        id: "study-log-2",
        entityId: "study-entity-1",
        entityTitle: "운영체제 3회독",
        activityTitle: "358p까지 공부",
        title: "358p까지 공부",
        summary: "메모리 관리 파트 복습",
        progressMode: "page",
        pagesRead: 358,
        pagesTotal: 500,
        progress: 72,
        tags: ["cs"],
        imageUrl: "",
        occurredAt: "2026-03-16T11:20:00.000Z",
        createdAt: "2026-03-16T11:20:00.000Z",
        chapters: [],
        completed: [],
      },
      {
        id: "study-log-1",
        entityId: "study-entity-1",
        entityTitle: "운영체제 3회독",
        activityTitle: "운영체제 3회독",
        title: "운영체제 3회독",
        summary: "학습 시작",
        progressMode: "page",
        pagesRead: 120,
        pagesTotal: 500,
        progress: 24,
        tags: ["cs"],
        imageUrl: "",
        occurredAt: "2026-03-10T09:00:00.000Z",
        createdAt: "2026-03-10T09:00:00.000Z",
        chapters: [],
        completed: [],
      },
    ];

    const grouped = groupStudiesByEntity(studyLogs);
    const html = renderToStaticMarkup(
      <StudyPage
        studies={studyLogs}
        loading={false}
        onEdit={() => {}}
        onSave={async () => {}}
        layout={phoneLayout}
      />
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0].title).toBe("운영체제 3회독");
    expect(grouped[0].activities).toHaveLength(2);
    expect(grouped[0].activities[0].title).toBe("358p까지 공부");
    expect(grouped[0].activities[1].title).toBe("공부 시작");
    expect(html).toContain("운영체제 3회독");
    expect(html).not.toContain("358p까지 공부</h4>");
  });
});
