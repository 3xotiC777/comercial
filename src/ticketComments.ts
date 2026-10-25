export type CommentOrigin = "Solicitante" | "Analista";
export type TicketComment = {
  id: string;
  requestId: string;
  ticketId: string;
  text: string;
  origin: CommentOrigin;
  author: string;
  authorEmail: string;
  createdAt: string;
  notification: string;
};

export const maxCommentLength = 5000;
export function validateComment(text: string) {
  const clean = text.trim();
  if (!clean) throw new Error("Escribe un comentario antes de enviarlo.");
  if (clean.length > maxCommentLength)
    throw new Error(`El comentario debe tener máximo ${maxCommentLength} caracteres.`);
  return clean;
}

export function notificationLabel(status: string) {
  if (status === "Enviado") return "Aviso enviado por correo";
  if (status === "Error" || status === "Revisar") return "Comentario guardado · aviso pendiente de revisión";
  if (status === "Rechazado") return "No se envió el aviso: revisa el acceso al ticket";
  return "Comentario guardado · aviso en preparación";
}
