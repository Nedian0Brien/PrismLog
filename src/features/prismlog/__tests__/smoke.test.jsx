import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NewLogForm } from "../forms";
import { DashboardPage, ReadingGridCard, SettingsPage, TimelinePage } from "../pages";
import { ReadingDetailPage, ReadingProgressModal } from "../pages/recordsPage";

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
    };

    const detailHtml = renderToStaticMarkup(
      <ReadingDetailPage
        book={book}
        layout={phoneLayout}
        onBack={() => {}}
        onEdit={() => {}}
        onAdd={() => {}}
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
        note="메모 테스트"
        onCurrentPagesChange={() => {}}
        onTotalPagesChange={() => {}}
        onNoteChange={() => {}}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(detailHtml).toContain("Reading Detail");
    expect(detailHtml).toContain("상세 독서 테스트");
    expect(modalHtml).toContain("읽은 페이지 추가");
    expect(modalHtml).toContain("진행 슬라이더");
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
