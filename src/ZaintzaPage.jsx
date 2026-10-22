import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { severityLabels, statusLabels } from "./data/alerts";
import { createDemoEvents } from "./data/demoEvents";
import InvestigationEditor from "./InvestigationEditor";
import "./styles/zaintza.css";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Madrid",
});

function displayValue(value) {
    return value !== null && value !== undefined && value !== "" && value !== "-"
        ? String(value)
        : "No disponible";
}

function formatDate(value) {
    if (!value) return "Sin lectura";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "Fecha no disponible"
        : dateFormatter.format(date);
}

function toAlert(event, demo = false) {
    const detection = event.detection;

    return {
        ...event,
        title: detection?.title || "Inicio de sesión fallido",
        severity: detection?.severity || "low",
        status: statusLabels[event.status] ? event.status : "new",
        asset: displayValue(event.computer),
        username: displayValue(event.username),
        sourceIp: displayValue(event.sourceIp),
        description:
            detection?.description ||
            (demo
                ? "Evento ficticio de inicio de sesión fallido, incluido para " +
                "practicar la revisión y el cambio de estado."
                : "Windows ha registrado un fallo de inicio de sesión. " +
                "El evento aislado no confirma un ataque y requiere contexto."),
        recommendation: detection
            ? "Revisa los eventos relacionados y verifica si corresponden " +
            "a una prueba autorizada, credenciales mal configuradas o " +
            "actividad no reconocida. Comprueba si hubo accesos correctos posteriores."
            : "Comprueba la cuenta, la hora, el tipo de inicio de sesión " +
            "y el proceso asociado.",
    };
}

function Metric({ title, value, description, tone = "" }) {
    return (
        <article className={`z-metric ${tone}`}>
            <p>{title}</p>
            <strong>{value}</strong>
            <span>{description}</span>
        </article>
    );
}

function Fact({ label, children }) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

function Badge({ kind, value, children }) {
    return (
        <span className={`z-badge z-${kind}-${value}`}>
            {children}
        </span>
    );
}

export default function ZaintzaPage() {
    const [params] = useSearchParams();

    // La versión compilada utiliza siempre datos ficticios.
    // El modo real solo está disponible mediante Vite en desarrollo.
    const demo = !import.meta.env.DEV || params.get("mode") === "demo";

    return <ZaintzaConsole key={demo ? "demo" : "local"} demo={demo} />;
}

function ZaintzaConsole({ demo }) {
    const [alerts, setAlerts] = useState(() =>
        demo ? createDemoEvents().map((event) => toAlert(event, true)) : []
    );

    const [search, setSearch] = useState("");
    const [severity, setSeverity] = useState("all");
    const [status, setStatus] = useState("all");
    const [selectedId, setSelectedId] = useState(null);
    const [privacy, setPrivacy] = useState(!demo);
    const [loading, setLoading] = useState(!demo);
    const [error, setError] = useState("");
    const [collectedAt, setCollectedAt] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [savingId, setSavingId] = useState(null);
    const [saveMessage, setSaveMessage] = useState(null);

    const statusVersions = useRef(new Map());
    const savingRef = useRef(false);
    const saveController = useRef(null);
    const mountedRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
            saveController.current?.abort();
        };
    }, []);

    useEffect(() => {
        // La demo no consulta la API ni intenta leer Windows.
        if (demo) return;

        let stopped = false;
        let timer;
        let requestController;

        async function loadEvents() {
            setLoading(true);

            const controller = new AbortController();
            requestController = controller;
            const versionsAtStart = new Map(statusVersions.current);
            const timeout = window.setTimeout(() => controller.abort(), 20000);

            try {
                const response = await fetch("/api/events", {
                    signal: controller.signal,
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error(`Error del servicio (${response.status}).`);
                }

                const data = await response.json();

                if (
                    !Array.isArray(data.events) ||
                    !data.events.every(
                        (event) =>
                            event &&
                            typeof event.id === "string" &&
                            event.eventId === 4625 &&
                            typeof event.timestamp === "string" &&
                            Number.isFinite(Date.parse(event.timestamp))
                    )
                ) {
                    throw new Error("La respuesta no contiene eventos válidos.");
                }

                if (stopped) return;

                setAlerts((previous) => {
                    const previousById = new Map(
                        previous.map((event) => [event.id, event])
                    );

                    return data.events
                        .map((event) => {
                            const alert = toAlert(event);
                            const previousEvent = previousById.get(event.id);

                            const changedDuringRead =
                                (statusVersions.current.get(event.id) || 0) !==
                                (versionsAtStart.get(event.id) || 0);

                            return changedDuringRead && previousEvent
                                ? {
                                    ...alert,
                                    status: previousEvent.status,
                                    investigation: previousEvent.investigation,
                                }
                                : alert;
                        })
                        .sort(
                            (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
                        );
                });

                setCollectedAt(data.collectedAt);
                setError("");
            } catch (readError) {
                if (stopped) return;

                setError(
                    readError.name === "AbortError"
                        ? "La consulta ha superado el tiempo de espera."
                        : readError.message
                );
            } finally {
                window.clearTimeout(timeout);

                if (!stopped) {
                    setLoading(false);
                    timer = window.setTimeout(loadEvents, 30000);
                }
            }
        }

        loadEvents();

        return () => {
            stopped = true;
            requestController?.abort();
            window.clearTimeout(timer);
        };
    }, [demo, refreshKey]);

    const filteredAlerts = useMemo(() => {
        const query = search.trim().toLocaleLowerCase("es");

        return alerts.filter((alert) => {
            const searchable = [
                alert.id,
                alert.title,
                alert.eventId,
                alert.detection?.ruleId,
                ...(privacy ? [] : [alert.asset, alert.username, alert.sourceIp]),
            ]
                .join(" ")
                .toLocaleLowerCase("es");

            return (
                searchable.includes(query) &&
                (severity === "all" || alert.severity === severity) &&
                (status === "all" || alert.status === status)
            );
        });
    }, [alerts, search, severity, status, privacy]);

    const selectedAlert =
        filteredAlerts.find((alert) => alert.id === selectedId) ??
        filteredAlerts[0];

    const detectedCount = alerts.filter((alert) => alert.detection).length;
    const investigatingCount = alerts.filter(
        (alert) => alert.status === "investigating"
    ).length;
    const resolvedCount = alerts.filter(
        (alert) => alert.status === "resolved"
    ).length;

    const hasData = demo || Boolean(collectedAt);

    const connectionLabel = demo
        ? "Demo · datos ficticios"
        : error
            ? collectedAt
                ? "Lectura desactualizada"
                : "Sin conexión"
            : collectedAt
                ? "Conectado"
                : "Conectando";

    const sensitiveValue = (value) =>
        privacy ? "Oculto" : displayValue(value);

    function clearFilters() {
        setSearch("");
        setSeverity("all");
        setStatus("all");
    }

    function togglePrivacy() {
        setPrivacy((previous) => !previous);
        setSearch("");
    }

    function resetDemo() {
        setAlerts(createDemoEvents().map((event) => toAlert(event, true)));
        setSelectedId(null);
        setSaveMessage(null);
        clearFilters();
    }

    function saveInvestigationLocally(id, investigation) {
        statusVersions.current.set(
            id,
            (statusVersions.current.get(id) || 0) + 1
        );

        setAlerts((previous) =>
            previous.map((alert) =>
                alert.id === id ? { ...alert, investigation } : alert
            )
        );
    }

    async function updateStatus(event) {
        if (!selectedAlert || savingRef.current) return;

        const id = selectedAlert.id;
        const nextStatus = event.target.value;

        if (!statusLabels[nextStatus]) return;

        if (demo) {
            setAlerts((previous) =>
                previous.map((alert) =>
                    alert.id === id ? { ...alert, status: nextStatus } : alert
                )
            );

            setSaveMessage({
                error: false,
                text: "Estado actualizado en la demo. Se reinicia al recargar.",
            });
            return;
        }

        savingRef.current = true;
        setSavingId(id);
        setSaveMessage(null);

        const controller = new AbortController();
        saveController.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(
                `/api/events/${encodeURIComponent(id)}/status`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: nextStatus }),
                    signal: controller.signal,
                }
            );

            if (!response.ok) {
                throw new Error(`Error del servicio (${response.status}).`);
            }

            const saved = await response.json();

            if (saved.id !== id || saved.status !== nextStatus) {
                throw new Error("El servicio no confirmó el cambio.");
            }

            if (!mountedRef.current) return;

            statusVersions.current.set(
                id,
                (statusVersions.current.get(id) || 0) + 1
            );

            setAlerts((previous) =>
                previous.map((alert) =>
                    alert.id === id ? { ...alert, status: saved.status } : alert
                )
            );

            setSaveMessage({
                error: false,
                text: `Estado de ${id} guardado en este equipo.`,
            });
        } catch (saveError) {
            if (!mountedRef.current) return;

            setSaveMessage({
                error: true,
                text:
                    saveError.name === "AbortError"
                        ? `No se pudo confirmar el guardado de ${id}. Comprueba su estado al actualizar.`
                        : `No se ha guardado ${id}. ${saveError.message}`,
            });
        } finally {
            window.clearTimeout(timeout);
            savingRef.current = false;

            if (mountedRef.current) setSavingId(null);
        }
    }

    return (
        <main className="zaintza">
            <header className="z-header">
                <div>
                    <p className="z-eyebrow">
                        {demo ? "Demo interactiva · Datos ficticios" : "Consola de seguridad · Windows"}
                    </p>
                    <h1>Zaintza SOC</h1>
                    <p className="z-subtitle">
                        Eventos, detecciones y seguimiento de investigación.
                    </p>
                </div>

                <div className="z-header-actions">
                    {import.meta.env.DEV && (
                        <Link
                            className="z-button"
                            to={demo ? "/" : "/?mode=demo"}
                        >
                            {demo ? "Usar Windows local" : "Probar demo"}
                        </Link>
                    )}

                    <button
                        type="button"
                        className="z-button"
                        aria-pressed={privacy}
                        onClick={togglePrivacy}
                    >
                        Privacidad: {privacy ? "activada" : "desactivada"}
                    </button>

                    <a
                        href="https://liernimurgoitio.net/project/zaintza"
                        className="z-back"
                    >
                        Portafolio ↗
                    </a>
                </div>
            </header>

            {demo && (
                <div className="z-message">
                    <strong>Demo pública con un escenario ficticio. </strong>
                    Puedes buscar eventos, revisar evidencias y cambiar estados.
                    No consulta Windows ni envía estos cambios al servidor.
                    Los estados se reinician al recargar o pulsar «Reiniciar demo».
                </div>
            )}

            <div className="z-connection">
                <div className="z-connection-info">
                    <span
                        className={`z-connection-state ${demo ? "" : error ? "is-error" : collectedAt ? "is-online" : ""
                            }`}
                    >
                        <span className="z-dot" aria-hidden="true" />
                        {connectionLabel}
                    </span>

                    <span>
                        {demo ? "Escenario de ejemplo · EventID 4625" : "Windows Security · EventID 4625"}
                    </span>

                    <span>
                        {demo
                            ? "Fecha del escenario: 15/09/2026"
                            : `Última lectura: ${formatDate(collectedAt)}`}
                    </span>
                </div>

                <button
                    type="button"
                    className="z-button"
                    disabled={loading}
                    onClick={
                        demo
                            ? resetDemo
                            : () => setRefreshKey((previous) => previous + 1)
                    }
                >
                    {demo ? "Reiniciar demo" : loading ? "Consultando…" : "Actualizar"}
                </button>
            </div>

            {error && !demo && (
                <div className="z-message is-error" role="alert">
                    <strong>No se pudo actualizar. </strong>
                    {error} Comprueba el servicio local y sus permisos.
                    {collectedAt && " Se muestran los últimos datos recuperados."}
                </div>
            )}

            {saveMessage && (
                <div
                    className={`z-message ${saveMessage.error ? "is-error" : "is-success"}`}
                    role={saveMessage.error ? "alert" : "status"}
                >
                    {saveMessage.text}
                </div>
            )}

            <section className="z-metrics" aria-label="Resumen de eventos cargados">
                <Metric
                    title={demo ? "Eventos de ejemplo" : "Eventos recogidos"}
                    value={hasData ? alerts.length : "—"}
                    description={demo ? "Escenario ficticio" : "Hasta 100 fallos recientes"}
                />
                <Metric
                    title="Eventos con detección"
                    value={hasData ? detectedCount : "—"}
                    description="No equivale a ataques únicos"
                    tone="is-warning"
                />
                <Metric
                    title="En investigación"
                    value={hasData ? investigatingCount : "—"}
                    description="Eventos en revisión"
                />
                <Metric
                    title="Resueltos"
                    value={hasData ? resolvedCount : "—"}
                    description="Eventos con revisión cerrada"
                    tone="is-success"
                />
            </section>

            <section className="z-workspace" aria-label="Investigación de eventos">
                <div className="z-panel">
                    <div className="z-panel-heading">
                        <div>
                            <p className="z-eyebrow">
                                {demo ? "Actividad simulada" : "Registro de actividad"}
                            </p>
                            <h2>Eventos de autenticación</h2>
                        </div>

                        <span className="z-count" aria-live="polite">
                            {filteredAlerts.length} de {alerts.length}
                        </span>
                    </div>

                    <div className="z-filters">
                        <div className="z-field z-search">
                            <label htmlFor="z-search">Buscar</label>
                            <input
                                id="z-search"
                                type="search"
                                value={search}
                                placeholder={
                                    privacy
                                        ? "Evento, título o regla"
                                        : "Cuenta, equipo, IP, evento o regla"
                                }
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>

                        <div className="z-field">
                            <label htmlFor="z-priority">Prioridad</label>
                            <select
                                id="z-priority"
                                value={severity}
                                onChange={(event) => setSeverity(event.target.value)}
                            >
                                <option value="all">Todas</option>
                                {Object.entries(severityLabels).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="z-field">
                            <label htmlFor="z-filter-status">Estado</label>
                            <select
                                id="z-filter-status"
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                            >
                                <option value="all">Todos</option>
                                {Object.entries(statusLabels).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <button type="button" className="z-button" onClick={clearFilters}>
                            Limpiar
                        </button>
                    </div>

                    <div
                        className="z-table-scroll"
                        role="region"
                        aria-label="Tabla de eventos; desplazamiento horizontal disponible"
                        tabIndex={0}
                    >
                        <table className="z-table">
                            <caption className="z-sr-only">
                                {demo ? "Eventos ficticios. " : ""}
                                Pulsa un identificador para ver el detalle.
                            </caption>
                            <thead>
                                <tr>
                                    <th scope="col">Evento / fecha</th>
                                    <th scope="col">Cuenta / equipo</th>
                                    <th scope="col">Prioridad</th>
                                    <th scope="col">Estado</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredAlerts.map((alert) => (
                                    <tr
                                        key={alert.id}
                                        className={selectedAlert?.id === alert.id ? "is-selected" : ""}
                                    >
                                        <td>
                                            <button
                                                type="button"
                                                className="z-event-button"
                                                aria-pressed={selectedAlert?.id === alert.id}
                                                aria-controls="z-detail"
                                                onClick={() => setSelectedId(alert.id)}
                                            >
                                                {alert.id}
                                            </button>
                                            <span className="z-cell-secondary">{alert.title}</span>
                                            <time className="z-cell-secondary" dateTime={alert.timestamp}>
                                                {formatDate(alert.timestamp)}
                                            </time>
                                        </td>

                                        <td>
                                            <span>{sensitiveValue(alert.username)}</span>
                                            <span className="z-cell-secondary">
                                                {sensitiveValue(alert.asset)}
                                            </span>
                                        </td>

                                        <td>
                                            <Badge kind="severity" value={alert.severity}>
                                                {severityLabels[alert.severity] || alert.severity}
                                            </Badge>
                                        </td>

                                        <td>
                                            <Badge kind="status" value={alert.status}>
                                                {statusLabels[alert.status]}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredAlerts.length === 0 && (
                            <div className="z-empty">
                                <h3>
                                    {loading
                                        ? "Consultando Windows…"
                                        : error
                                            ? "No hay resultados disponibles"
                                            : alerts.length
                                                ? "No hay coincidencias"
                                                : "No se encontraron eventos"}
                                </h3>
                                <p>
                                    {alerts.length
                                        ? "Modifica la búsqueda o limpia los filtros."
                                        : "La ausencia de eventos no confirma la ausencia de amenazas."}
                                </p>
                            </div>
                        )}
                    </div>

                    <footer className="z-table-footer">
                        Hora de Euskadi ·{" "}
                        {demo ? "Escenario fijo de demostración" : "Consulta automática cada 30 segundos"}
                    </footer>
                </div>

                <aside
                    id="z-detail"
                    className="z-panel z-detail"
                    aria-labelledby="z-detail-title"
                >
                    <div className="z-panel-heading">
                        <div>
                            <p className="z-eyebrow">
                                {demo ? "Investigación simulada" : "Investigación"}
                            </p>
                            <h2 id="z-detail-title">Detalle del evento</h2>
                        </div>
                    </div>

                    {selectedAlert ? (
                        <div className="z-detail-content">
                            <div className="z-detail-top">
                                <Badge kind="severity" value={selectedAlert.severity}>
                                    Prioridad {severityLabels[selectedAlert.severity]?.toLowerCase()}
                                </Badge>
                                <span className="z-mono">{selectedAlert.id}</span>
                            </div>

                            <h3>{selectedAlert.title}</h3>

                            <div className="z-field z-status-editor">
                                <label htmlFor="z-detail-status">Estado de investigación</label>
                                <select
                                    id="z-detail-status"
                                    value={selectedAlert.status}
                                    onChange={updateStatus}
                                    disabled={Boolean(savingId)}
                                >
                                    {Object.entries(statusLabels).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>

                                <p>
                                    {demo
                                        ? "Cambio de prueba: se reinicia al recargar."
                                        : savingId === selectedAlert.id
                                            ? "Guardando…"
                                            : "Los cambios se guardan en este equipo."}
                                </p>
                            </div>

                            {alerts.map((alert) => (
                                <div key={alert.id} hidden={alert.id !== selectedAlert.id}>
                                    <InvestigationEditor
                                        event={alert}
                                        demo={demo}
                                        privacy={privacy}
                                        onSaved={saveInvestigationLocally}
                                    />
                                </div>
                            ))}

                            <dl className="z-facts"></dl>

                            <dl className="z-facts">
                                <Fact label="Equipo">{sensitiveValue(selectedAlert.asset)}</Fact>
                                <Fact label="Cuenta">{sensitiveValue(selectedAlert.username)}</Fact>
                                <Fact label="IP de origen">{sensitiveValue(selectedAlert.sourceIp)}</Fact>
                                <Fact label="Tipo de acceso">
                                    {displayValue(selectedAlert.logonType)}
                                </Fact>
                                <Fact label="EventID">{selectedAlert.eventId}</Fact>
                                <Fact label="RecordId">{selectedAlert.recordId}</Fact>
                                <Fact label="Fecha · Euskadi">
                                    {formatDate(selectedAlert.timestamp)}
                                </Fact>
                                <Fact label="Estado / subestado">
                                    {displayValue(selectedAlert.statusCode)}
                                    {" / "}
                                    {displayValue(selectedAlert.subStatusCode)}
                                </Fact>
                                <Fact label="Proceso">
                                    {sensitiveValue(selectedAlert.processName)}
                                </Fact>
                            </dl>

                            <section className="z-detail-section">
                                <h4>Contexto</h4>
                                <p>{selectedAlert.description}</p>
                            </section>

                            {selectedAlert.detection && (
                                <section className="z-evidence">
                                    <h4>Evidencias de detección{demo ? " · simuladas" : ""}</h4>
                                    <dl className="z-facts">
                                        <Fact label="Regla">{selectedAlert.detection.ruleId}</Fact>
                                        <Fact label="Fallos / ventana">
                                            {selectedAlert.detection.count} en{" "}
                                            {selectedAlert.detection.windowMinutes} minutos
                                        </Fact>
                                    </dl>

                                    <details>
                                        <summary>Ver eventos relacionados</summary>
                                        <ul>
                                            {(selectedAlert.detection.relatedEventIds || []).map(
                                                (id) => <li key={id}>{id}</li>
                                            )}
                                        </ul>
                                    </details>

                                    <p>
                                        Agrupados por cuenta, equipo, IP y tipo de acceso.
                                        Pueden pertenecer a una misma secuencia.
                                    </p>
                                </section>
                            )}

                            <section className="z-recommendation">
                                <h4>Siguiente paso</h4>
                                <p>{selectedAlert.recommendation}</p>
                            </section>
                        </div>
                    ) : (
                        <div className="z-empty">
                            <h3>Sin evento seleccionado</h3>
                            <p>Selecciona un identificador de la tabla para investigar.</p>
                        </div>
                    )}
                </aside>
            </section>

            <footer className="z-footnote">
                <p>
                    {demo
                        ? "Demo: ocho eventos ficticios con evidencias preparadas."
                        : "Alcance: últimos 100 eventos 4625."}
                    {" "}Regla: cinco fallos relacionados en cinco minutos.
                    Una detección requiere revisión.
                </p>
                <p>
                    {privacy
                        ? "Privacidad visual activada: cuentas, equipos, IP y procesos ocultos."
                        : demo
                            ? "Todos los nombres, equipos e IP mostrados son de ejemplo."
                            : "Privacidad visual desactivada: se muestran los valores originales."}
                </p>
            </footer>
        </main>
    );
}