import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  activityKindLabels,
  useActivities,
  type Activity,
} from "../activities/activities";
import { Panel } from "../../components/ui";

const DAY_MS = 24 * 60 * 60 * 1000;
const weekdayFormat = new Intl.DateTimeFormat("es-PE", { weekday: "short" });
const dayFormat = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Monday 00:00 (local time) of the week containing `date`. */
export function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - offset);
  return start;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Weekly agenda of activities (all statuses), Monday to Sunday, with week navigation. */
export function Agenda({
  title = "Agenda de la semana",
  showOwner = false,
}: {
  title?: string;
  showOwner?: boolean;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = useMemo(
    () => new Date(weekStart.getTime() + 7 * DAY_MS),
    [weekStart],
  );
  const activities = useActivities({
    due_after: weekStart.toISOString(),
    due_before: weekEnd.toISOString(),
    limit: 500,
  });
  const today = new Date();
  const days = Array.from(
    { length: 7 },
    (_, index) => new Date(weekStart.getTime() + index * DAY_MS),
  );
  const items = (activities.data?.items ?? []).filter(
    (item) => item.status !== "cancelled",
  );
  const byDay = days.map((day) =>
    items
      .filter((item) => sameDay(new Date(item.due_at), day))
      .sort((a, b) => a.due_at.localeCompare(b.due_at)),
  );
  const isCurrentWeek = sameDay(weekStart, startOfWeek(today));
  const move = (weeks: number) =>
    setWeekStart(new Date(weekStart.getTime() + weeks * 7 * DAY_MS));
  const rangeLabel = `${dayFormat.format(days[0])} – ${dayFormat.format(days[6])}`;

  return (
    <Panel
      title={title}
      actions={
        <span className="agenda-nav">
          <button
            type="button"
            className="secondary-action"
            onClick={() => move(-1)}
            aria-label="Semana anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="secondary-action"
            disabled={isCurrentWeek}
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Hoy
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => move(1)}
            aria-label="Semana siguiente"
          >
            ›
          </button>
          <span className="agenda-range" aria-live="polite">
            {rangeLabel}
          </span>
        </span>
      }
    >
      {activities.isError && (
        <p className="form-error" role="alert">
          {activities.error.message}
        </p>
      )}
      <div className="agenda-week" aria-busy={activities.isFetching}>
        {days.map((day, index) => {
          const isToday = sameDay(day, today);
          const dayItems = byDay[index];
          return (
            <section
              key={day.toISOString()}
              className={`agenda-day${isToday ? " is-today" : ""}`}
              aria-label={`${weekdayFormat.format(day)} ${dayFormat.format(day)}${isToday ? " (hoy)" : ""}`}
            >
              <header>
                <span className="agenda-weekday">
                  {weekdayFormat.format(day)}
                </span>
                <span className="agenda-date">{day.getDate()}</span>
              </header>
              {dayItems.length === 0 ? (
                <p className="agenda-empty">Sin actividades</p>
              ) : (
                <DayItems items={dayItems} showOwner={showOwner} />
              )}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

const VISIBLE_PER_DAY = 4;

function DayItems({
  items,
  showOwner,
}: {
  items: Activity[];
  showOwner: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, VISIBLE_PER_DAY);
  const hidden = items.length - visible.length;
  return (
    <>
      <ul>
        {visible.map((item) => (
          <AgendaItem key={item.id} item={item} showOwner={showOwner} />
        ))}
      </ul>
      {items.length > VISIBLE_PER_DAY && (
        <button
          type="button"
          className="agenda-more"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Ver menos" : `Ver ${hidden} más`}
        </button>
      )}
    </>
  );
}

function AgendaItem({
  item,
  showOwner,
}: {
  item: Activity;
  showOwner: boolean;
}) {
  const state =
    item.status === "done" ? "is-done" : item.overdue ? "is-overdue" : "";
  return (
    <li className={`agenda-item ws-kind-${item.kind} ${state}`}>
      <Link to={`/empresas/${item.company_id}?tab=actividades`}>
        <span className="agenda-time">
          {timeFormat.format(new Date(item.due_at))} ·{" "}
          {activityKindLabels[item.kind]}
          {item.status === "done" && " · Hecha"}
          {item.overdue && " · Vencida"}
        </span>
        <span className="agenda-title">{item.title}</span>
        <span className="agenda-company">
          {item.company_name}
          {showOwner && ` · ${item.owner_email.split("@")[0]}`}
        </span>
      </Link>
    </li>
  );
}
