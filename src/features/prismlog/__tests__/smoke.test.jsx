import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NewLogForm } from "../forms";
import { DashboardPage, SettingsPage, TimelinePage } from "../pages";

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

  it("renders timeline and settings pages", () => {
    const timelineHtml = renderToStaticMarkup(
      <TimelinePage logs={[]} loading={false} layout={phoneLayout} />
    );
    const settingsHtml = renderToStaticMarkup(
      <SettingsPage readingLogs={[]} studyLogs={[]} cultureLogs={[]} layout={phoneLayout} />
    );

    expect(timelineHtml).toContain("Timeline");
    expect(settingsHtml).toContain("설정");
  });
});
