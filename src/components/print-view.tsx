"use client";

import { Printer } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatLong, isISODate } from "@/lib/canvas/dates";
import { resolveOrder } from "@/lib/canvas/sections";
import { renderSection, useDayProgress } from "./day-view";
import { DailyQuote } from "./daily-quote";
import { useCanvas } from "./provider";

// US Letter at 96 px per inch, minus 0.4in margins: the area the day must fit in.
const PAGE_W = 8.5 * 96 - 2 * 0.4 * 96;
const PAGE_H = 11 * 96 - 2 * 0.4 * 96;
// The day is laid out at this width, then scaled down to fit the page.
const SHEET_W = 1080;

/** The whole day on one letter-size page. The preview on screen is exactly what prints. */
export function PrintView() {
  const { date, setDate, prefs } = useCanvas();
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    if (d && isISODate(d)) setDate(d);
  }, [setDate]);
  const p = useDayProgress(date);
  const order = resolveOrder(prefs.section_order).filter((k) => !prefs.hidden_sections.includes(k));

  const sheet = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(PAGE_H);
  const scale = Math.min(PAGE_W / SHEET_W, PAGE_H / Math.max(1, height));
  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const fit = () => setHeight(el.offsetHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="px-4 py-6 print:p-0">
      <div className="dc-noprint mx-auto mb-4 flex max-w-[8.5in] flex-wrap items-center gap-2">
        <button className="dc-btn dc-btn-primary" onClick={() => window.print()}>
          <Printer size={15} /> Print or save as PDF
        </button>
        <span className="text-xs" style={{ color: "var(--dc-muted)" }}>
          Fits on one letter-size page. In the print dialog, keep Scale at 100% (or “Default”).
        </span>
      </div>
      <div className="dc-print-paper">
        <div className="dc-print-fit" style={{ width: SHEET_W * scale, height: height * scale }}>
          <div ref={sheet} className="dc-print-sheet" style={{ width: SHEET_W, transform: `scale(${scale})` }}>
            <header className="flex items-end gap-4">
              <h1 className="dc-serif text-[2.1rem] leading-tight">{formatLong(date)}</h1>
              <p className="ml-auto pb-1 text-sm" style={{ color: "var(--dc-muted)" }}>
                {p.planned ? `${p.completedPlanned} of ${p.planned} done` : ""}
              </p>
            </header>
            <DailyQuote date={date} compact />
            <div className="mt-4 columns-3 gap-4 [&>*]:mb-4">{order.map((k) => renderSection(k, date))}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
