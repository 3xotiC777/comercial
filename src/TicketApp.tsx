import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, ReactNode } from "react";
import {
  createTicket,
  downloadTicketAttachment,
  finalizeTicket,
  loadRequestInlineImages,
  loadTickets,
  normalizeAnalyst,
  signIn,
  signOut,
  updateTicket,
} from "./sharepoint";
import type { Analyst, Status, Ticket } from "./sharepoint";
import "./App.css";
import "./Resolution.css";

const analysts = ["Diego Montoya", "Miguel Cabezas", "Rony Rodriguez"] as const;
const adminEmails = [
  "dmontoya@dichter-neira.com",
  "fvillalba@dichter-neira.com",
  "mcabezas@dichter-neira.com",
  "rrodriguez@dichter-neira.com",
];
const catalog: Record<string, string[]> = {
  BOLIVIA: ["P&G"],
  CHILE: ["COCA COLA (KO TRD)"],
  COLOMBIA: [
    "NESTLE (DSD)",
    "NESTLE (ISD)",
    "NESTLE (UTT)",
    "SAMSUNG",
    "COCA COLA (KO MD)-PLANOGRAMA",
    "COCA COLA (KO MD)",
  ],
  "COSTA RICA": [
    "CARGILL",
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "FIFCO MOD",
    "FIFCO TRD",
    "NESTLE",
    "P&G",
  ],
  ECUADOR: ["CBC - EC", "COCA COLA (KO TRD)", "P&G", "CBC EC", "P&G_SC"],
  "EL SALVADOR": [
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "NESTLE",
    "P&G",
    "CERVECERIA",
    "ABI CRECE",
  ],
  GUATEMALA: [
    "CBC - GM",
    "COCA COLA (KO MD)- ABVO",
    "COCA COLA (KO MD)- EMBO",
    "COCA COLA (KO TRD)- ABVO",
    "COCA COLA (KO TRD)- EMBO",
    "NESTLE",
    "P&G",
    "CBC GT",
  ],
  HONDURAS: [
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "NESTLE",
    "P&G",
    "CERVECERIA",
    "ABI CRECE",
    "CBC - HN",
  ],
  NICARAGUA: ["COCA COLA (KO MD)", "COCA COLA (KO TRD)", "NESTLE", "P&G"],
  PANAMA: [
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "HEINEKEN",
    "NESTLE",
    "P&G",
    "REPRICO",
  ],
  PARAGUAY: ["P&G"],
  PERU: [
    "ABI",
    "ABI DAS",
    "GLORIA",
    "LINDLEY",
    "STOREVIEW ABI PERU",
    "STOREVIEW MD IRT ABI PERU",
    "CBC MYSTERY",
    "GLORIA SV TRADICIONAL",
    "GLORIA SC TRADICIONAL",
    "AJE",
    "Lindley - Auditor",
  ],
  "REPUBLICA DOMINICANA": [
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "CORRIPIO",
    "P&G",
    "INDUVECA",
    "PEPSI",
    "INDUSTRIA SAN MIGUEL",
  ],
  URUGUAY: ["P&G"],
  VENEZUELA: ["COCA COLA (KO TRD)"],
};
const Logo = () => (
  <img
    className="logo"
    src="https://dichter-neira.com/wp-content/uploads/2026/06/Logo-nuevo-blanco-e1782489132302.webp"
    alt="dichter & neira"
  />
);
const fmt = (date: string) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
const monthKey = (date: string) => date.slice(0, 7);
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(
    new Date(`${month}-01T12:00:00`),
  );
const completionHours = (ticket: Ticket) => {
  if (!ticket.completed_at) return null;
  const hours =
    (new Date(ticket.completed_at).getTime() -
      new Date(ticket.created_at).getTime()) /
    3600000;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
};
const durationLabel = (hours: number | null) =>
  hours === null
    ? "—"
    : hours < 24
      ? `${Math.max(1, Math.round(hours))} h`
      : `${(hours / 24).toFixed(1)} d`;
const appVersion = import.meta.env.VITE_APP_VERSION || "local";

export default function TicketApp() {
  const [view, setView] = useState<"new" | "admin">("new"),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [user, setUser] = useState<{ name: string; email: string } | null>(null),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false);
  const enter = async () => {
    setLoading(true);
    try {
      const person = await signIn();
      if (!adminEmails.includes(person.email.toLowerCase()))
        throw new Error("Tu cuenta no está autorizada para el panel interno.");
      setUser(person);
      setTickets(await loadTickets());
      setView("admin");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible iniciar sesión.",
      );
    } finally {
      setLoading(false);
    }
  };
  const update = async (ticket: Ticket, patch: Partial<Ticket>) => {
    try {
      setLoading(true);
      await updateTicket(ticket, patch);
      setTickets((current) =>
        current.map((x) => (x.spId === ticket.spId ? { ...x, ...patch } : x)),
      );
      setNotice(
        "Cambio guardado. Power Automate notificará a las personas involucradas.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el cambio.",
      );
    } finally {
      setLoading(false);
    }
  };
  const download = async (ticket: Ticket) => {
    try {
      await downloadTicketAttachment(ticket);
      setNotice(`Descarga de “${ticket.attachment_name}” iniciada.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo descargar el archivo.",
      );
    }
  };
  const complete = async (
    ticket: Ticket,
    resolution: string,
    files: File[],
    inlineFiles: File[],
  ) => {
    try {
      setLoading(true);
      const patch = await finalizeTicket(
        ticket,
        resolution,
        files,
        inlineFiles,
      );
      setTickets((current) =>
        current.map((x) => (x.spId === ticket.spId ? { ...x, ...patch } : x)),
      );
      setNotice(
        `Ticket ${ticket.id} finalizado. Power Automate procesará el correo para ${ticket.requester_email}.`,
      );
      return null;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo finalizar el ticket.";
      setNotice(message);
      return message;
    } finally {
      setLoading(false);
    }
  };
  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setView("new")}>
          <Logo />
          <span>Centro de solicitudes</span>
        </button>
        <nav>
          <button
            className={view === "new" ? "active" : ""}
            onClick={() => setView("new")}
          >
            Nueva solicitud
          </button>
          <button
            className={view === "admin" ? "active" : ""}
            onClick={() => setView("admin")}
          >
            Área interna ↗
          </button>
        </nav>
      </header>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {view === "new" ? (
        <Request
          onCreated={(ticket) => {
            setNotice(`Solicitud ${ticket.id} creada correctamente.`);
            setTickets([ticket, ...tickets]);
          }}
        />
      ) : user ? (
        <Dash
          tickets={tickets}
          update={update}
          download={download}
          complete={complete}
          signOut={async () => {
            await signOut();
            setUser(null);
            setTickets([]);
          }}
        />
      ) : (
        <Login loading={loading} onLogin={enter} />
      )}
      <div className="app-version" title="Versión publicada de la aplicación">
        Versión {appVersion}
      </div>
    </main>
  );
}

function Request({ onCreated }: { onCreated: (ticket: Ticket) => void }) {
  const [requestType, setRequestType] = useState(""),
    [business, setBusiness] = useState(""),
    [country, setCountry] = useState(""),
    [study, setStudy] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [sending, setSending] = useState(false),
    [uploadProgress, setUploadProgress] = useState<number | null>(null),
    [images, setImages] = useState<InlineImage[]>([]),
    [processing, setProcessing] = useState(0),
    [detailError, setDetailError] = useState("");
  const detailEditor = useRef<HTMLDivElement>(null);
  const detailInput = useRef<HTMLTextAreaElement>(null);
  const previewUrls = useRef<string[]>([]);
  const studies = useMemo(() => catalog[country] || [], [country]);
  const studyNotRequired =
    requestType === "Cotizaciones" || requestType === "Otros";
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const pasteDetail = async (event: ClipboardEvent<HTMLDivElement>) => {
    if (!detailEditor.current) return;
    event.preventDefault();
    const sources = Array.from(event.clipboardData.items)
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((item): item is File => Boolean(item)),
      range = editorRange(detailEditor.current),
      text = event.clipboardData.getData("text/plain");
    if (text) insertPlainText(range, text);
    if (!sources.length) return;
    const marker = document.createElement("span");
    marker.dataset.pasteMarker = "true";
    range.insertNode(marker);
    setProcessing((current) => current + sources.length);
    for (const source of sources) {
      try {
        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        const file = await prepareInlineImage(source, id);
        const preview = URL.createObjectURL(file);
        previewUrls.current.push(preview);
        setImages((current) => [
          ...current,
          { id, file, filename: file.name, preview },
        ]);
        const image = document.createElement("img");
        image.src = preview;
        image.alt = "Imagen pegada en la solicitud";
        image.dataset.inlineId = id;
        image.contentEditable = "false";
        marker.before(image, document.createElement("br"));
      } catch (reason) {
        setDetailError(
          reason instanceof Error
            ? reason.message
            : "No se pudo procesar una imagen pegada.",
        );
      } finally {
        setProcessing((current) => Math.max(0, current - 1));
      }
    }
    marker.remove();
    detailEditor.current.focus();
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const editor = detailEditor.current;
    if (!editor) return;
    if (processing) {
      setDetailError("Espera un momento mientras se preparan las imÃ¡genes.");
      return;
    }
    const usedIds = new Set(
      Array.from(
        editor.querySelectorAll<HTMLImageElement>("img[data-inline-id]"),
      ).map((image) => image.dataset.inlineId),
    );
    const usedImages = images.filter((image) => usedIds.has(image.id));
    if (!editor.innerText.trim() && !usedImages.length) {
      setDetailError("Escribe el detalle de la solicitud o pega una imagen.");
      return;
    }
    if (detailInput.current)
      detailInput.current.value = requestHtml(editor, usedImages);
    const form = event.currentTarget;
    setSending(true);
    setUploadProgress(file ? 0 : null);
    const data = new FormData(form);
    const ticket: Ticket = {
      id: `DN-${Date.now().toString().slice(-6)}`,
      spId: "",
      created_at: new Date().toISOString(),
      requester_name: String(data.get("name")),
      requester_email: String(data.get("email")),
      country,
      study: studyNotRequired ? "" : study,
      business,
      request_type: requestType,
      detail: requestHtml(editor, usedImages),
      status: "Pendiente",
      assignee: "",
      attachment_name: file?.name,
    };
    try {
      onCreated(
        await createTicket(
          ticket,
          file,
          usedImages.map((image) => image.file),
          setUploadProgress,
        ),
      );
      form.reset();
      setRequestType("");
      setBusiness("");
      setCountry("");
      setStudy("");
      setFile(null);
      setImages([]);
      if (detailEditor.current) detailEditor.current.innerHTML = "";
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = [];
      setDetailError("");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "No fue posible crear la solicitud.",
      );
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  };
  const buttonLabel = sending
    ? file && uploadProgress !== null
      ? `Subiendo archivo · ${uploadProgress}%`
      : "Guardando..."
    : "Enviar solicitud";
  return (
    <section className="request fade">
      <div className="hero">
        <div className="eyebrow">D&N · OPERACIONES</div>
        <h1>
          Hagamos que tu
          <br />
          <em>solicitud avance.</em>
        </h1>
        <p>
          Centraliza tus requerimientos, adjunta tus insumos y recibe
          seguimiento claro en cada etapa.
        </p>
        <div className="steps">
          <span>
            <b>01</b> Ticket único
          </span>
          <span>
            <b>02</b> Seguimiento
          </span>
          <span>
            <b>03</b> Respuesta
          </span>
        </div>
      </div>
      <form className="card" onSubmit={submit}>
        <div className="intro">
          <i>01</i>
          <div>
            <h2>Nueva solicitud</h2>
            <p>
              Ingresa con Microsoft al enviarla. Los campos con * son
              obligatorios.
            </p>
          </div>
        </div>
        <div className="fields">
          <label>
            Nombre completo*
            <input name="name" required placeholder="Tu nombre" />
          </label>
          <label>
            Correo corporativo*
            <input
              name="email"
              type="email"
              required
              placeholder="nombre@dichter-neira.com"
            />
          </label>
          <label>
            Negocio*
            <select
              value={business}
              onChange={(event) => setBusiness(event.target.value)}
              required
            >
              <option value="">Selecciona el negocio</option>
              <option value="Trade">Trade</option>
              <option value="Customer">Customer</option>
            </select>
          </label>
          <label>
            Tipo de solicitud*
            <select
              value={requestType}
              onChange={(event) => {
                const nextType = event.target.value;
                setRequestType(nextType);
                if (nextType === "Cotizaciones" || nextType === "Otros")
                  setStudy("");
              }}
              required
            >
              <option value="">Selecciona el tipo</option>
              {["Muestra", "Cotizaciones", "Analisis", "Otros"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            País*
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setStudy("");
              }}
              required
            >
              <option value="">Selecciona un país</option>
              {Object.keys(catalog).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            {studyNotRequired ? "Estudio" : "Estudio*"}
            <select
              value={study}
              onChange={(event) => setStudy(event.target.value)}
              disabled={!requestType || studyNotRequired || !country}
              required={!studyNotRequired}
            >
              <option value="">
                {studyNotRequired
                  ? "No aplica para este tipo de solicitud"
                  : !requestType
                    ? "Primero elige el tipo de solicitud"
                    : country
                      ? "Selecciona un estudio"
                      : "Primero elige un país"}
              </option>
              {studies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="file">
            Insumo o archivo
            <input
              type="file"
              disabled={sending}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <span>
              {file
                ? `${file.name} · ${sizeLabel(file.size)}`
                : "Subir archivo · Excel, PDF, imagen..."}
            </span>
          </label>
          <label className="wide">
            Detalle de la solicitud*
            <div
              ref={detailEditor}
              className="request-editor"
              contentEditable={!sending}
              role="textbox"
              aria-multiline="true"
              aria-label="Detalle de la solicitud"
              data-placeholder="Incluye el objetivo, alcance, período requerido y cualquier contexto que ayude al equipo. También puedes pegar imágenes."
              onPaste={pasteDetail}
              onInput={() => setDetailError("")}
            />
            <small className="request-editor-note">
              Puedes pegar imágenes directamente en el detalle. Quedarán disponibles para el equipo al abrir la solicitud.
            </small>
            <textarea
              ref={detailInput}
              className="detail-value"
              name="detail"
              required={false}
              placeholder="Incluye el objetivo, alcance, período requerido y cualquier contexto que ayude al equipo."
            />
          </label>
        </div>
        {processing > 0 && (
          <p className="processing-images">
            Preparando {processing} imagen(es)…
          </p>
        )}
        {detailError && (
          <p className="request-detail-error" role="alert">
            {detailError}
          </p>
        )}
        {sending && file && uploadProgress !== null && (
          <>
            <div
              className="request-upload-progress"
              role="progressbar"
              aria-label="Carga del archivo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
            >
              <span style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="request-upload-note">
              No cierres esta pestaña hasta que la carga llegue al 100%.
            </p>
          </>
        )}
        <button className="primary" disabled={sending}>
          {buttonLabel} <b>→</b>
        </button>
        <small>
          La solicitud se guardará en SharePoint y las notificaciones serán
          gestionadas por Power Automate.
        </small>
      </form>
    </section>
  );
}

function Login({
  loading,
  onLogin,
}: {
  loading: boolean;
  onLogin: () => void;
}) {
  return (
    <section className="login fade">
      <div className="login-card">
        <div className="eyebrow">D&N · EQUIPO INTERNO</div>
        <h1>
          Panel de <em>operaciones</em>
        </h1>
        <p>
          Accede con tu cuenta corporativa autorizada para gestionar las
          solicitudes comerciales.
        </p>
        <button className="primary" disabled={loading} onClick={onLogin}>
          {loading ? "Conectando..." : "Ingresar con Microsoft"} <b>→</b>
        </button>
        <div className="hint">
          Tu acceso está protegido por Microsoft y los permisos de SharePoint.
        </div>
      </div>
    </section>
  );
}

function Dash({
  tickets,
  update,
  download,
  complete,
  signOut,
}: {
  tickets: Ticket[];
  update: (ticket: Ticket, patch: Partial<Ticket>) => void;
  download: (ticket: Ticket) => Promise<void>;
  complete: (
    ticket: Ticket,
    resolution: string,
    files: File[],
    inlineFiles: File[],
  ) => Promise<string | null>;
  signOut: () => void;
}) {
  const [filter, setFilter] = useState<"Todos" | Status>("Todos");
  const [month, setMonth] = useState("Todos");
  const [closing, setClosing] = useState<Ticket | null>(null);
  const [viewingRequest, setViewingRequest] = useState<Ticket | null>(null);
  const months = useMemo(
    () =>
      [...new Set(tickets.map((ticket) => monthKey(ticket.created_at)))]
        .sort()
        .reverse(),
    [tickets],
  );
  const periodTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) => month === "Todos" || monthKey(ticket.created_at) === month,
      ),
    [month, tickets],
  );
  const shown = periodTickets.filter(
    (ticket) => filter === "Todos" || ticket.status === filter,
  );
  const completed = periodTickets.filter(
    (ticket) =>
      ticket.status === "Finalizado" && completionHours(ticket) !== null,
  );
  const done = completed.length;
  const doing = periodTickets.filter(
    (ticket) => ticket.status === "En proceso",
  ).length;
  const unassigned = periodTickets.filter(
    (ticket) => !normalizeAnalyst(ticket.assignee),
  ).length;
  const times = completed
    .map((ticket) => completionHours(ticket)!)
    .filter(Number.isFinite);
  const averageHours = times.length
    ? times.reduce((sum, hours) => sum + hours, 0) / times.length
    : null;
  const fastestHours = times.length ? Math.min(...times) : null;
  const completionRate = periodTickets.length
    ? Math.round((done / periodTickets.length) * 100)
    : 0;
  const analystStats = analysts.map((analyst) => {
    const assigned = periodTickets.filter(
      (ticket) => normalizeAnalyst(ticket.assignee) === analyst,
    );
    const finalised = assigned.filter(
      (ticket) =>
        ticket.status === "Finalizado" && completionHours(ticket) !== null,
    );
    const analystTimes = finalised.map((ticket) => completionHours(ticket)!);
    const lastClosed = finalised.sort((a, b) =>
      String(b.completed_at).localeCompare(String(a.completed_at)),
    )[0];
    return {
      analyst,
      active: assigned.filter((ticket) => ticket.status !== "Finalizado")
        .length,
      finalised: finalised.length,
      rate: assigned.length
        ? Math.round((finalised.length / assigned.length) * 100)
        : 0,
      average: analystTimes.length
        ? analystTimes.reduce((sum, hours) => sum + hours, 0) /
          analystTimes.length
        : null,
      lastClosed,
    };
  });
  const recentCompletions = [...completed]
    .sort((a, b) =>
      String(b.completed_at).localeCompare(String(a.completed_at)),
    )
    .slice(0, 5);
  const changeStatus = (ticket: Ticket, status: Status) => {
    if (status === "Finalizado" && ticket.status !== "Finalizado") {
      setClosing(ticket);
      return;
    }
    void update(ticket, { status });
  };
  return (
    <>
      <section className="dash fade">
        <div className="dash-head">
          <div>
            <div className="eyebrow">D&N · CONTROL DE OPERACIÓN</div>
            <h1>Visión general</h1>
            <p>Gestiona, asigna y da seguimiento a cada solicitud.</p>
          </div>
          <div className="dash-actions">
            <label className="period-filter">
              <span>Periodo</span>
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              >
                <option value="Todos">Histórico completo</option>
                {months.map((item) => (
                  <option key={item} value={item}>
                    {monthLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <button className="ghost" onClick={signOut}>
              Cerrar sesión
            </button>
          </div>
        </div>
        <div className="metrics management-metrics">
          <Metric
            label="Solicitudes totales"
            value={periodTickets.length}
            note={
              month === "Todos" ? "Histórico visible" : "Creadas en el periodo"
            }
          />
          <Metric
            label="En proceso"
            value={doing}
            note="Requieren seguimiento"
            color="yellow"
          />
          <Metric
            label="Finalizadas"
            value={done}
            note={`${completionRate}% de cierre`}
            color="green"
          />
          <Metric
            label="Tiempo promedio de cierre"
            value={durationLabel(averageHours)}
            note={
              times.length
                ? `${times.length} cierres medidos`
                : "Disponible al finalizar"
            }
            color="purple"
          />
          <Metric
            label="Sin asignar"
            value={unassigned}
            note="Requieren responsable"
            color="yellow"
          />
          <Metric
            label="Cierre más ágil"
            value={durationLabel(fastestHours)}
            note={
              fastestHours === null
                ? "Sin cierres en el periodo"
                : "Mejor tiempo registrado"
            }
            color="green"
          />
        </div>
        <div className="insights">
          <div className="analysts">
            <div className="eyebrow">Carga activa por analista</div>
            {analystStats.map((stat, index) => (
              <div className="analyst" key={stat.analyst}>
                <i className={`a a${index}`}>{stat.analyst[0]}</i>
                <b>{stat.analyst}</b>
                <div className="bar">
                  <span
                    style={{
                      width: `${periodTickets.length ? (stat.active / periodTickets.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <strong>{stat.active}</strong>
              </div>
            ))}
          </div>
          <div className="completion">
            <div className="eyebrow">Ritmo de resolución</div>
            <div className="ring">
              <b>
                {completionRate}%<small>finalizado</small>
              </b>
            </div>
            <p>
              {done} de {periodTickets.length} solicitudes completadas
            </p>
          </div>
        </div>
        <section
          className="performance-panel"
          aria-labelledby="performance-title"
        >
          <div className="performance-head">
            <div>
              <div className="eyebrow">Gestión de equipo</div>
              <h2 id="performance-title">Desempeño por analista</h2>
              <p>
                Los tiempos se calculan desde la creación hasta la finalización
                del ticket.
              </p>
            </div>
            <span>
              Periodo:{" "}
              {month === "Todos" ? "histórico completo" : monthLabel(month)}
            </span>
          </div>
          <div className="performance-table">
            <div className="performance-row performance-labels">
              <span>Analista</span>
              <span>Activos</span>
              <span>Finalizadas</span>
              <span>Tasa de cierre</span>
              <span>Tiempo promedio</span>
              <span>Último cierre</span>
            </div>
            {analystStats.map((stat, index) => (
              <div className="performance-row" key={stat.analyst}>
                <strong>
                  <i className={`a a${index}`}>{stat.analyst[0]}</i>
                  {stat.analyst}
                </strong>
                <span>{stat.active}</span>
                <span>{stat.finalised}</span>
                <span>
                  <b className="rate">{stat.rate}%</b>
                </span>
                <span>{durationLabel(stat.average)}</span>
                <span>
                  {stat.lastClosed?.completed_at
                    ? fmt(stat.lastClosed.completed_at)
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="recent-panel" aria-labelledby="recent-title">
          <div>
            <div className="eyebrow">Trazabilidad</div>
            <h2 id="recent-title">Cierres recientes</h2>
          </div>
          <div className="recent-list">
            {recentCompletions.length ? (
              recentCompletions.map((ticket) => (
                <div className="recent-close" key={ticket.spId}>
                  <b>{ticket.id}</b>
                  <span>
                    {normalizeAnalyst(ticket.assignee) || "Sin responsable"}
                  </span>
                  <strong>{durationLabel(completionHours(ticket))}</strong>
                  <small>
                    {ticket.completed_at ? fmt(ticket.completed_at) : ""}
                  </small>
                </div>
              ))
            ) : (
              <p>No hay cierres registrados para este periodo.</p>
            )}
          </div>
        </section>
        <div className="panel">
          <div className="table-head">
            <div>
              <h2>Solicitudes</h2>
              <p>
                Actualiza el estado, asigna un responsable o descarga el insumo
                original.
              </p>
            </div>
            <div className="filters">
              {(
                ["Todos", "Pendiente", "En proceso", "Finalizado"] as const
              ).map((item) => (
                <button
                  key={item}
                  className={filter === item ? "selected" : ""}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {shown.map((ticket) => (
            <article className="ticket" key={ticket.spId}>
              <div className="id">
                <b>{ticket.id}</b>
                <span>{fmt(ticket.created_at)}</span>
              </div>
              <div className="info">
                <div>
                  <i>{ticket.request_type}</i>
                  {ticket.business && <i>{ticket.business}</i>}
                  <b>
                    {[ticket.study, ticket.country].filter(Boolean).join(" · ")}
                  </b>
                </div>
                <button
                  className="view-request"
                  type="button"
                  onClick={() => setViewingRequest(ticket)}
                >
                  Ver solicitud <span>↗</span>
                </button>
                {ticket.resolution && (
                  <details className="resolution-summary">
                    <summary>Ver solución enviada</summary>
                    <p>{solutionText(ticket.resolution)}</p>
                    {inlineImageCount(ticket.resolution) > 0 ? (
                      <small>
                        🖼 {inlineImageCount(ticket.resolution)} imagen(es)
                        dentro de la respuesta
                      </small>
                    ) : null}
                    {ticket.resolution_files?.length ? (
                      <small>📎 {ticket.resolution_files.join(" · ")}</small>
                    ) : null}
                  </details>
                )}
                <small>
                  {ticket.requester_name} · {ticket.requester_email}
                </small>
                {ticket.completed_at && (
                  <small className="ticket-duration">
                    Cerrado en {durationLabel(completionHours(ticket))}
                    {ticket.assignee
                      ? ` · ${normalizeAnalyst(ticket.assignee)}`
                      : ""}
                  </small>
                )}
                {ticket.attachment_name && (
                  <AttachmentDownload ticket={ticket} download={download} />
                )}
              </div>
              <label className="select">
                <small>Estado</small>
                <select
                  value={ticket.status}
                  onChange={(event) =>
                    changeStatus(ticket, event.target.value as Status)
                  }
                >
                  <option>Pendiente</option>
                  <option>En proceso</option>
                  <option>Finalizado</option>
                </select>
              </label>
              <label className="select">
                <small>Responsable</small>
                <select
                  value={ticket.assignee}
                  onChange={(event) =>
                    update(ticket, { assignee: event.target.value as Analyst })
                  }
                >
                  <option value="">Sin asignar</option>
                  {analysts.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <div
                className={`status ${ticket.status.replace(" ", "-").toLowerCase()}`}
              >
                {ticket.status}
              </div>
            </article>
          ))}
        </div>
      </section>
      {closing && (
        <ResolutionModal
          ticket={closing}
          onClose={() => setClosing(null)}
          onComplete={async (resolution, files, inlineFiles) => {
            const problem = await complete(
              closing,
              resolution,
              files,
              inlineFiles,
            );
            if (!problem) setClosing(null);
            return problem;
          }}
        />
      )}
      {viewingRequest && (
        <RequestDetailModal
          ticket={viewingRequest}
          onClose={() => setViewingRequest(null)}
          download={download}
        />
      )}
    </>
  );
}

function RequestDetailModal({
  ticket,
  onClose,
  download,
}: {
  ticket: Ticket;
  onClose: () => void;
  download: (ticket: Ticket) => Promise<void>;
}) {
  const [images, setImages] = useState<Map<string, string>>(new Map());
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageError, setImageError] = useState("");
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    const load = async () => {
      if (!inlineImageCount(ticket.detail)) return;
      setLoadingImages(true);
      try {
        const loaded = await loadRequestInlineImages(ticket);
        if (!active) {
          loaded.forEach((url) => URL.revokeObjectURL(url));
          return;
        }
        loaded.forEach((url) => urls.push(url));
        setImages(loaded);
      } catch {
        if (active)
          setImageError("No se pudieron cargar algunas imágenes de la solicitud.");
      } finally {
        if (active) setLoadingImages(false);
      }
    };
    void load();
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [ticket]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="resolution-modal request-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-detail-title"
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
        >
          ×
        </button>
        <div className="modal-kicker">Solicitud {ticket.id}</div>
        <h2 id="request-detail-title">Detalle completo</h2>
        <div className="request-detail-meta">
          <span>{ticket.request_type}</span>
          {ticket.business && <span>{ticket.business}</span>}
          <span>{[ticket.study, ticket.country].filter(Boolean).join(" · ")}</span>
        </div>
        <p className="modal-copy">
          Enviada por <b>{ticket.requester_name}</b> · {ticket.requester_email}
          <br />
          {fmt(ticket.created_at)}
        </p>
        <div className="request-detail-content">
          <RichTicketDetail detail={ticket.detail} images={images} />
        </div>
        {loadingImages && <p className="processing-images">Cargando imágenes…</p>}
        {imageError && <p className="request-detail-error">{imageError}</p>}
        {ticket.attachment_name && (
          <div className="request-detail-download">
            <b>Insumo adjunto</b>
            <AttachmentDownload ticket={ticket} download={download} />
          </div>
        )}
      </section>
    </div>
  );
}

function RichTicketDetail({
  detail,
  images,
}: {
  detail: string;
  images: Map<string, string>;
}) {
  const documentValue = useMemo(
    () => new DOMParser().parseFromString(detail, "text/html"),
    [detail],
  );
  let key = 0;
  const renderNode = (node: Node): ReactNode => {
    const nodeKey = key++;
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (!(node instanceof HTMLElement)) return null;
    if (node.tagName === "BR") return <br key={nodeKey} />;
    if (node.tagName === "IMG") {
      const source = node.getAttribute("src") || "";
      const match = source.match(/^inline:\/\/(.+)$/i);
      const name = match ? decodeURIComponent(match[1]) : "";
      const url = name ? images.get(name) : "";
      return url ? (
        <img key={nodeKey} src={url} alt="Imagen incluida en la solicitud" />
      ) : (
        <span key={nodeKey} className="missing-inline-image">
          Imagen incluida en la solicitud
        </span>
      );
    }
    const content = Array.from(node.childNodes).map(renderNode);
    return node.tagName === "DIV" || node.tagName === "P" ? (
      <div key={nodeKey}>{content}</div>
    ) : (
      <>{content}</>
    );
  };
  return <>{Array.from(documentValue.body.childNodes).map(renderNode)}</>;
}

function AttachmentDownload({
  ticket,
  download,
}: {
  ticket: Ticket;
  download: (ticket: Ticket) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    extension =
      ticket.attachment_name?.split(".").pop()?.toUpperCase().slice(0, 4) ||
      "FILE";
  return (
    <button
      className="request-attachment"
      type="button"
      disabled={busy}
      title={`Descargar ${ticket.attachment_name}`}
      onClick={async () => {
        setBusy(true);
        await download(ticket);
        setBusy(false);
      }}
    >
      <span>{extension}</span>
      <b>{busy ? "Descargando…" : ticket.attachment_name}</b>
      <i>↓</i>
    </button>
  );
}

const maxEmailBytes = 20 * 1024 * 1024;
const maxInlineBytes = 220 * 1024;
const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
type InlineImage = {
  id: string;
  file: File;
  filename: string;
  preview: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const solutionText = (html: string) => {
  const readable = html
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(div|p)>/gi, "\n"),
    documentValue = new DOMParser().parseFromString(readable, "text/html");
  return (
    documentValue.body.textContent?.replace(/\n{3,}/g, "\n\n").trim() || ""
  );
};
const inlineImageCount = (html: string) =>
  (html.match(/src="inline:\/\//g) || []).length;

async function prepareInlineImage(source: File, id: string) {
  const supported: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
  };
  if (source.size <= maxInlineBytes && supported[source.type])
    return new File([source], `inline-${id}.${supported[source.type]}`, {
      type: source.type,
      lastModified: Date.now(),
    });
  const bitmap = await createImageBitmap(source);
  let scale = Math.min(1, 1000 / bitmap.width),
    quality = 0.86,
    blob: Blob | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("No se pudo procesar la imagen pegada.");
    }
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= maxInlineBytes) break;
    if (quality > 0.58) quality -= 0.08;
    else {
      scale *= 0.78;
      quality = 0.8;
    }
  }
  bitmap.close();
  if (!blob || blob.size > maxInlineBytes)
    throw new Error(
      "La imagen pegada es demasiado grande para incrustarla en el correo.",
    );
  return new File([blob], `inline-${id}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function editorRange(editor: HTMLElement) {
  const selection = window.getSelection(),
    range = document.createRange();
  if (selection?.rangeCount && editor.contains(selection.anchorNode)) {
    return selection.getRangeAt(0).cloneRange();
  }
  range.selectNodeContents(editor);
  range.collapse(false);
  return range;
}
function selectRange(range: Range) {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
function insertPlainText(range: Range, text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  lines.forEach((line, index) => {
    if (index) {
      const br = document.createElement("br");
      range.insertNode(br);
      range.setStartAfter(br);
    }
    if (line) {
      const node = document.createTextNode(line);
      range.insertNode(node);
      range.setStartAfter(node);
    }
  });
  range.collapse(true);
  selectRange(range);
}

function solutionHtml(editor: HTMLElement, images: InlineImage[]) {
  const byId = new Map(images.map((image) => [image.id, image]));
  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE)
      return escapeHtml(node.textContent || "");
    if (!(node instanceof HTMLElement)) return "";
    if (node.tagName === "IMG") {
      const image = byId.get(node.dataset.inlineId || "");
      return image
        ? `<img src="inline://${image.filename}" alt="Imagen incluida en la solución" style="display:block;max-width:100%;height:auto;margin:14px 0;border-radius:4px;">`
        : "";
    }
    if (node.tagName === "BR") return "<br>";
    const content = Array.from(node.childNodes).map(serialize).join("");
    return node.tagName === "DIV" || node.tagName === "P"
      ? `<div style="margin:0 0 12px;">${content || "<br>"}</div>`
      : content;
  };
  const content = Array.from(editor.childNodes).map(serialize).join("");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#172b3a;">${content}</div>`;
}

function requestHtml(editor: HTMLElement, images: InlineImage[]) {
  return solutionHtml(editor, images).replace(
    /Imagen incluida en la solución/g,
    "Imagen incluida en la solicitud",
  );
}

function ResolutionModal({
  ticket,
  onClose,
  onComplete,
}: {
  ticket: Ticket;
  onClose: () => void;
  onComplete: (
    resolution: string,
    files: File[],
    inlineFiles: File[],
  ) => Promise<string | null>;
}) {
  const editor = useRef<HTMLDivElement>(null),
    previewUrls = useRef<string[]>([]),
    [files, setFiles] = useState<File[]>([]),
    [images, setImages] = useState<InlineImage[]>([]),
    [error, setError] = useState(""),
    [sending, setSending] = useState(false),
    [processing, setProcessing] = useState(0);
  useEffect(() => {
    editor.current?.focus();
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending && !processing) onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose, sending, processing]);
  const addFiles = (incoming: File[]) => {
    const unique = incoming.filter(
        (file) =>
          !files.some(
            (current) =>
              current.name === file.name &&
              current.size === file.size &&
              current.lastModified === file.lastModified,
          ),
      ),
      next = [...files, ...unique],
      total = next.reduce((sum, file) => sum + file.size, 0);
    if (total > maxEmailBytes) {
      setError(
        "Los archivos superan 20 MB en total, que es el límite recomendado para enviarlos por correo.",
      );
      return;
    }
    setFiles(next);
    setError("");
  };
  const pasteContent = async (event: ClipboardEvent<HTMLDivElement>) => {
    if (!editor.current) return;
    event.preventDefault();
    const sources = Array.from(event.clipboardData.items)
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file)),
      range = editorRange(editor.current),
      text = event.clipboardData.getData("text/plain");
    if (text) insertPlainText(range, text);
    if (!sources.length) return;
    const marker = document.createElement("span");
    marker.dataset.pasteMarker = "true";
    range.insertNode(marker);
    setProcessing((current) => current + sources.length);
    for (const source of sources) {
      try {
        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12),
          file = await prepareInlineImage(source, id),
          preview = URL.createObjectURL(file),
          image: InlineImage = { id, file, filename: file.name, preview };
        previewUrls.current.push(preview);
        setImages((current) => [...current, image]);
        const element = document.createElement("img");
        element.src = preview;
        element.alt = "Imagen pegada en la solución";
        element.dataset.inlineId = id;
        element.contentEditable = "false";
        marker.before(element, document.createElement("br"));
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudo procesar una imagen pegada.",
        );
      } finally {
        setProcessing((current) => Math.max(0, current - 1));
      }
    }
    marker.remove();
    editor.current.focus();
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = editor.current;
    if (!target) return;
    if (processing) {
      setError(
        "Espera un momento mientras terminamos de preparar las imágenes.",
      );
      return;
    }
    if (!target.innerText.trim()) {
      setError("Escribe la solución antes de finalizar el ticket.");
      return;
    }
    const usedIds = new Set(
        Array.from(
          target.querySelectorAll<HTMLImageElement>("img[data-inline-id]"),
        ).map((image) => image.dataset.inlineId),
      ),
      usedImages = images.filter((image) => usedIds.has(image.id)),
      totalBytes = [...files, ...usedImages.map((image) => image.file)].reduce(
        (sum, file) => sum + file.size,
        0,
      );
    if (totalBytes > maxEmailBytes) {
      setError(
        "La respuesta completa supera 20 MB. Quita algunos archivos o imágenes.",
      );
      return;
    }
    const html = solutionHtml(target, usedImages);
    setSending(true);
    setError("");
    const problem = await onComplete(
      html,
      files,
      usedImages.map((image) => image.file),
    );
    if (problem) setError(problem);
    setSending(false);
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending && !processing)
          onClose();
      }}
    >
      <div
        className="resolution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolution-title"
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Cerrar"
          disabled={sending || Boolean(processing)}
          onClick={onClose}
        >
          ×
        </button>
        <div className="modal-kicker">Cerrar {ticket.id}</div>
        <h2 id="resolution-title">Enviar solución</h2>
        <p className="modal-copy">
          La respuesta quedará guardada y se enviará a{" "}
          <b>{ticket.requester_email}</b> con las imágenes en la misma posición.
        </p>
        <form onSubmit={submit}>
          <div className="solution-label">
            <span>Solución para el solicitante*</span>
            <div
              ref={editor}
              className="solution-editor"
              contentEditable={!sending}
              role="textbox"
              aria-multiline="true"
              aria-label="Solución para el solicitante"
              data-placeholder="Escribe la respuesta y pega imágenes donde quieras que aparezcan..."
              onPaste={pasteContent}
              onInput={() => setError("")}
            />
            {processing > 0 && (
              <small className="processing-images">
                Preparando {processing} imagen(es)…
              </small>
            )}
          </div>
          <div className="attachment-tools">
            <label className="solution-upload">
              <input
                type="file"
                multiple
                onChange={(event) => {
                  addFiles(Array.from(event.target.files || []));
                  event.currentTarget.value = "";
                }}
              />
              <span>＋ Adjuntar Excel, PDF u otros archivos</span>
            </label>
            <span>
              Las imágenes pegadas dentro del texto aparecerán allí mismo en el
              correo. Para quitarlas, selecciónalas y presiona Supr.
            </span>
          </div>
          {files.length > 0 && (
            <div className="solution-files">
              {files.map((file, index) => (
                <SolutionFile
                  key={`${file.name}-${file.lastModified}-${index}`}
                  file={file}
                  onRemove={() =>
                    setFiles((current) =>
                      current.filter((_, fileIndex) => fileIndex !== index),
                    )
                  }
                />
              ))}
            </div>
          )}
          {error && (
            <div className="modal-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="ghost"
              type="button"
              disabled={sending || Boolean(processing)}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="primary"
              disabled={sending || Boolean(processing)}
            >
              {sending
                ? "Guardando solución..."
                : processing
                  ? "Preparando imágenes..."
                  : "Enviar solución y finalizar"}{" "}
              <b>→</b>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SolutionFile({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="solution-file">
      {preview ? (
        <img src={preview} alt="Vista previa del archivo pegado" />
      ) : (
        <span className="file-icon">DOC</span>
      )}
      <div>
        <b>{file.name}</b>
        <small>{sizeLabel(file.size)}</small>
      </div>
      <button
        type="button"
        aria-label={`Quitar ${file.name}`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  color = "",
}: {
  label: string;
  value: string | number;
  note: string;
  color?: string;
}) {
  return (
    <div className={`metric ${color}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{note}</small>
    </div>
  );
}
