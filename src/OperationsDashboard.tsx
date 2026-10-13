import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Ticket } from "./sharepoint";
import type { TicketFilters } from "./ticketManagement";
import { buildTicketAnalytics, monthBounds, monthLabel } from "./ticketAnalytics";
import type { TicketAnalytics } from "./ticketAnalytics";
import "./OperationsDashboard.css";

type Props = { tickets: Ticket[]; onOpenTickets: (filters?: Partial<TicketFilters>) => void };
const number = new Intl.NumberFormat("es-CO");
const percent = (value: number | null) => value === null ? "—" : `${Math.round(value)}%`;
const colors = ["#f2c84b", "#356df3", "#16a394"];
const elapsedLabel = (days: number | null) => days === null ? "Sin cierres medibles" : `${(days < 1 ? days * 24 : days).toLocaleString("es-CO", { maximumFractionDigits: 1 })} ${days < 1 ? "h" : "días"} de cierre`;

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChartIcon({ kind }: { kind: "tickets" | "check" | "clock" | "activity" }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {kind === "tickets" ? <><path d="M8 4h11v16H5V7m3-3v4H4m4-4L4 8M9 12h6m-6 4h4" /></> : kind === "check" ? <><circle cx="12" cy="12" r="8.5" /><path d="m8 12 3 3 5-6" /></> : kind === "clock" ? <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></> : <><path d="M3 12h4l3-7 4 14 3-7h4" /></>}
  </svg>;
}

function Metric({ label, value, suffix, detail, kind, accent }: {
  label: string; value: string; suffix?: string; detail: string; kind: "tickets" | "check" | "clock" | "activity"; accent: string;
}) {
  return <article className={`ops-metric ops-metric-${accent}`}>
    <div className="ops-metric-top"><span>{label}</span><span className="ops-metric-icon"><ChartIcon kind={kind} /></span></div>
    <div className="ops-metric-value">{value}{suffix ? <span>{suffix}</span> : null}</div>
    <p>{detail}</p>
  </article>;
}

function Panel({ eyebrow, title, children, className = "", action }: {
  eyebrow: string; title: string; children: ReactNode; className?: string; action?: ReactNode;
}) {
  return <section className={`ops-panel ${className}`}><header className="ops-panel-heading"><div><span className="ops-eyebrow">{eyebrow}</span><h3>{title}</h3></div>{action}</header>{children}</section>;
}

function EmptyChart({ text = "Los gráficos aparecerán cuando se registren solicitudes en este periodo." }: { text?: string }) {
  return <div className="ops-empty"><span className="ops-empty-symbol"><ChartIcon kind="activity" /></span><p>{text}</p></div>;
}

function FlowChart({ data }: { data: TicketAnalytics["trend"] }) {
  const id = useId();
  const max = Math.max(1, ...data.flatMap((row) => [row.created, row.completed]));
  const ceiling = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const totals = data.reduce((result, row) => ({ created: result.created + row.created, completed: result.completed + row.completed }), { created: 0, completed: 0 });
  const y = (value: number) => 177 - value / ceiling * 145;
  const x = (index: number) => 60 + index * 91;
  const points = data.map((row, i) => `${x(i)},${y(row.completed)}`).join(" ");
  return <>
    <div className="ops-flow-summary"><div><i className="ops-dot ops-blue" />Recibidos <b>{number.format(totals.created)}</b></div><div><i className="ops-dot ops-teal" />Finalizados <b>{number.format(totals.completed)}</b></div><span>Últimos 6 meses</span></div>
    <div className="ops-flow-plot"><svg viewBox="0 0 560 217" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Solicitudes recibidas y finalizadas por mes</title>
      <desc id={`${id}-desc`}>{data.map((row) => `${monthLabel(row.key)}: ${row.created} recibidas, ${row.completed} finalizadas`).join(". ")}</desc>
      <defs><linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#356df3" stopOpacity=".82" /><stop offset="100%" stopColor="#356df3" stopOpacity=".22" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((step) => <g key={step}><line x1="29" x2="549" y1={y(ceiling * step / 4)} y2={y(ceiling * step / 4)} stroke="#e8edf4" strokeDasharray={step ? "3 5" : undefined} /><text x="20" y={y(ceiling * step / 4) + 4} textAnchor="end" className="ops-chart-label">{ceiling * step / 4}</text></g>)}
      {data.map((row, index) => <g key={row.key}><rect x={x(index) - 18} y={y(row.created)} width="36" height={177 - y(row.created)} rx="5" fill={`url(#${id}-bar)`}><title>{monthLabel(row.key)}: {row.created} recibidos</title></rect><text x={x(index)} y="205" textAnchor="middle" className="ops-chart-label">{row.label.replace(".", "")}</text></g>)}
      <polyline points={points} fill="none" stroke="#16a394" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((row, index) => <circle key={row.key} cx={x(index)} cy={y(row.completed)} r="4.5" fill="white" stroke="#16a394" strokeWidth="2.5"><title>{monthLabel(row.key)}: {row.completed} finalizados</title></circle>)}
      {data.map((row, index) => {
        const receivedY = y(row.created);
        const completedY = y(row.completed);
        const labelsAreClose = Math.abs(receivedY - completedY) < 26;
        return <g key={row.key} aria-hidden="true">
          <text x={x(index) - (labelsAreClose ? 8 : 0)} y={receivedY - 12} textAnchor={labelsAreClose ? "end" : "middle"} className="ops-flow-value ops-flow-value-received">{number.format(row.created)}</text>
          <text x={x(index) + (labelsAreClose ? 8 : 0)} y={completedY - 12} textAnchor={labelsAreClose ? "start" : "middle"} className="ops-flow-value ops-flow-value-completed">{number.format(row.completed)}</text>
        </g>;
      })}
    </svg></div>
    <p className="ops-chart-note">Cada evento cuenta en su mes: creación o cierre válido de tickets actualmente finalizados. Incluye tickets creados antes del periodo.</p>
    <details className="ops-data-details"><summary>Ver valores del gráfico</summary><div className="ops-table-scroll"><table><caption>Volumen mensual · hora de Bogotá</caption><thead><tr><th>Mes</th><th>Recibidos</th><th>Finalizados</th></tr></thead><tbody>{data.map((row) => <tr key={row.key}><th scope="row">{monthLabel(row.key)}</th><td>{row.created}</td><td>{row.completed}</td></tr>)}</tbody></table></div></details>
  </>;
}

function StatusDonut({ analytics }: { analytics: TicketAnalytics }) {
  let offset = 0;
  return <div className="ops-status-content">
    <div className="ops-donut-wrap"><svg viewBox="0 0 170 170" role="img" aria-label={analytics.statuses.map((row) => `${row.status}: ${row.count}`).join(", ")}>
      <circle cx="85" cy="85" r="64" fill="none" stroke="#eef2f7" strokeWidth="19" />
      {analytics.statuses.map((row, index) => {
        const share = analytics.total ? row.count / analytics.total * 100 : 0;
        const start = offset; offset += share;
        return share ? <circle key={row.status} cx="85" cy="85" r="64" fill="none" stroke={colors[index]} strokeWidth="19" pathLength="100" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-start} transform="rotate(-90 85 85)" /> : null;
      })}
    </svg><div className="ops-donut-label"><strong>{number.format(analytics.active)}</strong><span>por gestionar</span></div></div>
    <div className="ops-status-legend">{analytics.statuses.map((row, index) => <div key={row.status}><i className="ops-dot" style={{ background: colors[index] }} /><span>{row.status}</span><strong>{row.count}</strong><small>{percent(analytics.total ? row.count / analytics.total * 100 : null)}</small></div>)}</div>
  </div>;
}

function Breakdown({ rows, total, onChoose, tint = "blue" }: {
  rows: TicketAnalytics["countries"]; total: number; onChoose: (key: string) => void; tint?: "blue" | "teal";
}) {
  if (!rows.length) return <EmptyChart />;
  const max = Math.max(...rows.map((row) => row.count));
  return <div className={`ops-breakdown ops-breakdown-${tint}`}>{rows.map((row) => <button key={row.key} className="ops-breakdown-row" disabled={!row.key} type="button" onClick={() => onChoose(row.key)} aria-label={`Consultar ${row.count} tickets de ${row.label}`}>
    <span className="ops-breakdown-caption"><span>{row.label}</span><b>{number.format(row.count)} <small>{percent(row.count / total * 100)}</small></b></span>
    <span className="ops-bar-track"><span style={{ width: `${row.count / max * 100}%` }} /></span>
  </button>)}</div>;
}

export default function OperationsDashboard({ tickets, onOpenTickets }: Props) {
  const [month, setMonth] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const analytics = useMemo(() => buildTicketAnalytics(tickets, month, now), [tickets, month, now]);
  const dateFilters = monthBounds(month);
  const open = (filters: Partial<TicketFilters> = {}) => onOpenTickets({ ...dateFilters, ...filters });
  const average = analytics.averageClosureDays;
  const avgValue = average === null ? "—" : average < 1 ? Math.max(0, average * 24).toLocaleString("es-CO", { maximumFractionDigits: 1 }) : average.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  const period = month ? monthLabel(month) : "Todo el historial";
  const oldest = analytics.aging[3].count;
  const maxActive = Math.max(1, ...analytics.analysts.map((analyst) => analyst.active));
  const assignedCount = analytics.analysts.filter((analyst) => analyst.key !== "unassigned").length;
  return <div className="ops-dashboard">
    <header className="ops-heading"><div><span className="ops-eyebrow"><i className="ops-live-dot" />Visibilidad de la operación</span><h1>La gestión, en perspectiva.</h1><p>Entiende la demanda, sigue los avances y encuentra dónde actuar.</p></div>
      <label className="ops-period"><span>Solicitudes creadas en</span><select value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Periodo del dashboard"><option value="">Todo el historial</option>{analytics.availableMonths.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}</select></label>
    </header>
    <div className="ops-context"><span className="ops-period-pill">{period}</span><p>Estado actual de las solicitudes del periodo · Fechas en Bogotá</p><button className="ops-text-button" type="button" onClick={() => open()}>Consultar tickets <Arrow /></button></div>
    <section className="ops-metrics" aria-label="Indicadores de gestión">
      <Metric label="Solicitudes registradas" value={number.format(analytics.total)} detail="Volumen de solicitudes del periodo seleccionado" kind="tickets" accent="blue" />
      <Metric label="Gestión completada" value={percent(analytics.completionRate)} detail={`${number.format(analytics.finalized)} finalizadas de ${number.format(analytics.total)} solicitudes`} kind="check" accent="teal" />
      <Metric label="Tiempo medio de cierre" value={avgValue} suffix={average === null ? undefined : average < 1 ? "h" : "días"} detail={analytics.validClosures ? `Creación → cierre · ${analytics.validClosures} fechas válidas` : "Aún no hay cierres con fechas válidas"} kind="clock" accent="navy" />
      <Metric label="Trabajo por resolver" value={number.format(analytics.active)} detail={`${analytics.statuses[1].count} en proceso · ${analytics.statuses[0].count} pendientes`} kind="activity" accent="gold" />
    </section>

    {!analytics.total ? <div className="ops-zero-notice"><ChartIcon kind="tickets" /><div><strong>{tickets.length ? "No hay solicitudes en este periodo" : "Tu operación empieza con la primera solicitud"}</strong><p>{tickets.length ? "Selecciona otro mes para explorar la gestión." : "Cuando lleguen tickets, aquí podrás ver el avance, la carga del equipo y los tiempos de atención."}</p></div></div> : null}

    <div className="ops-main-grid">
      <Panel className="ops-flow-panel" eyebrow="Ritmo de trabajo" title="Demanda y resolución" action={<span className="ops-panel-tag">Por mes de evento</span>}><FlowChart data={analytics.trend} /></Panel>
      <Panel className="ops-status-panel" eyebrow="Avance del periodo" title="¿En qué estado estamos?"><StatusDonut analytics={analytics} /><p className="ops-chart-note">Distribución del estado actual de los {analytics.total} tickets del periodo.</p></Panel>

      <Panel className="ops-workload-panel" eyebrow="Capacidad del equipo" title="Carga y avance por analista" action={<span className="ops-panel-tag">{assignedCount} {assignedCount === 1 ? "analista" : "analistas"}</span>}>
        <div className="ops-legend"><span><i className="ops-dot ops-gold" />Pendiente</span><span><i className="ops-dot ops-blue" />En proceso</span><span className="ops-legend-caption">Activos / total</span></div>
        {analytics.analysts.length ? <div className="ops-analyst-list">{analytics.analysts.map((analyst, index) => <button className="ops-analyst-row" type="button" key={analyst.key} onClick={() => open({ assignee: analyst.key })} aria-label={`Consultar tickets de ${analyst.name}: ${analyst.active} activos de ${analyst.total}, ${analyst.completed} finalizados`}>
          <span className={`ops-avatar ops-avatar-${index % 3}`}>{analyst.key === "unassigned" ? "?" : analyst.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <span className="ops-analyst-body"><span className="ops-analyst-name">{analyst.name}<small>{analyst.completed} finalizados</small></span><span className="ops-stacked-bar"><i style={{ width: `${analyst.pending / maxActive * 100}%`, background: colors[0] }} /><i style={{ width: `${analyst.inProgress / maxActive * 100}%`, background: colors[1] }} /></span><span className="ops-analyst-performance"><span>{percent(analyst.completionRate)} completado</span><span>{elapsedLabel(analyst.averageClosureDays)}{analyst.validClosures ? ` · ${analyst.validClosures} válidos` : ""}</span></span></span><span className="ops-analyst-count">{analyst.active}<small> / {analyst.total}</small></span><Arrow diagonal />
        </button>)}</div> : <EmptyChart text="La distribución del trabajo se mostrará al recibir solicitudes." />}
        <p className="ops-chart-note">Avance = finalizados / asignados. Promedio de cierre solo con fechas válidas. La asignación corresponde al responsable actual.</p>
      </Panel>

      <Panel className="ops-focus-panel" eyebrow="Para actuar hoy" title="Tu foco de atención"><div className="ops-focus-list">
        <button className="ops-focus-row ops-focus-late" type="button" onClick={() => open({ deadline: "Vencido" })}><span className="ops-focus-count">{analytics.late}</span><span><strong>Compromisos vencidos</strong><small>Solicitudes abiertas fuera de plazo</small></span><Arrow /></button>
        <button className="ops-focus-row" type="button" onClick={() => open({ deadline: "Vence hoy" })}><span className="ops-focus-count">{analytics.dueToday}</span><span><strong>Vencen hoy</strong><small>Prioriza la siguiente respuesta</small></span><Arrow /></button>
        <button className="ops-focus-row" type="button" onClick={() => open({ assignee: "unassigned" })}><span className="ops-focus-count">{analytics.unassigned}</span><span><strong>Activos sin asignar</strong><small>Ver todos los tickets sin responsable</small></span><Arrow /></button>
      </div><div className="ops-focus-foot"><span className="ops-spark">↗</span><p>{analytics.noCommitment ? `${analytics.noCommitment} tickets abiertos aún no tienen fecha compromiso.` : analytics.active ? "Todos los tickets abiertos tienen una fecha compromiso." : "No hay tickets abiertos en este periodo."}</p></div></Panel>

      <Panel className="ops-country-panel" eyebrow="Origen de la demanda" title="Solicitudes por país"><Breakdown rows={analytics.countries} total={analytics.total} onChoose={(country) => open({ country })} /><p className="ops-chart-note">Participación sobre las solicitudes del periodo. Selecciona un país para consultar sus tickets.</p></Panel>
      <Panel className="ops-type-panel" eyebrow="Qué necesita el negocio" title="Tipos de solicitud"><Breakdown rows={analytics.types} total={analytics.total} onChoose={(type) => open({ type })} tint="teal" /><p className="ops-chart-note">Distribución por tipo de solicitud del periodo seleccionado.</p></Panel>

      <Panel className="ops-aging-panel" eyebrow="Tiempo en la cola" title="Antigüedad de los abiertos" action={<span className="ops-panel-tag">Días calendario</span>}>
        <div className="ops-aging-chart" role="img" aria-label={analytics.aging.map((band) => `${band.label}: ${band.count} tickets`).join(", ")}>{analytics.aging.map((band, index) => <div className={`ops-aging-column ops-aging-column-${index}`} key={band.label}><strong>{band.count}</strong><div className="ops-aging-track"><span style={{ height: `${band.count ? Math.max(7, band.count / Math.max(1, ...analytics.aging.map((item) => item.count)) * 100) : 0}%` }} /></div><span>{band.label}</span></div>)}</div>
        <p className="ops-chart-note">{oldest ? `${oldest} tickets llevan 15 días o más abiertos. ` : "Días transcurridos desde la creación. "}{analytics.unknownAge ? `${analytics.unknownAge} excluidos por fecha ausente o no válida.` : `Base: ${analytics.active} solicitudes abiertas.`}</p>
      </Panel>
      <Panel className="ops-compliance-panel" eyebrow="Compromisos de servicio" title="Cumplimiento de fechas">
        <div className="ops-compliance-value"><strong>{percent(analytics.commitmentRate)}</strong><span>cerrados<br />a tiempo</span><span className="ops-compliance-seal"><ChartIcon kind="check" /></span></div>
        <div className="ops-compliance-track"><span style={{ width: `${analytics.commitmentRate || 0}%` }} /></div>
        <div className="ops-compliance-counts"><span><i className="ops-dot ops-teal" />A tiempo <b>{analytics.onTime}</b></span><span><i className="ops-dot ops-gold" />Fuera de plazo <b>{analytics.lateClosures}</b></span></div>
        <p className="ops-chart-note">{analytics.eligibleCommitments ? `Base: ${analytics.eligibleCommitments} tickets finalizados con fecha compromiso y cierre válido.` : "Se necesitan tickets finalizados con fecha compromiso y cierre válido para calcular este indicador."}{analytics.excludedCommitments ? ` ${analytics.excludedCommitments} finalizados sin datos suficientes.` : ""} Se compara con la fecha compromiso actual.</p>
      </Panel>
    </div>
    <footer className="ops-methodology"><span className="ops-methodology-icon">i</span><p>Los indicadores describen las solicitudes creadas en el periodo seleccionado. El gráfico de demanda usa el mes de cada evento. El tiempo de cierre considera días continuos de 24 horas, con cierre posterior a la creación y no futuro.{analytics.excludedClosures ? ` Se excluyen ${analytics.excludedClosures} tickets finalizados del promedio por fechas ausentes o no válidas.` : ""}</p><button className="ops-text-button" type="button" onClick={() => open()}>Ir a la gestión <Arrow /></button></footer>
  </div>;
}
