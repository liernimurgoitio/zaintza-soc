// Escenario completamente ficticio para la demo pública.
// No contiene datos recogidos de ningún equipo real.

export function createDemoEvents() {
  const baseTime = Date.parse("2026-09-15T08:00:00Z");

  const repeatedEvents = Array.from({ length: 6 }, (_, index) => {
    const recordId = 1001 + index;

    return {
      id: `DEMO-4625-${recordId}`,
      eventId: 4625,
      recordId,
      timestamp: new Date(baseTime + index * 30000).toISOString(),
      computer: "LAB-WINDOWS-01",
      username: "usuario.demo",
      sourceIp: "192.0.2.25",
      logonType: "3",
      processName: "C:\\Windows\\System32\\svchost.exe",
      statusCode: "0xc000006d",
      subStatusCode: "0xc000006a",
      status: index === 5 ? "investigating" : "new",
      detection: null,
    };
  });

  // El quinto y sexto eventos alcanzan el umbral del escenario.
  repeatedEvents.forEach((event, index) => {
    if (index < 4) return;

    event.detection = {
      ruleId: "ZAINTZA-AUTH-001",
      title: "Fallos de autenticación repetidos",
      severity: "high",
      count: index + 1,
      windowMinutes: 5,
      relatedEventIds: repeatedEvents
        .slice(0, index + 1)
        .map((related) => related.id),
      description:
        `Escenario ficticio: ${index + 1} fallos de autenticación ` +
        "de la misma cuenta, equipo, IP y tipo de acceso en cinco minutos. " +
        "Las evidencias están preparadas para demostrar el funcionamiento del panel.",
    };
  });

  const otherEvents = [
    {
      id: "DEMO-4625-2001",
      eventId: 4625,
      recordId: 2001,
      timestamp: "2026-09-15T07:30:00Z",
      computer: "LAB-WINDOWS-02",
      username: "operador.demo",
      sourceIp: "198.51.100.40",
      logonType: "3",
      processName: "C:\\Windows\\System32\\svchost.exe",
      statusCode: "0xc000006d",
      subStatusCode: "0xc000006a",
      status: "resolved",
      detection: null,
    },
    {
      id: "DEMO-4625-2002",
      eventId: 4625,
      recordId: 2002,
      timestamp: "2026-09-15T07:45:00Z",
      computer: "LAB-WINDOWS-03",
      username: "soporte.demo",
      sourceIp: "203.0.113.15",
      logonType: "3",
      processName: "C:\\Windows\\System32\\svchost.exe",
      statusCode: "0xc000006d",
      subStatusCode: "0xc0000064",
      status: "new",
      detection: null,
    },
  ];

  return [...repeatedEvents, ...otherEvents].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
  );
}