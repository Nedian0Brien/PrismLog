import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NewLogForm } from "../forms";
import { DashboardPage, ReadingGridCard, SettingsPage, TimelinePage } from "../pages";

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

    expect(html).toContain("기록 저장하기");
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
      <SettingsPage readingLogs={[]} studyLogs={[]} cultureLogs={[]} layout={phoneLayout} />
    );

    expect(timelineHtml).toContain("테스트 독서 로그");
    expect(settingsHtml).toContain("설정");
  });
});
