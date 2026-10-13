import type { CSSProperties } from "react";
import "./Welcome.css";

type WelcomeProps = {
  onNewRequest: () => void;
  onMyTickets: () => void;
};

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {diagonal ? (
        <path d="M6 18 18 6M6 6h12v12" />
      ) : (
        <path d="M4 12h15m-6-6 6 6-6 6" />
      )}
    </svg>
  );
}

function CategoryIcon({ type }: { type: "sample" | "quote" | "analysis" | "other" }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {type === "sample" && <><path d="m14 3 10 5.5V20L14 25 4 20V8.5L14 3Z" /><path d="m4 8.5 10 6 10-6M14 14.5V25M9 6l10 5.5" /></>}
      {type === "quote" && <><path d="M7 3h14v22l-3-2-4 2-4-2-3 2V3Z" /><path d="M11 8h6m-6 5h6m-6 5h3" /></>}
      {type === "analysis" && <><path d="M4 4v20h21M9 18v-5m6 5V8m6 10v-8" /><path d="m7 8 7-5 9 1" /></>}
      {type === "other" && <><rect x="4" y="4" width="20" height="20" rx="6" /><path d="M9 14h10m-5-5v10" /></>}
    </svg>
  );
}

const categories = [
  { type: "sample", title: "Muestras", description: "Puntos de venta, cobertura y bases para tus estudios.", label: "El alcance que necesitas", color: "blue" },
  { type: "quote", title: "Cotizaciones", description: "Comparte el alcance y los detalles de tu requerimiento.", label: "De la idea al presupuesto", color: "gold" },
  { type: "analysis", title: "Análisis", description: "Indicadores e información para responder tus preguntas.", label: "Datos que dan claridad", color: "teal" },
  { type: "other", title: "Otras solicitudes", description: "Cuéntanos qué necesitas y acompáñalo con tus insumos.", label: "También hay espacio para eso", color: "navy" },
] as const;

export default function Welcome({ onNewRequest, onMyTickets }: WelcomeProps) {
  return (
    <div className="welcome">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <div className="welcome-eyebrow"><span /> TU EQUIPO, MÁS CERCA</div>
          <h1 id="welcome-title">Cada solicitud,<br />un paso <span>adelante.<svg viewBox="0 0 360 18" fill="none" aria-hidden="true"><path d="M3 12C93 2 222 1 355 10" /></svg></span></h1>
          <p className="welcome-lead">Tus ideas necesitan respuestas.<br className="welcome-desktop-break" /> Aquí conectamos lo que necesitas con el equipo que lo hace posible.</p>
          <div className="welcome-actions">
            <button type="button" className="welcome-primary" onClick={onNewRequest}>Crear una solicitud <Arrow /></button>
            <button type="button" className="welcome-secondary" onClick={onMyTickets}>Consultar mis tickets <Arrow diagonal /></button>
          </div>
          <div className="welcome-support"><span className="welcome-support-icon"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m10 2 6 2v5c0 4-6 8-6 8S4 13 4 9V4l6-2Z" /><path d="m7 9 2 2 4-4" /></svg></span>Un solo lugar para solicitar, seguir y resolver.</div>
        </div>

        <div className="welcome-visual" aria-hidden="true">
          <div className="welcome-orbit welcome-orbit-outer" />
          <div className="welcome-orbit welcome-orbit-inner" />
          <div className="welcome-orbit-dot" />
          <span className="welcome-visual-caption">ASÍ AVANZA TU SOLICITUD</span>
          <div className="welcome-ticket-shadow" />
          <div className="welcome-ticket-preview">
            <div className="welcome-preview-header"><span className="welcome-preview-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v14H6V3Z" /><path d="M14 3v5h5M10 12h5m-5 4h5" /></svg></span><span>CENTRO DE SOLICITUDES<small>Todo comienza contigo</small></span><span className="welcome-preview-dots">•••</span></div>
            <h2>Tu próxima<br />solicitud.</h2>
            <div className="welcome-preview-lines"><i /><i /></div>
            <div className="welcome-preview-divider"><span /><span /></div>
            <div className="welcome-journey">
              <div className="welcome-journey-track"><i /></div>
              <div className="welcome-journey-step welcome-journey-step-one"><span><svg viewBox="0 0 18 18" fill="none"><path d="m4 9 3 3 7-7" /></svg></span><div><b>Solicitud recibida</b><small>Tu necesidad tiene un lugar</small></div></div>
              <div className="welcome-journey-step welcome-journey-step-two"><span><svg viewBox="0 0 18 18" fill="none"><path d="M9 4v5l3 2" /><circle cx="9" cy="9" r="6" /></svg></span><div><b>En proceso</b><small>El equipo trabaja contigo</small></div><i className="welcome-working-dots"><i /><i /><i /></i></div>
              <div className="welcome-journey-step welcome-journey-step-three"><span><svg viewBox="0 0 18 18" fill="none"><path d="m4 9 3 3 7-7" /></svg></span><div><b>Solución entregada</b><small>Un paso más, juntos</small></div></div>
            </div>
          </div>
          <div className="welcome-floating-note"><span><svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14v11H9l-4 4V5Z" /><path d="M9 9h6m-6 3h4" /></svg></span><div>Siempre al tanto<small>Consulta el avance de tu ticket</small></div><span className="welcome-note-spark">✦</span></div>
          <div className="welcome-visual-mark">d<span>&</span>n</div>
        </div>
      </section>

      <section className="welcome-workflow" aria-label="Cómo funciona">
        <div className="welcome-workflow-heading"><span className="welcome-eyebrow">DE PRINCIPIO A FIN</span><h2>Así de claro.</h2></div>
        <ol>
          <li><span className="welcome-step-number">01</span><div><h3>Solicita</h3><p>Cuéntanos qué necesitas y adjunta tus insumos.</p></div></li>
          <li><span className="welcome-step-number">02</span><div><h3>Seguimos contigo</h3><p>Consulta el estado y el responsable de tu ticket.</p></div></li>
          <li><span className="welcome-step-number">03</span><div><h3>Recibe tu solución</h3><p>Encuentra la respuesta y los archivos de entrega.</p></div></li>
        </ol>
      </section>

      <section className="welcome-categories" aria-labelledby="welcome-categories-title">
        <div className="welcome-section-heading"><div><div className="welcome-eyebrow">¿QUÉ NECESITAS HOY?</div><h2 id="welcome-categories-title">El punto de partida está aquí.</h2></div><p>Distintas necesidades.<br /> Un mismo equipo para avanzar.</p></div>
        <div className="welcome-category-grid">{categories.map((category, index) => <article key={category.type} className={`welcome-category welcome-category-${category.color}`} style={{ "--welcome-card-index": index } as CSSProperties}><span className="welcome-category-icon"><CategoryIcon type={category.type} /></span><h3>{category.title}</h3><p>{category.description}</p><span className="welcome-category-label">{category.label}</span></article>)}</div>
      </section>
    </div>
  );
}
