// Traducción de los códigos que Windows registra en los eventos 4625.
// Referencia: documentación de Microsoft del evento 4625
// («An account failed to log on»).

const statusDescriptions = {
  "0xc000005e": "No hay servidores de inicio de sesión disponibles",
  "0xc0000064": "La cuenta no existe",
  "0xc000006a": "Contraseña incorrecta",
  "0xc000006d": "Nombre de usuario o datos de autenticación incorrectos",
  "0xc000006e": "Restricción de la cuenta",
  "0xc000006f": "Inicio de sesión fuera del horario permitido",
  "0xc0000070": "Inicio de sesión desde un equipo no permitido",
  "0xc0000071": "Contraseña caducada",
  "0xc0000072": "Cuenta deshabilitada",
  "0xc00000dc": "El servidor no está en el estado adecuado",
  "0xc0000133": "Diferencia de hora entre el equipo y el controlador de dominio",
  "0xc000015b": "Tipo de inicio de sesión no concedido a la cuenta",
  "0xc000018c": "Fallo de la relación de confianza entre dominios",
  "0xc0000192": "El servicio Netlogon no está iniciado",
  "0xc0000193": "Cuenta caducada",
  "0xc0000224": "El usuario debe cambiar la contraseña",
  "0xc0000225": "Error interno de Windows",
  "0xc0000234": "Cuenta bloqueada",
  "0xc00002ee": "Error durante el inicio de sesión",
  "0xc0000413": "La cuenta no puede autenticarse en este equipo",
};

const logonTypeDescriptions = {
  2: "Interactivo (en el propio equipo)",
  3: "Red (recurso compartido, SMB…)",
  4: "Por lotes (tarea programada)",
  5: "Servicio",
  7: "Desbloqueo de sesión",
  8: "Red con contraseña en texto claro",
  9: "Credenciales nuevas (runas /netonly)",
  10: "Escritorio remoto (RDP)",
  11: "Credenciales en caché",
};

export function describeStatus(code) {
  const normalized = String(code || "").trim().toLowerCase();

  if (!normalized || normalized === "-" || normalized === "0x0") return null;

  return statusDescriptions[normalized] || null;
}

export function describeLogonType(type) {
  const number = Number.parseInt(String(type ?? "").trim(), 10);

  return logonTypeDescriptions[number] || null;
}
