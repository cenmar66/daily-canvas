"use client";

import { useState } from "react";
import { customLine, quoteForDay } from "@/lib/canvas/quotes";
import type { ISODate } from "@/lib/canvas/types";
import { useCanvas } from "./provider";

/** A centred quote under the date: today's quote, or your own line from Settings. Tap for another. */
export function DailyQuote({ date, compact = false }: { date: ISODate; compact?: boolean }) {
  const { prefs } = useCanvas();
  const [offset, setOffset] = useState(0);
  const [shownFor, setShownFor] = useState(date);
  if (shownFor !== date) {
    setShownFor(date);
    setOffset(0);
  }
  const own = customLine(prefs.tagline);
  const q = own ? null : quoteForDay(date, offset);

  const body = (
    <>
      <span className={`dc-serif italic leading-snug ${compact ? "text-[1rem]" : "text-[1.05rem] md:text-[1.2rem]"}`} style={{ color: "var(--dc-ink)" }}>
        “{own ?? q!.text}”
      </span>
      {q && (
        <span className="mt-1.5 block text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--dc-muted)" }}>
          {q.by}
          {q.source && <span className="font-normal normal-case tracking-normal italic"> · {q.source}</span>}
        </span>
      )}
    </>
  );

  return (
    <figure className="dc-quote" aria-label="Quote of the day">
      <span className="dc-quote-rule" aria-hidden />
      {q ? (
        <button type="button" className="dc-quote-text" title="Show another quote" onClick={() => setOffset((o) => o + 1)}>
          {body}
        </button>
      ) : (
        <blockquote className="dc-quote-text">{body}</blockquote>
      )}
      <span className="dc-quote-rule" aria-hidden />
    </figure>
  );
}
