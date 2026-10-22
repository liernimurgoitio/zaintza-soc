const WINDOW_MS = 5 * 60 * 1000;
const THRESHOLD = 5;

function detectEvents(events) {
  const groups = new Map();
  const detections = new Map();

  const orderedEvents = [...events].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
  );

  for (const event of orderedEvents) {
    const timestamp = Date.parse(event.timestamp);
    const username = String(event.username || "").trim();

    if (
      event.eventId !== 4625 ||
      !Number.isFinite(timestamp) ||
      !username ||
      username === "-"
    ) {
      continue;
    }

    const key = JSON.stringify([
      String(event.computer || "").toLowerCase(),
      username.toLowerCase(),
      String(event.sourceIp || "-").toLowerCase(),
      String(event.logonType || "-"),
    ]);

    const recentEvents = (groups.get(key) || []).filter(
      (previous) => timestamp - previous.time <= WINDOW_MS
    );

    recentEvents.push({
      id: event.id,
      time: timestamp,
    });

    groups.set(key, recentEvents);

    if (recentEvents.length >= THRESHOLD) {
      detections.set(event.id, {
        ruleId: "ZAINTZA-AUTH-001",
        title: "Fallos de autenticación repetidos",
        severity: "high",
        count: recentEvents.length,
        windowMinutes: 5,
        relatedEventIds: recentEvents.map((item) => item.id),
        description:
          `Se han observado ${recentEvents.length} fallos relacionados ` +
          "en una ventana de cinco minutos. Puede tratarse de una " +
          "prueba, una configuración incorrecta o un intento de acceso " +
          "no autorizado. Requiere investigación.",
      });
    }
  }

  // Mantiene el orden original de los eventos.
  return events.map((event) => ({
    ...event,
    detection: detections.get(event.id) || null,
  }));
}

module.exports = { detectEvents };