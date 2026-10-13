import type { Ticket } from "./sharepoint";
import { commitmentDay, dayInBogota, deadlineState, validDay } from "./ticketManagement.ts";

const DAY = 86_400_000;
const statuses = ["Pendiente", "En proceso", "Finalizado"] as const;

function timestamp(value?: string): number | null {
  if (!value?.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value) && !validDay(value.slice(0, 10))) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

/** Reopened tickets and impossible, future, or missing final dates are not closures. */
export function validClosure(ticket: Ticket, now = new Date()): number | null {
  if (ticket.status !== "Finalizado") return null;
  const created = timestamp(ticket.created_at);
  const completed = timestamp(ticket.completed_at);
  return created !== null && completed !== null && completed >= created && completed <= now.getTime()
    ? completed : null;
}

export function monthBounds(month: string): { from: string; to: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { from: "", to: "" };
  const [year, number] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${lastDay}` };
}

export function monthLabel(month: string, short = false): string {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota", month: short ? "short" : "long", ...(short ? {} : { year: "numeric" }),
  });
}

function countBy(tickets: Ticket[], field: "country" | "request_type") {
  const counts = new Map<string, number>();
  tickets.forEach((ticket) => {
    const key = ticket[field].trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts].map(([key, count]) => ({ key, label: key || "Sin dato", count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

export function buildTicketAnalytics(tickets: Ticket[], month = "", now = new Date()) {
  const today = dayInBogota(now);
  const endMonth = monthBounds(month).from ? month : today.slice(0, 7);
  const months = Array.from({ length: 6 }, (_, index) => {
    const [year, number] = endMonth.split("-").map(Number);
    return new Date(Date.UTC(year, number - 6 + index, 15)).toISOString().slice(0, 7);
  });
  const cohort = month ? tickets.filter((ticket) => timestamp(ticket.created_at) !== null && dayInBogota(ticket.created_at).slice(0, 7) === month) : tickets;
  const finalized = cohort.filter((ticket) => ticket.status === "Finalizado");
  const active = cohort.filter((ticket) => ticket.status !== "Finalizado");
  const closures = finalized.flatMap((ticket) => {
    const completed = validClosure(ticket, now);
    return completed === null ? [] : [{ ticket, completed, days: (completed - Date.parse(ticket.created_at)) / DAY }];
  });
  const eligibleCommitments = closures.filter(({ ticket }) => commitmentDay(ticket.due_date));
  const onTime = eligibleCommitments.filter(({ ticket, completed }) => dayInBogota(new Date(completed)) <= commitmentDay(ticket.due_date)).length;
  const late = active.filter((ticket) => deadlineState(ticket, today) === "Vencido").length;
  const dueToday = active.filter((ticket) => deadlineState(ticket, today) === "Vence hoy").length;
  const noCommitment = active.filter((ticket) => !commitmentDay(ticket.due_date)).length;
  const aging = [
    { label: "0–2 días", min: 0, max: 2, count: 0 },
    { label: "3–7 días", min: 3, max: 7, count: 0 },
    { label: "8–14 días", min: 8, max: 14, count: 0 },
    { label: "15+ días", min: 15, max: Infinity, count: 0 },
  ];
  let unknownAge = 0;
  active.forEach((ticket) => {
    const created = timestamp(ticket.created_at);
    const day = created === null ? "" : dayInBogota(ticket.created_at);
    if (!day || created! > now.getTime()) { unknownAge++; return; }
    const age = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / DAY);
    const band = aging.find((item) => age >= item.min && age <= item.max);
    if (band) band.count++;
  });
  const closureDays = new Map(closures.map(({ ticket, days }) => [ticket, days]));
  const analysts = new Map<string, { name: string; key: string; pending: number; inProgress: number; completed: number; active: number; total: number; validClosures: number; closureDays: number }>();
  cohort.forEach((ticket) => {
    const key = ticket.assignee || "unassigned";
    const row = analysts.get(key) || { name: ticket.assignee || "Sin asignar", key, pending: 0, inProgress: 0, completed: 0, active: 0, total: 0, validClosures: 0, closureDays: 0 };
    row.total++;
    if (ticket.status === "Finalizado") row.completed++;
    else { row.active++; if (ticket.status === "En proceso") row.inProgress++; else row.pending++; }
    const elapsed = closureDays.get(ticket);
    if (elapsed !== undefined) { row.validClosures++; row.closureDays += elapsed; }
    analysts.set(key, row);
  });
  const trend = months.map((key) => ({ key, label: monthLabel(key, true), created: 0, completed: 0 }));
  const trendByMonth = new Map(trend.map((row) => [row.key, row]));
  tickets.forEach((ticket) => {
    const created = timestamp(ticket.created_at);
    if (created !== null && created <= now.getTime()) {
      const bucket = trendByMonth.get(dayInBogota(ticket.created_at).slice(0, 7));
      if (bucket) bucket.created++;
    }
    const closed = validClosure(ticket, now);
    if (closed !== null) {
      const bucket = trendByMonth.get(dayInBogota(new Date(closed)).slice(0, 7));
      if (bucket) bucket.completed++;
    }
  });
  return {
    total: cohort.length, finalized: finalized.length, active: active.length,
    completionRate: cohort.length ? finalized.length / cohort.length * 100 : null,
    averageClosureDays: closures.length ? closures.reduce((sum, item) => sum + item.days, 0) / closures.length : null,
    validClosures: closures.length, excludedClosures: finalized.length - closures.length,
    commitmentRate: eligibleCommitments.length ? onTime / eligibleCommitments.length * 100 : null,
    eligibleCommitments: eligibleCommitments.length, onTime, lateClosures: eligibleCommitments.length - onTime,
    excludedCommitments: finalized.length - eligibleCommitments.length,
    late, dueToday, noCommitment, unassigned: active.filter((ticket) => !ticket.assignee).length,
    aging, unknownAge, countries: countBy(cohort, "country"), types: countBy(cohort, "request_type"),
    analysts: [...analysts.values()].map((row) => ({ ...row, completionRate: row.completed / row.total * 100,
      averageClosureDays: row.validClosures ? row.closureDays / row.validClosures : null,
    })).sort((a, b) => b.active - a.active || b.total - a.total || a.name.localeCompare(b.name, "es")),
    statuses: statuses.map((status) => ({ status, count: cohort.filter((ticket) => ticket.status === status).length })),
    trend, today,
    availableMonths: [...new Set(tickets.filter((ticket) => {
      const created = timestamp(ticket.created_at); return created !== null && created <= now.getTime();
    }).map((ticket) => dayInBogota(ticket.created_at).slice(0, 7)))].sort().reverse(),
  };
}

export type TicketAnalytics = ReturnType<typeof buildTicketAnalytics>;
