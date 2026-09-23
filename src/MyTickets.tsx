import { useRef, useState } from "react";
import { loadMyTickets } from "./sharepoint";
import type { Status, Ticket } from "./sharepoint";
import "./MyTickets.css";
import { commitmentDay, deadlineState, priorityFor } from "./ticketManagement";

const statuses = ["Todos", "Pendiente", "En proceso", "Finalizado"] as const;
const dateLabel = (value?: string) => {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "No registrada";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
};

// Render stored rich text as text, never as executable HTML.
function ticketText(value: string) {
  const doc = new DOMParser().parseFromString(
    value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n"),
    "text/html",
  );
  doc.querySelectorAll("script,style,iframe,object").forEach((node) => node.remove());
  doc.querySelectorAll("img").forEach((node) => node.replaceWith("[Imagen adjunta al texto]"));
  return doc.body.textContent?.trim() || "Sin texto registrado.";
}

export default function MyTickets({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [consultedEmail, setConsultedEmail] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<"Todos" | Status>("Todos");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const shown = tickets.filter((ticket) => filter === "Todos" || ticket.status === filter);

  const consult = async () => {
    const currentRequest = ++requestId.current;
    setBusy(true);
    setError("");
    setTickets([]);
    setConsultedEmail("");
    try {
      const results = await loadMyTickets();
      if (currentRequest !== requestId.current) return;
      setTickets(results.tickets);
      setConsultedEmail(results.email);
    } catch (cause) {
      if (currentRequest === requestId.current)
        setError(cause instanceof Error ? cause.message : "No se pudo consultar el historial. Inténtalo nuevamente.");
    } finally {
      if (currentRequest === requestId.current) setBusy(false);
    }
  };
  const changeAccount = async () => {
    ++requestId.current;
    setBusy(true);
    setError("");
    setTickets([]);
    setConsultedEmail("");
    try {
      await onSignOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cerrar la sesión de Microsoft.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dash fade my-tickets" aria-labelledby="my-tickets-title">
      <div className="dash-head">
        <div>
          <div className="eyebrow">D&N · SEGUIMIENTO DE SOLICITUDES</div>
          <h1 id="my-tickets-title">Mis tickets</h1>
          <p>Consulta tus solicitudes, su estado actual y la respuesta del equipo.</p>
        </div>
      </div>
      {!consultedEmail && <div className="panel my-tickets-search">
        <div>
          <h2>Consulta tus solicitudes</h2>
          <p>Inicia sesión con tu cuenta corporativa de Microsoft para ver tu historial de tickets.</p>
        </div>
        <button className="primary" type="button" disabled={busy} onClick={() => {
          setFilter("Todos");
          void consult();
        }}>
          {busy ? "Consultando…" : "Iniciar sesión con Microsoft"} <b aria-hidden="true">→</b>
        </button>
        <button className="my-account-change" type="button" disabled={busy} onClick={() => void changeAccount()}>
          Cambiar cuenta de Microsoft
        </button>
      </div>}
      {error && <p className="my-tickets-error" role="alert">{error}</p>}
      {busy && <p role="status">Consultando tu historial en SharePoint…</p>}
      {consultedEmail && !busy && (
        <div className="panel my-tickets-results">
          <div className="table-head">
            <div>
              <h2>Historial de solicitudes</h2>
              <p role="status">{tickets.length} ticket(s) · {consultedEmail}</p>
            </div>
            <div className="my-ticket-actions">
              <button className="ghost" type="button" onClick={() => void consult()}>Actualizar</button>
              <button className="ghost" type="button" onClick={() => void changeAccount()}>Cerrar sesión</button>
            </div>
          </div>
          <div className="filters my-tickets-filters" aria-label="Filtrar por estado">
            {statuses.map((status) => (
              <button key={status} type="button" className={filter === status ? "selected" : ""}
                aria-pressed={filter === status} onClick={() => setFilter(status)}>{status}</button>
            ))}
          </div>
          {!shown.length && <p className="my-tickets-empty">{tickets.length
            ? "No tienes tickets con este estado."
            : "Aún no tienes tickets registrados con tu cuenta de Microsoft."}</p>}
          {shown.map((ticket) => (
            <article className="my-ticket" key={ticket.spId}>
              <div className="my-ticket-heading">
                <div><h3>{ticket.id}</h3><p>{[ticket.request_type, ticket.study, ticket.country].filter(Boolean).join(" · ")}</p></div>
                <span className={`status ${ticket.status.replace(" ", "-").toLowerCase()}`}>{ticket.status}</span>
              </div>
              <dl className="my-ticket-facts">
                <div><dt>Prioridad automática</dt><dd>{priorityFor(ticket.request_type) || "Sin regla"}</dd></div>
                <div><dt>Fecha compromiso</dt><dd>{commitmentDay(ticket.due_date).split("-").reverse().join("/") || "Por definir"}</dd></div>
                <div><dt>Cumplimiento</dt><dd>{deadlineState(ticket)}</dd></div>
                <div><dt>Analista asignado</dt><dd>{ticket.assignee || "Sin asignar"}</dd></div>
                <div><dt>Fecha de creación</dt><dd>{dateLabel(ticket.created_at)}</dd></div>
                <div><dt>{ticket.status === "Finalizado" && ticket.completed_at ? "Fecha de solución" : "Última actualización"}</dt>
                  <dd>{dateLabel(ticket.status === "Finalizado" && ticket.completed_at ? ticket.completed_at : ticket.updated_at)}</dd></div>
              </dl>
              <details className="my-ticket-detail"><summary>Ver mi solicitud</summary><p>{ticketText(ticket.detail)}</p></details>
              {ticket.status === "Finalizado" && <div className="my-ticket-solution">
                <h4>Solución del equipo</h4>
                <p>{ticket.resolution?.trim() ? ticketText(ticket.resolution) : "Este ticket fue finalizado sin una solución registrada."}</p>
                {ticket.resolution_files?.length ? <small>Archivos de la solución: {ticket.resolution_files.join(" · ")}</small> : null}
              </div>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
