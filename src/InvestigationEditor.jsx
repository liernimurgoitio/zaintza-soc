import { useEffect, useRef, useState } from "react";

const EMPTY = {
  notes: "",
  closureReason: "",
  updatedAt: null,
};

export default function InvestigationEditor({
  event,
  demo,
  privacy,
  onSaved,
}) {
  const saved = event.investigation || EMPTY;

  const [notes, setNotes] = useState(saved.notes || "");
  const [closureReason, setClosureReason] = useState(
    saved.closureReason || ""
  );
  const [updatedAt, setUpdatedAt] = useState(saved.updatedAt || null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  const controllerRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  // Las lecturas automáticas no sustituyen un borrador sin guardar.
  useEffect(() => {
    if (dirtyRef.current || busyRef.current) return;

    setNotes(saved.notes || "");
    setClosureReason(saved.closureReason || "");
    setUpdatedAt(saved.updatedAt || null);
  }, [saved.notes, saved.closureReason, saved.updatedAt]);

  function edit(setValue, value) {
    setValue(value);
    dirtyRef.current = true;
    setDirty(true);
    setMessage(null);
  }

  async function saveInvestigation(submitEvent) {
    submitEvent.preventDefault();

    if (busyRef.current) return;

    const payload = {
      notes: notes.trim(),
      closureReason: closureReason.trim(),
    };

    busyRef.current = true;
    setSaving(true);
    setMessage(null);

    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      let investigation;

      if (demo) {
        investigation = {
          ...payload,
          updatedAt: new Date().toISOString(),
        };
      } else {
        const response = await fetch(
          `/api/events/${encodeURIComponent(event.id)}/investigation`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || `Error del servicio (${response.status}).`
          );
        }

        investigation = result.investigation;

        if (
          result.id !== event.id ||
          investigation?.notes !== payload.notes ||
          investigation?.closureReason !== payload.closureReason ||
          !Number.isFinite(Date.parse(investigation?.updatedAt))
        ) {
          throw new Error("El servicio no confirmó el guardado.");
        }
      }

      if (!mountedRef.current) return;

      onSaved(event.id, investigation);
      setNotes(investigation.notes);
      setClosureReason(investigation.closureReason);
      setUpdatedAt(investigation.updatedAt);
      dirtyRef.current = false;
      setDirty(false);

      setMessage({
        error: false,
        text: demo
          ? "Investigación guardada en la demo. Se reinicia al recargar."
          : "Investigación guardada en este equipo.",
      });
    } catch (error) {
      if (!mountedRef.current) return;

      setMessage({
        error: true,
        text:
          error.name === "AbortError"
            ? "No se pudo confirmar el guardado. El borrador se conserva; puedes volver a guardarlo."
            : `No se ha guardado. ${error.message}`,
      });
    } finally {
      window.clearTimeout(timeout);
      busyRef.current = false;

      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <section className="z-investigation">
      <h4>Notas del analista</h4>

      {privacy && (
        <p>
          Desactiva la privacidad visual para consultar o editar las notas.
        </p>
      )}

      <form onSubmit={saveInvestigation} hidden={privacy}>
        <div className="z-field">
          <label htmlFor={`notes-${event.id}`}>
            Observaciones y comprobaciones
          </label>

          <textarea
            id={`notes-${event.id}`}
            value={notes}
            maxLength={4000}
            rows={6}
            disabled={saving}
            placeholder="Describe lo observado, las comprobaciones y las conclusiones."
            onChange={(e) => edit(setNotes, e.target.value)}
          />

          <span className="z-investigation-hint">
            {notes.length}/4000 caracteres
          </span>
        </div>

        <div className="z-field">
          <label htmlFor={`closure-${event.id}`}>
            Motivo de cierre
          </label>

          <textarea
            id={`closure-${event.id}`}
            value={closureReason}
            maxLength={1000}
            rows={3}
            disabled={saving}
            placeholder="Por ejemplo: prueba controlada verificada en el Visor de eventos."
            onChange={(e) => edit(setClosureReason, e.target.value)}
          />

          <span className="z-investigation-hint">
            {closureReason.length}/1000 caracteres
          </span>
        </div>

        <p className="z-investigation-hint">
          Guardar estas notas no cambia el estado del evento.
          {demo
            ? " Utiliza únicamente información ficticia."
            : " Evita incluir contraseñas u otros secretos."}
        </p>

        <div className="z-investigation-actions">
          <button
            type="submit"
            className="z-button"
            disabled={saving || !dirty}
          >
            {saving ? "Guardando…" : "Guardar investigación"}
          </button>

          {dirty && <span>Hay cambios sin guardar</span>}
        </div>

        {updatedAt && (
          <p className="z-investigation-hint">
            Último guardado:{" "}
            {new Date(updatedAt).toLocaleString("es-ES", {
              timeZone: "Europe/Madrid",
            })}
            {" · Euskadi"}
          </p>
        )}

        {message && (
          <p
            className={`z-message ${
              message.error ? "is-error" : "is-success"
            }`}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}
      </form>
    </section>
  );
}