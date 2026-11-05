"use client";

import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { formatShort } from "@/lib/canvas/dates";
import type { ISODate, Task } from "@/lib/canvas/types";
import { useCanvas } from "./provider";
import { Field, Sheet } from "./sheet";

/** The next whole hour, e.g. "15:00" (stays at 23:00 late in the evening). */
function nextHour(): string {
  const h = Math.min(23, new Date().getHours() + 1);
  return `${String(h).padStart(2, "0")}:00`;
}
const plusHour = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Ask for a time, then turn a task into an appointment on that day (with Undo). */
export function ToAppointmentSheet({ task, date, onClose, onDone }: { task: Task; date: ISODate; onClose: () => void; onDone?: () => void }) {
  const { planner, toast } = useCanvas();
  const [start, setStart] = useState(nextHour);
  const [end, setEnd] = useState(() => plusHour(nextHour()));
  const [location, setLocation] = useState("");
  const save = () => {
    const appt = planner.toAppointment(task, date, { start_time: start || null, end_time: end && start && end > start ? end : null, location: location.trim() || null });
    toast(`“${task.title}” is now an appointment on ${formatShort(date)}`, { label: "Undo", run: () => planner.undoToAppointment(task, appt.id) });
    onClose();
    onDone?.();
  };
  return (
    <Sheet
      title="Make it an appointment"
      onClose={onClose}
      footer={
        <>
          <button className="dc-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="dc-btn dc-btn-primary" onClick={save}>
            <CalendarClock size={15} /> Make appointment
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm">
        <b>{task.title}</b> moves to Appointments on {formatShort(date)}. Its notes come along.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">
          <input
            type="time"
            className="dc-field"
            value={start}
            onChange={(e) => {
              const v = e.target.value;
              if (v && (!end || end <= start || end <= v)) setEnd(plusHour(v));
              setStart(v);
            }}
          />
        </Field>
        <Field label="Ends (optional)">
          <input type="time" className="dc-field" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Where (optional)">
          <input className="dc-field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office, Zoom, address…" />
        </Field>
      </div>
    </Sheet>
  );
}
