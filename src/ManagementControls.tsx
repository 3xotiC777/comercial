import { useEffect, useRef, useState } from "react";
import type { Ticket } from "./sharepoint";
import { loadTicketHistory } from "./sharepoint";
import { commitmentDay, deadlineState, emptyFilters, priorities, priorityFor } from "./ticketManagement";
import type { HistoryEvent, TicketFilters } from "./ticketManagement";
import { htmlToCsvText } from "./ticketCsv";
import "./TicketManagement.css";

export function TicketSearch({ tickets, filters, onChange, clear, count, total }: {
  tickets: Ticket[]; filters: TicketFilters; onChange: (value: TicketFilters) => void;
  clear: () => void; count: number; total: number;
}) {
  const select = (key: keyof TicketFilters, label: string, options: string[]) => <label key={key}>
    <span>{label}</span><select value={filters[key]} onChange={(e) => onChange({ ...filters, [key]: e.target.value })}>
      <option value="">Todos</option>{options.map((option) => <option key={option} value={option}>{option === "unassigned" ? "Sin asignar" : option}</option>)}
    </select>
  </label>;
  const unique = (key: "assignee" | "business" | "country" | "request_type") => [...new Set(tickets.map((ticket) => ticket[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  return <section className="ticket-search" aria-label="Buscar y filtrar solicitudes">
    <label className="search-field"><span>Buscar solicitud</span><input type="search" value={filters.search}
      placeholder="Ticket, solicitante, correo o palabras de la solicitud…"
      onChange={(e) => onChange({ ...filters, search: e.target.value })} /></label>
    <div className="ticket-filter-grid">
      {select("assignee", "Analista", [...unique("assignee"), "unassigned"])}
      {select("business", "Negocio", unique("business"))}
      {select("country", "País", unique("country"))}
      {select("type", "Tipo de solicitud", unique("request_type"))}
      {select("priority", "Prioridad automática", [...priorities])}
      {select("deadline", "Cumplimiento", ["Sin fecha", "Vencido", "Vence hoy", "Próximo a vencer", "En plazo", "Finalizado a tiempo", "Finalizado fuera de plazo", "Cierre sin fecha"])}
      <label><span>Creado desde</span><input type="date" value={filters.from} onChange={(e) => onChange({ ...filters, from: e.target.value })} /></label>
      <label><span>Creado hasta</span><input type="date" value={filters.to} onChange={(e) => onChange({ ...filters, to: e.target.value })} /></label>
    </div>
    {filters.from && filters.to && filters.from > filters.to && <p className="management-error" role="alert">La fecha desde no puede ser posterior a la fecha hasta.</p>}
    <div className="filter-summary"><p role="status">{count} de {total} solicitudes · filtros combinados con el periodo y estado seleccionados</p>
      <button className="ghost" type="button" onClick={() => { onChange({ ...emptyFilters }); clear(); }}>Limpiar filtros</button></div>
    <small>Los filtros de esta sección no cambian los indicadores de arriba ni el CSV completo. Fechas en hora de Bogotá.</small>
  </section>;
}

export function PriorityDeadline({ ticket, today }: { ticket: Ticket; today?: string }) {
  const status = deadlineState(ticket, today);
  const priority = priorityFor(ticket.request_type);
  return <div className="priority-deadline">
    <span className={`priority-tag priority-${priority.toLowerCase()}`}>Prioridad {priority || "sin regla"}</span>
    <span className={`deadline-tag ${status === "Vencido" ? "late" : ["Vence hoy", "Próximo a vencer"].includes(status) ? "soon" : ""}`}>
      {ticket.due_date ? `${status} · ${commitmentDay(ticket.due_date).split("-").reverse().join("/")}` : "Sin fecha compromiso"}
    </span>
  </div>;
}

export function TicketManagementDialog({ ticket, initialTab, onClose, onSave }: {
  ticket: Ticket; initialTab: "planning" | "history"; onClose: () => void;
  onSave: (patch: Partial<Ticket>) => Promise<boolean>;
}) {
  const [tab, setTab] = useState(initialTab);
  const [due, setDue] = useState(commitmentDay(ticket.due_date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (tab !== "history") return;
    let active = true;
    setLoading(true); setError(""); setEvents([]);
    void loadTicketHistory(ticket).then((result) => { if (active) setEvents(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "No se pudo consultar el historial."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, ticket, retry]);
  const dateLabel = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "Fecha no disponible";
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target && !saving) onClose(); }}>
    <section ref={dialog} tabIndex={-1} className="resolution-modal management-dialog" role="dialog" aria-modal="true" aria-labelledby="management-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !saving) onClose();
        if (e.key !== "Tab") return;
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]') || []);
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }}>
      <button className="modal-close" type="button" aria-label="Cerrar gestión del ticket" disabled={saving} onClick={onClose}>×</button>
      <div className="modal-kicker">Gestión · {ticket.id}</div><h2 id="management-title">Compromiso e historial</h2>
      <div className="management-tabs" aria-label="Sección de gestión">
        <button className="ghost" aria-pressed={tab === "planning"} disabled={saving} onClick={() => { setTab("planning"); setError(""); }}>Fecha compromiso</button>
        <button className="ghost" aria-pressed={tab === "history"} disabled={saving} onClick={() => { setTab("history"); setError(""); }}>Historial</button>
      </div>
      {tab === "planning" ? <form onSubmit={async (e) => {
        e.preventDefault(); if (saving) return;
        setSaving(true); setError("");
        try { if (await onSave({ due_date: due })) onClose(); else setError("No se guardó el cambio. Revisa el aviso del tablero y vuelve a intentarlo."); }
        catch { setError("No se pudo guardar la fecha compromiso."); }
        finally { setSaving(false); }
      }}>
        <PriorityDeadline ticket={ticket} />
        <p className="management-note">Prioridad automática: Muestra → Alta; Cotizaciones y Análisis → Media; Otros → Baja.</p>
        <label className="commitment-input"><span>Fecha compromiso</span><input type="date" value={due} disabled={saving} onChange={(e) => setDue(e.target.value)} /></label>
        <p className="management-note">Opcional. El plazo vence al finalizar ese día en Bogotá. Se considera próximo a vencer durante los tres días calendario anteriores.</p>
        <div className="management-actions"><button className="ghost" type="button" disabled={saving || !due} onClick={() => setDue("")}>Quitar fecha</button>
          <button className="primary" type="submit" disabled={saving || due === commitmentDay(ticket.due_date)}>{saving ? "Guardando…" : "Guardar compromiso"}</button></div>
      </form> : <div className="history-content">
        <p className="management-note">Versiones conservadas por SharePoint, de la más reciente a la más antigua. Los cambios no guardados o versiones eliminadas no se pueden recuperar aquí. Horas de Bogotá.</p>
        {loading && <p role="status">Consultando historial…</p>}
        {!loading && !error && !events.length && <p>No hay versiones disponibles para este ticket.</p>}
        <ol className="ticket-timeline">{events.map((event) => <li key={event.id}>
          <div className="history-heading"><strong>{event.initial ? event.id === "1.0" ? "Ticket creado" : "Primera versión disponible" : "Ticket actualizado"}</strong><small>Versión {event.id}</small></div>
          <p className="history-byline">{event.actor} · {dateLabel(event.at)}</p>
          {!event.changes.length && <p>Actualización sin cambios en los campos de seguimiento.</p>}
          {event.changes.map((change) => <div className="history-change" key={change.label}><b>{change.label}</b>
            <div>{!event.initial && <><span className="history-before">{htmlToCsvText(change.before) || "Sin valor"}</span><span aria-label="cambió a"> → </span></>}
              <span>{htmlToCsvText(change.after) || "Sin valor"}</span></div>
          </div>)}
        </li>)}</ol>
      </div>}
      {error && <div className="management-error" role="alert">{error}{tab === "history" && <button className="ghost" onClick={() => setRetry((n) => n + 1)}>Reintentar</button>}</div>}
    </section>
  </div>;
}
