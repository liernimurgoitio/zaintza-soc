// Escenario completamente ficticio para la demo pública.
// No contiene datos recogidos de ningún equipo real: las IP pertenecen
// a rangos de documentación (RFC 5737).
//
// Las detecciones no se escriben a mano: se calculan con las mismas
// reglas que usa el servicio local.

import { detectEvents } from "../detection/rules.js";

const PROCESS = "C:\\Windows\\System32\\svchost.exe";

function failure({
  recordId,
  timestamp,
  computer,
  username,
  sourceIp,
  logonType = "3",
  subStatusCode = "0xc000006a",
  status = "new",
}) {
  return {
    id: `DEMO-4625-${recordId}`,
    eventId: 4625,
    recordId,
    timestamp,
    computer,
    username,
    sourceIp,
    logonType,
    processName: PROCESS,
    statusCode: "0xc000006d",
    subStatusCode,
    status,
  };
}

export function createDemoEvents() {
  const baseTime = Date.parse("2026-09-15T08:00:00Z");

  // Escenario 1 · ZAINTZA-AUTH-001: seis contraseñas incorrectas
  // para la misma cuenta, desde la misma IP, en tres minutos.
  const repeatedFailures = Array.from({ length: 6 }, (_, index) =>
    failure({
      recordId: 1001 + index,
      timestamp: new Date(baseTime + index * 30000).toISOString(),
      computer: "LAB-WINDOWS-01",
      username: "usuario.demo",
      sourceIp: "192.0.2.25",
      status: index === 5 ? "investigating" : "new",
    })
  );

  // Escenario 2 · ZAINTZA-AUTH-002: una misma IP prueba cinco cuentas
  // distintas en dos minutos (password spraying).
  const sprayedAccounts = [
    ["administrador", "0xc000006a"],
    ["backup", "0xc0000064"],
    ["contabilidad", "0xc000006a"],
    ["rrhh", "0xc0000064"],
    ["invitado", "0xc0000072"],
  ];

  const passwordSpraying = sprayedAccounts.map(([username, subStatusCode], index) =>
    failure({
      recordId: 3001 + index,
      timestamp: new Date(baseTime + 20 * 60000 + index * 25000).toISOString(),
      computer: "LAB-WINDOWS-02",
      username,
      sourceIp: "198.51.100.77",
      subStatusCode,
    })
  );

  // Eventos aislados, sin detección.
  const isolatedEvents = [
    failure({
      recordId: 2001,
      timestamp: "2026-09-15T07:30:00Z",
      computer: "LAB-WINDOWS-02",
      username: "operador.demo",
      sourceIp: "198.51.100.40",
      status: "resolved",
    }),
    failure({
      recordId: 2002,
      timestamp: "2026-09-15T07:45:00Z",
      computer: "LAB-WINDOWS-03",
      username: "soporte.demo",
      sourceIp: "203.0.113.15",
      logonType: "10",
      subStatusCode: "0xc0000064",
    }),
  ];

  return detectEvents([
    ...repeatedFailures,
    ...passwordSpraying,
    ...isolatedEvents,
  ]).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
