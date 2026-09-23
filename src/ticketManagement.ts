import type { Ticket } from "./sharepoint";

export const priorities = ["Alta", "Media", "Baja"] as const;
export type Priority = typeof priorities[number];
export function priorityFor(type: string): Priority | "" {
  const normalized = type.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (normalized === "muestra") return "Alta";
  if (["cotizaciones", "cotizacion", "analisis"].includes(normalized)) return "Media";
  return normalized === "otros" ? "Baja" : "";
}
export function dayInBogota(value: string | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const data = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${data.year}-${data.month}-${data.day}`;
}
export function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function commitmentDay(value?: string): string {
  const day = (value || "").slice(0, 10);
  return validDay(day) ? day : "";
}
export function deadlineState(ticket: Pick<Ticket, "due_date" | "status" | "completed_at">, today = dayInBogota(new Date())): string {
  const due = commitmentDay(ticket.due_date);
  if (!due) return "Sin fecha";
  if (ticket.status === "Finalizado") {
    const closed = ticket.completed_at ? dayInBogota(ticket.completed_at) : "";
    return !closed ? "Cierre sin fecha" : closed <= due ? "Finalizado a tiempo" : "Finalizado fuera de plazo";
  }
  if (due < today) return "Vencido";
  if (due === today) return "Vence hoy";
  const days = (Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000;
  return days <= 3 ? "Próximo a vencer" : "En plazo";
}
export const emptyFilters = { search: "", assignee: "", business: "", country: "", type: "", priority: "", deadline: "", from: "", to: "" };
export type TicketFilters = typeof emptyFilters;
const normalText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filterTickets(tickets: Ticket[], filters: TicketFilters, today?: string): Ticket[] {
  const words = normalText(filters.search.trim()).split(/\s+/).filter(Boolean);
  return tickets.filter((ticket) => {
    const day = dayInBogota(ticket.created_at);
    const text = normalText([ticket.id, ticket.requester_name, ticket.requester_email, ticket.assignee, ticket.business, ticket.country, ticket.study, ticket.request_type, ticket.detail.replace(/<[^>]*>/g, " "), ticket.resolution?.replace(/<[^>]*>/g, " ")].join(" "));
    return words.every((word) => text.includes(word)) &&
      (!filters.assignee || (filters.assignee === "unassigned" ? !ticket.assignee : ticket.assignee === filters.assignee)) &&
      (!filters.business || ticket.business === filters.business) &&
      (!filters.country || ticket.country === filters.country) &&
      (!filters.type || ticket.request_type === filters.type) &&
      (!filters.priority || priorityFor(ticket.request_type) === filters.priority) &&
      (!filters.deadline || deadlineState(ticket, today) === filters.deadline) &&
      (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
  });
}

export type HistoryVersion = { id: string; at: string; actor: string; fields: Record<string, string> };
export type HistoryEvent = HistoryVersion & { changes: { label: string; before: string; after: string }[]; initial: boolean };
const historyLabels: Record<string, string> = {
  status: "Estado", assignee: "Responsable", priority: "Prioridad según tipo", dueDate: "Fecha compromiso",
  resolution: "Respuesta final", detail: "Solicitud", cc: "Con copia", completedAt: "Fecha de cierre",
  startedAt: "Fecha de inicio", business: "Negocio", country: "País", study: "Estudio", type: "Tipo de solicitud",
  attachment: "Adjuntos", resolutionFiles: "Adjuntos de la solución", name: "Solicitante", email: "Correo",
};
export const historyKeys = Object.keys(historyLabels);
export function historyEvents(versions: HistoryVersion[]): HistoryEvent[] {
  const ordered = [...versions].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return ordered.map((version, index) => ({ ...version, initial: index === 0,
    changes: historyKeys.flatMap((key) => {
      const before = ordered[index - 1]?.fields[key] || "";
      const after = version.fields[key] || "";
      return before === after ? [] : [{ label: historyLabels[key], before, after }];
    }),
  })).reverse();
}
