// Reglas de detección de Zaintza SOC.
// Las usan el servicio local (eventos reales) y la demo (datos ficticios),
// así ambos muestran exactamente el mismo resultado.

const MINUTE = 60 * 1000;

export const RULES = {
  "ZAINTZA-AUTH-001": {
    id: "ZAINTZA-AUTH-001",
    title: "Fallos de autenticación repetidos",
    severity: "high",
    threshold: 5,
    windowMinutes: 5,
    groupedBy: "cuenta, equipo, IP y tipo de acceso",
    mitre: {
      id: "T1110.001",
      name: "Brute Force: Password Guessing",
      url: "https://attack.mitre.org/techniques/T1110/001/",
    },
  },
  "ZAINTZA-AUTH-002": {
    id: "ZAINTZA-AUTH-002",
    title: "Posible password spraying",
    severity: "high",
    threshold: 5,
    windowMinutes: 5,
    groupedBy: "IP de origen y equipo, con cuentas distintas",
    mitre: {
      id: "T1110.003",
      name: "Brute Force: Password Spraying",
      url: "https://attack.mitre.org/techniques/T1110/003/",
    },
  },
};

function normalize(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text ? text.toLowerCase() : fallback;
}

function isValidFailure(event) {
  const username = String(event.username || "").trim();

  return (
    event.eventId === 4625 &&
    Number.isFinite(Date.parse(event.timestamp)) &&
    username !== "" &&
    username !== "-"
  );
}

function sortByTime(events) {
  return [...events]
    .filter(isValidFailure)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

// ZAINTZA-AUTH-001: muchos fallos de la misma cuenta desde el mismo origen.
function detectRepeatedFailures(events) {
  const rule = RULES["ZAINTZA-AUTH-001"];
  const windowMs = rule.windowMinutes * MINUTE;
  const groups = new Map();
  const detections = new Map();

  for (const event of sortByTime(events)) {
    const time = Date.parse(event.timestamp);
    const key = JSON.stringify([
      normalize(event.computer),
      normalize(event.username),
      normalize(event.sourceIp),
      normalize(event.logonType),
    ]);

    const recent = (groups.get(key) || []).filter(
      (previous) => time - previous.time <= windowMs
    );
    recent.push({ id: event.id, time });
    groups.set(key, recent);

    if (recent.length >= rule.threshold) {
      detections.set(event.id, {
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        mitre: rule.mitre,
        count: recent.length,
        windowMinutes: rule.windowMinutes,
        groupedBy: rule.groupedBy,
        relatedEventIds: recent.map((item) => item.id),
        description:
          `Se han observado ${recent.length} fallos de la misma cuenta ` +
          "desde el mismo origen en cinco minutos. Puede tratarse de una " +
          "prueba, una contraseña guardada incorrecta o un intento de " +
          "adivinar la contraseña. Requiere investigación.",
      });
    }
  }

  return detections;
}

// ZAINTZA-AUTH-002: una misma IP prueba muchas cuentas distintas.
function detectPasswordSpraying(events) {
  const rule = RULES["ZAINTZA-AUTH-002"];
  const windowMs = rule.windowMinutes * MINUTE;
  const groups = new Map();
  const detections = new Map();

  for (const event of sortByTime(events)) {
    const time = Date.parse(event.timestamp);
    const key = JSON.stringify([
      normalize(event.computer),
      normalize(event.sourceIp),
    ]);

    const recent = (groups.get(key) || []).filter(
      (previous) => time - previous.time <= windowMs
    );
    recent.push({
      id: event.id,
      time,
      username: normalize(event.username),
    });
    groups.set(key, recent);

    const accounts = new Set(recent.map((item) => item.username));

    if (accounts.size >= rule.threshold) {
      detections.set(event.id, {
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        mitre: rule.mitre,
        count: recent.length,
        accountCount: accounts.size,
        windowMinutes: rule.windowMinutes,
        groupedBy: rule.groupedBy,
        relatedEventIds: recent.map((item) => item.id),
        description:
          `Una misma IP ha fallado con ${accounts.size} cuentas distintas ` +
          "en cinco minutos. Es el patrón típico de quien prueba pocas " +
          "contraseñas comunes contra muchas cuentas para evitar bloqueos. " +
          "Requiere investigación.",
      });
    }
  }

  return detections;
}

const detectors = [detectRepeatedFailures, detectPasswordSpraying];

export function detectEvents(events) {
  const results = detectors.map((detector) => detector(events));

  // Mantiene el orden original de los eventos.
  return events.map((event) => {
    const detections = results
      .map((result) => result.get(event.id))
      .filter(Boolean);

    return {
      ...event,
      detections,
      // Compatibilidad: la detección principal es la primera regla que se cumple.
      detection: detections[0] || null,
    };
  });
}
