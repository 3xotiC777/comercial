import type { ExportTicket } from "./sharepoint";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function csvDate(value?: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = Object.fromEntries(dateFormat.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function csvCell(value: unknown): string {
  let text = String(value ?? "").split("\0").join("");
  // Quoting alone does not stop Excel from interpreting imported formulas.
  if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function htmlToCsvText(html: string): string {
  if (!/<\/?[a-z][\s\S]*>/i.test(html)) return html;
  // Inert template: no scripts, external images or other resources are loaded.
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script,style,template,iframe,object").forEach((node) => node.remove());
  template.content.querySelectorAll("img").forEach((node) => {
    const src = node.getAttribute("src") || "";
    const name = src.startsWith("inline://") ? src.slice(9) : node.getAttribute("alt") || "imagen";
    node.replaceWith(document.createTextNode(`[Imagen: ${name}]`));
  });
  template.content.querySelectorAll("br").forEach((node) => node.replaceWith(document.createTextNode("\n")));
  template.content.querySelectorAll("p,div,li,tr,h1,h2,h3,h4,blockquote").forEach((node) => node.append("\n"));
  template.content.querySelectorAll("td,th").forEach((node) => node.append("\t"));
  return (template.content.textContent || "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function closureHours(ticket: Pick<ExportTicket, "created_at" | "completed_at" | "status">): string {
  if (ticket.status !== "Finalizado" || !ticket.completed_at) return "";
  const elapsed = new Date(ticket.completed_at).getTime() - new Date(ticket.created_at).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 ? (elapsed / 3_600_000).toFixed(2).replace(".", ",") : "";
}

export const csvHeaders = [
  "Ticket", "ID SharePoint", "Fecha creación (Bogotá UTC-05)", "Fecha inicio (Bogotá UTC-05)",
  "Fecha finalización (Bogotá UTC-05)", "Última actualización (Bogotá UTC-05)",
  "Estado", "Responsable", "Solicitante", "Correo solicitante", "Correos en copia (CC)",
  "Negocio", "País", "Estudio", "Tipo de solicitud", "Detalle de la solicitud", "Respuesta final",
  "Tiempo hasta finalizar (horas calendario)", "Archivos de la solicitud", "Archivos de la solución",
  "Imágenes de la solicitud", "Imágenes de la solución", "Enlace al ticket", "Carpeta de archivos",
];

export function buildTicketsCsv(tickets: ExportTicket[], toText = htmlToCsvText): string {
  const site = "https://dichterneiracorp.sharepoint.com/sites/reportingdn";
  const rows = tickets.map((ticket) => [
    ticket.id, ticket.spId, csvDate(ticket.created_at), csvDate(ticket.started_at),
    csvDate(ticket.completed_at), csvDate(ticket.updated_at), ticket.status,
    ticket.assignee || ticket.assignee_original || "Sin asignar", ticket.requester_name,
    ticket.requester_email, ticket.cc_emails, ticket.business, ticket.country, ticket.study,
    ticket.request_type, toText(ticket.detail), toText(ticket.resolution || ""), closureHours(ticket),
    ticket.request_files.join("; "), ticket.solution_files.join("; "),
    ticket.request_images.join("; "), ticket.solution_images.join("; "),
    `${site}/Lists/Comercial%20planeacion/DispForm.aspx?ID=${encodeURIComponent(ticket.spId)}`,
    `${site}/Comercial%20planeacion%20proyecto/Forms/AllItems.aspx?id=${encodeURIComponent(`/sites/reportingdn/Comercial planeacion proyecto/${ticket.id}`)}`,
  ]);
  // UTF-8 BOM + Excel separator directive keep accents and columns on Spanish Windows.
  return "\uFEFFsep=;\r\n" + [csvHeaders, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export function downloadTicketsCsv(tickets: ExportTicket[]): string {
  const filename = `tickets-comercial-completo-${csvDate(new Date().toISOString()).replace(/[: ]/g, "-")}.csv`;
  const url = URL.createObjectURL(new Blob([buildTicketsCsv(tickets)], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return filename;
}
