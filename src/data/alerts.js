// Datos ficticios para la demostración de Zaintza SOC.
// Las direcciones IP pertenecen a rangos privados o de documentación.

export const initialAlerts = [
  {
    id: "ZAI-001",
    title: "Intentos repetidos de acceso SSH",
    severity: "critical",
    status: "new",
    timestamp: "2026-10-20T14:32:00Z",
    sourceIp: "203.0.113.24",
    destinationIp: "10.0.0.12",
    asset: "linux-server-01",
    source: "Suricata",
    category: "Autenticación",
    description:
      "Se han registrado 48 intentos fallidos de autenticación SSH desde una misma dirección IP durante cinco minutos.",
    recommendation:
      "Revisar los registros de autenticación y comprobar si hubo accesos correctos relacionados antes de decidir una medida de contención.",
  },
  {
    id: "ZAI-002",
    title: "Posible escaneo de puertos",
    severity: "high",
    status: "investigating",
    timestamp: "2026-10-20T14:18:00Z",
    sourceIp: "198.51.100.42",
    destinationIp: "10.0.0.15",
    asset: "web-server-01",
    source: "Suricata",
    category: "Reconocimiento",
    description:
      "Se han observado conexiones a 120 puertos diferentes del servidor en un intervalo de un minuto.",
    recommendation:
      "Comprobar si el origen corresponde a un escáner autorizado y revisar los servicios que respondieron.",
  },
  {
    id: "ZAI-003",
    title: "Ejecución de un comando privilegiado",
    severity: "medium",
    status: "new",
    timestamp: "2026-10-20T13:56:00Z",
    sourceIp: "10.0.0.23",
    destinationIp: "10.0.0.12",
    asset: "linux-server-01",
    source: "Linux",
    category: "Privilegios",
    description:
      "Una cuenta de usuario ha ejecutado un comando mediante sudo fuera de su horario habitual.",
    recommendation:
      "Verificar el comando, la identidad del usuario y si existe una tarea de mantenimiento que justifique la actividad.",
  },
  {
    id: "ZAI-004",
    title: "Conexión saliente bloqueada",
    severity: "low",
    status: "resolved",
    timestamp: "2026-10-20T13:40:00Z",
    sourceIp: "10.0.0.31",
    destinationIp: "192.0.2.80",
    asset: "workstation-03",
    source: "UFW",
    category: "Red",
    description:
      "El cortafuegos ha bloqueado una conexión saliente que no estaba permitida por la política configurada.",
    recommendation:
      "Identificar el proceso que inició la conexión y comprobar si el bloqueo corresponde al comportamiento esperado.",
  },
];

export const severityLabels = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const statusLabels = {
  new: "Nueva",
  investigating: "En investigación",
  resolved: "Resuelta",
};