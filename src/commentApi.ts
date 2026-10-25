import { getContext, graph, token } from "./sharepoint";
import type { Ticket } from "./sharepoint";
import { isTeamMember } from "./team";
import { validateComment } from "./ticketComments";
import type { CommentOrigin, TicketComment } from "./ticketComments";

type CommentItem = {
  id: string; createdDateTime?: string;
  createdBy?: { user?: { displayName?: string; email?: string } };
  fields: Record<string, unknown>;
};
const listName = "Comentarios Comercial";
const escapeFilter = (value: string) => value.replace(/'/g, "''");
const graphRoot = "https://graph.microsoft.com/v1.0";

async function session(ticket: Ticket, origin: CommentOrigin) {
  if (origin !== "Solicitante" && origin !== "Analista") throw new Error("El origen del comentario no es válido.");
  if (!/^\d+$/.test(ticket.spId)) throw new Error("El ticket no tiene un identificador válido.");
  const accessToken = await token(true);
  if (!accessToken) throw new Error("Inicia sesión con Microsoft para comentar.");
  const c = await getContext(accessToken);
  const profile = await graph("/me?$select=displayName,mail,userPrincipalName", accessToken);
  const email = String(profile.mail || profile.userPrincipalName || "").trim().toLowerCase();
  // Recheck the persisted ticket and current signed-in identity on every operation.
  const current = await graph(`/sites/${c.siteId}/lists/${c.listId}/items/${ticket.spId}?$expand=fields`, accessToken);
  const requester = String(current.fields.correo || "").trim().toLowerCase();
  if (!email || (origin === "Analista" ? !isTeamMember(email) : email !== requester))
    throw new Error("Tu cuenta no puede participar en este ticket desde esta sección.");
  const lists = await graph(`/sites/${c.siteId}/lists?$select=id,displayName`, accessToken);
  const list = lists.value.find((item: { displayName: string }) => item.displayName === listName);
  if (!list) throw new Error("Los comentarios todavía no están disponibles. Inténtalo más tarde.");
  return { accessToken, path: `/sites/${c.siteId}/lists/${list.id}/items`, email, name: String(profile.displayName || email) };
}

function mapComment(item: CommentItem): TicketComment {
  return {
    id: item.id, requestId: String(item.fields.Title || ""), ticketId: String(item.fields.TicketId || ""),
    text: String(item.fields.Comment || ""), origin: item.fields.Origin === "Analista" ? "Analista" : "Solicitante",
    author: item.createdBy?.user?.displayName || "Participante", authorEmail: item.createdBy?.user?.email || "",
    createdAt: item.createdDateTime || String(item.fields.Created || ""),
    notification: String(item.fields.Notification || "Pendiente"),
  };
}

export async function loadTicketComments(ticket: Ticket, origin: CommentOrigin): Promise<TicketComment[]> {
  const s = await session(ticket, origin);
  let path = `${s.path}?$expand=fields&$top=200&$filter=${encodeURIComponent(`fields/TicketId eq '${ticket.spId}'`)}`;
  const comments: TicketComment[] = [];
  while (path) {
    const page = await graph(path, s.accessToken);
    comments.push(...(page.value as CommentItem[]).map(mapComment).filter((comment) => comment.ticketId === ticket.spId));
    const next = page["@odata.nextLink"] as string | undefined;
    if (next && !next.startsWith(`${graphRoot}/`)) throw new Error("La página de comentarios no es válida.");
    path = next ? next.slice(graphRoot.length) : "";
  }
  return comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || Number(a.id) - Number(b.id));
}

export async function addTicketComment(ticket: Ticket, origin: CommentOrigin, text: string, requestId: string): Promise<TicketComment> {
  const clean = validateComment(text);
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("El identificador del comentario no es válido.");
  const s = await session(ticket, origin);
  const findExisting = async () => {
    const page = await graph(`${s.path}?$expand=fields&$filter=${encodeURIComponent(`fields/Title eq '${escapeFilter(requestId)}'`)}`, s.accessToken);
    const item = page.value.find((value: CommentItem) => String(value.fields.TicketId) === ticket.spId);
    if (item && (String(item.fields.Comment) !== clean || item.fields.Origin !== origin))
      throw new Error("Este envío ya se guardó con otro contenido. Actualiza la conversación.");
    return item ? mapComment(item) : null;
  };
  const existing = await findExisting();
  if (existing) return existing;
  try {
    const created = await graph(s.path, s.accessToken, {
      method: "POST",
      body: JSON.stringify({ fields: { Title: requestId, TicketId: ticket.spId, Comment: clean, Origin: origin } }),
    });
    const result = mapComment({ ...created, fields: { Title: requestId, TicketId: ticket.spId, Comment: clean, Origin: origin, ...created.fields } });
    return { ...result, author: s.name, authorEmail: s.email };
  } catch (error) {
    // The server may have committed despite a lost response. Retry the same UUID,
    // never create a new record (Title also has a unique constraint in SharePoint).
    const saved = await findExisting().catch(() => null);
    if (saved) return saved;
    throw error;
  }
}
