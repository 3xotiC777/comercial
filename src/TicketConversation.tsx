import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { addTicketComment, loadTicketComments } from "./commentApi";
import type { Ticket } from "./sharepoint";
import { maxCommentLength, notificationLabel } from "./ticketComments";
import type { CommentOrigin, TicketComment } from "./ticketComments";
import "./TicketConversation.css";

const dateLabel = (value: string) => Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(value))
  : "Fecha no disponible";

export default function TicketConversation({ ticket, origin, onClose }: {
  ticket: Ticket; origin: CommentOrigin; onClose: () => void;
}) {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const submitLock = useRef(false);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void loadTicketComments(ticket, origin).then((result) => {
      if (active) setComments(result);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar la conversación.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ticket, origin, refresh]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true; setSending(true); setError(""); setSuccess("");
    try {
      const comment = await addTicketComment(ticket, origin, text, requestId.current);
      setComments((current) => [...current.filter((item) => item.requestId !== comment.requestId), comment]);
      setText(""); setUncertain(false); requestId.current = crypto.randomUUID();
      setSuccess("Comentario guardado. El aviso por correo se está preparando.");
    } catch (cause) {
      setUncertain(true);
      setError(`${cause instanceof Error ? cause.message : "No se pudo confirmar el comentario."} Puedes reintentar el mismo envío sin duplicarlo.`);
    } finally { submitLock.current = false; setSending(false); }
  };

  return <div className="modal-backdrop conversation-backdrop" onMouseDown={(event) => {
    if (event.currentTarget === event.target && !sending && !text.trim()) onClose();
  }}>
    <section className="conversation-dialog" role="dialog" aria-modal="true" aria-labelledby="conversation-title" ref={dialog} tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !sending && !text.trim()) close.current();
        if (event.key !== "Tab") return;
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),a[href]') || []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <header className="conversation-header">
        <div><span className="eyebrow">CONVERSACIÓN · {ticket.id}</span><h2 id="conversation-title">Comentarios del ticket</h2><p>Un espacio para aclarar dudas y compartir información.</p></div>
        <button className="conversation-close" type="button" aria-label="Cerrar comentarios" disabled={sending} onClick={() => {
          if (!text.trim() || window.confirm("Tienes un comentario sin enviar. ¿Quieres descartarlo y cerrar?")) onClose();
        }}>×</button>
      </header>
      <div className="conversation-context"><span className={`status ${ticket.status.replace(" ", "-").toLowerCase()}`}>{ticket.status}</span><span>{ticket.requester_name} · {ticket.study}</span></div>
      <div className="conversation-toolbar"><span>{comments.length} comentario{comments.length === 1 ? "" : "s"} · hora de Bogotá</span><button type="button" className="ghost" disabled={loading || sending} onClick={() => setRefresh((value) => value + 1)}>Actualizar conversación</button></div>
      <div className="conversation-history" aria-busy={loading}>
        {loading && <p role="status">Cargando conversación…</p>}
        {!loading && !comments.length && !error && <div className="conversation-empty"><span aria-hidden="true">↔</span><h3>La conversación empieza aquí</h3><p>{origin === "Analista" ? "Pide la información que necesitas para continuar con la solicitud." : "Comparte detalles o responde las preguntas del equipo de Planeación."}</p></div>}
        <ol>{comments.map((comment) => <li key={comment.id} className={comment.origin === "Analista" ? "comment-analyst" : "comment-requester"}>
          <div className="comment-author"><span className="comment-avatar" aria-hidden="true">{comment.author.charAt(0).toUpperCase()}</span><div><strong>{comment.author}</strong><small>{comment.origin === "Analista" ? "Equipo de Planeación" : "Solicitante"}</small></div><time dateTime={comment.createdAt}>{dateLabel(comment.createdAt)}</time></div>
          <p className="comment-text">{comment.text}</p><small className="comment-delivery">{notificationLabel(comment.notification)}</small>
        </li>)}</ol>
      </div>
      <form className="conversation-compose" onSubmit={submit}>
        <label htmlFor="ticket-comment">{origin === "Analista" ? "Pedir información o agregar comentario" : "Agregar comentario"}</label>
        <textarea id="ticket-comment" rows={4} value={text} maxLength={maxCommentLength} disabled={sending || uncertain} onChange={(event) => { setText(event.target.value); setSuccess(""); }} placeholder={origin === "Analista" ? "Hola, para continuar necesitamos que nos confirmes…" : "Escribe aquí la información que quieres compartir…"} aria-describedby="comment-recipient-note" />
        <div className="conversation-compose-meta"><p id="comment-recipient-note">{origin === "Analista" ? "Avisaremos al solicitante" : "Avisaremos al equipo de Planeación"} desde reporting.dichterneira@gmail.com, con las copias del ticket. Comentar no cambia el estado.</p><span>{text.length}/{maxCommentLength}</span></div>
        {error && <p className="conversation-error" role="alert">{error}</p>}
        {success && <p className="conversation-success" role="status">{success}</p>}
        {ticket.status === "Finalizado" && <p className="conversation-closed">Este ticket está finalizado. El comentario quedará registrado sin reabrirlo.</p>}
        <div className="conversation-actions"><button className="primary" type="submit" disabled={sending || loading || !text.trim()}>{sending ? "Guardando comentario…" : uncertain ? "Reintentar envío" : "Enviar comentario"}<span aria-hidden="true"> →</span></button></div>
      </form>
    </section>
  </div>;
}
