import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { call } from "../inventory/labels";
import type { Activity } from "../activities/activities";

export type CompanyOverview = components["schemas"]["CompanyOverviewItem"];
export type CurrentUser = components["schemas"]["CurrentUserResponse"];

/** Company overview; the key starts with "companies-overview" so activity mutations refresh it. */
export function useCompaniesOverview(enabled = true) {
  return useQuery({
    queryKey: ["companies-overview", "all"],
    enabled,
    retry: false,
    queryFn: () => call(() => api.GET("/api/v1/companies/overview")),
  });
}

/** Advisor performance (admin only); the key starts with "advisor-report". */
export function useAdvisorReport(enabled = true) {
  return useQuery({
    queryKey: ["advisor-report"],
    enabled,
    retry: false,
    queryFn: () => call(() => api.GET("/api/v1/reports/advisors")),
  });
}

export function companyName(company: CompanyOverview) {
  return company.trade_name || company.legal_name;
}

export function roleLabel(role: CurrentUser["role"]) {
  return role === "admin" ? "Administrador" : "Asesor";
}

const DAY = 24 * 60 * 60 * 1000;

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function byDue(a: Activity, b: Activity) {
  return a.due_at.localeCompare(b.due_at);
}

/** Splits pending activities into overdue, due today and upcoming, each sorted by due date. */
export function groupPending(items: Activity[], now = new Date()) {
  const overdue: Activity[] = [];
  const today: Activity[] = [];
  const upcoming: Activity[] = [];
  for (const activity of items) {
    if (activity.status !== "pending") continue;
    const due = new Date(activity.due_at);
    if (activity.overdue || due < now) overdue.push(activity);
    else if (sameDay(due, now)) today.push(activity);
    else upcoming.push(activity);
  }
  const nextWeek = now.getTime() + 7 * DAY;
  return {
    overdue: overdue.sort(byDue),
    today: today.sort(byDue),
    upcoming: upcoming.sort(byDue),
    // Upcoming after today within a week; today's work has its own tile.
    nextSevenDays: upcoming.filter(
      (a) => new Date(a.due_at).getTime() <= nextWeek,
    ).length,
  };
}

/** Done activities, most recently completed first. */
export function recentlyCompleted(items: Activity[], limit = 5) {
  return items
    .filter((activity) => activity.status === "done")
    .sort((a, b) =>
      (b.completed_at ?? b.due_at).localeCompare(a.completed_at ?? a.due_at),
    )
    .slice(0, limit);
}

export function completedWithin(
  items: Activity[],
  days: number,
  now = new Date(),
) {
  const since = now.getTime() - days * DAY;
  return items.filter(
    (activity) =>
      activity.status === "done" &&
      activity.completed_at !== null &&
      new Date(activity.completed_at).getTime() >= since,
  ).length;
}
