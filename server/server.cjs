const express = require("express");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { detectEvents } = require("./detect-events.cjs");

const app = express();
const host = "127.0.0.1";
const port = 3001;

const dataDirectory = path.join(__dirname, "data");
const statesPath = path.join(dataDirectory, "states.json");
const investigationsPath = path.join(
  dataDirectory,
  "investigations.json"
);
const scriptPath = path.join(__dirname, "read-events.ps1");

const powershellPath = path.join(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe"
);

const allowedStatuses = new Set([
  "new",
  "investigating",
  "resolved",
]);

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const eventIdPattern = /^WIN-4625-\d+$/;
const maximumNotesLength = 4000;
const maximumClosureReasonLength = 1000;

let states = {};
let investigations = {};

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const saved = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!isRecord(saved)) {
    throw new Error(
      `${path.basename(filePath)} no tiene el formato esperado.`
    );
  }

  return saved;
}

function writeJsonFile(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(value, null, 2),
    "utf8"
  );

  fs.renameSync(temporaryPath, filePath);
}

function isValidInvestigation(value) {
  return (
    isRecord(value) &&
    typeof value.notes === "string" &&
    value.notes.length <= maximumNotesLength &&
    typeof value.closureReason === "string" &&
    value.closureReason.length <= maximumClosureReasonLength &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt))
  );
}

try {
  fs.mkdirSync(dataDirectory, { recursive: true });

  states = readJsonFile(statesPath);

  for (const [id, status] of Object.entries(states)) {
    if (!eventIdPattern.test(id) || !allowedStatuses.has(status)) {
      throw new Error("El archivo contiene un estado no válido.");
    }
  }

  investigations = readJsonFile(investigationsPath);

  for (const [id, investigation] of Object.entries(investigations)) {
    if (
      !eventIdPattern.test(id) ||
      !isValidInvestigation(investigation)
    ) {
      throw new Error(
        "El archivo contiene una investigación no válida."
      );
    }
  }
} catch (error) {
  console.error("No se pudieron cargar los datos:", error.message);
  process.exit(1);
}

app.disable("x-powered-by");

app.use((req, res, next) => {
  if (req.headers.host !== `${host}:${port}`) {
    return res.status(403).json({
      error: "Dirección de acceso no permitida.",
    });
  }

  res.set("Cache-Control", "no-store");

  if (!["GET", "HEAD"].includes(req.method)) {
    if (!allowedOrigins.has(req.headers.origin)) {
      return res.status(403).json({
        error: "Origen no permitido.",
      });
    }

    if (!req.is("application/json")) {
      return res.status(415).json({
        error: "Se requiere contenido JSON.",
      });
    }
  }

  next();
});

// Admite las notas y el motivo de cierre, incluidos caracteres Unicode.
app.use(express.json({ limit: "32kb" }));

app.get("/api/events", (req, res) => {
  execFile(
    powershellPath,
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "RemoteSigned",
      "-File",
      scriptPath,
    ],
    {
      timeout: 15000,
      maxBuffer: 2 * 1024 * 1024,
      encoding: "utf8",
      windowsHide: true,
    },
    (error, stdout, stderr) => {
      if (error) {
        console.error(
          "Error al leer eventos:",
          stderr || error.message
        );

        return res.status(500).json({
          error:
            "No se pudieron leer los eventos de Windows. Revisa la terminal del servicio y sus permisos.",
        });
      }

      try {
        const events = JSON.parse(
          stdout.replace(/^\uFEFF/, "").trim()
        );

        if (!Array.isArray(events)) {
          throw new Error("La respuesta del lector no es una lista.");
        }

        res.json({
          source: "Windows Security",
          collectedAt: new Date().toISOString(),
          events: detectEvents(events).map((event) => ({
            ...event,
            status: states[event.id] || "new",
            investigation: investigations[event.id] || {
              notes: "",
              closureReason: "",
              updatedAt: null,
            },
          })),
        });
      } catch (parseError) {
        console.error(
          "Respuesta no válida:",
          parseError.message
        );

        res.status(500).json({
          error: "El lector devolvió una respuesta no válida.",
        });
      }
    }
  );
});

app.patch("/api/events/:id/status", (req, res) => {
  const { id } = req.params;
  const status = req.body?.status;

  if (!eventIdPattern.test(id) || !allowedStatuses.has(status)) {
    return res.status(400).json({
      error: "Identificador o estado no válido.",
    });
  }

  const nextStates = { ...states, [id]: status };

  try {
    writeJsonFile(statesPath, nextStates);
    states = nextStates;

    res.json({ id, status });
  } catch (error) {
    console.error("Error al guardar el estado:", error.message);

    res.status(500).json({
      error: "No se pudo guardar el estado en disco.",
    });
  }
});

app.patch("/api/events/:id/investigation", (req, res) => {
  const { id } = req.params;

  if (!eventIdPattern.test(id) || !isRecord(req.body)) {
    return res.status(400).json({
      error: "Identificador o contenido no válido.",
    });
  }

  const allowedFields = new Set(["notes", "closureReason"]);

  if (
    Object.keys(req.body).some((field) => !allowedFields.has(field))
  ) {
    return res.status(400).json({
      error: "La petición contiene campos no permitidos.",
    });
  }

  const { notes, closureReason } = req.body;

  if (
    typeof notes !== "string" ||
    typeof closureReason !== "string"
  ) {
    return res.status(400).json({
      error: "Las notas y el motivo de cierre deben ser texto.",
    });
  }

  if (
    notes.length > maximumNotesLength ||
    closureReason.length > maximumClosureReasonLength
  ) {
    return res.status(400).json({
      error:
        "Las notas admiten hasta 4000 caracteres y el motivo de cierre hasta 1000.",
    });
  }

  const investigation = {
    notes: notes.trim(),
    closureReason: closureReason.trim(),
    updatedAt: new Date().toISOString(),
  };

  const nextInvestigations = {
    ...investigations,
    [id]: investigation,
  };

  try {
    writeJsonFile(investigationsPath, nextInvestigations);
    investigations = nextInvestigations;

    res.json({ id, investigation });
  } catch (error) {
    console.error(
      "Error al guardar la investigación:",
      error.message
    );

    res.status(500).json({
      error: "No se pudo guardar la investigación en disco.",
    });
  }
});

app.use((error, req, res, next) => {
  console.error("Error en la petición:", error.message);

  const status = error.status || 500;

  res.status(status).json({
    error:
      status === 413
        ? "El contenido enviado supera el tamaño permitido."
        : "No se pudo procesar la petición.",
  });
});

const server = app.listen(port, host, () => {
  console.log(`Zaintza: http://${host}:${port}/api/events`);
  console.log("Estados: server/data/states.json");
  console.log(
    "Investigaciones: server/data/investigations.json"
  );
  console.log("Pulsa Ctrl + C para detener el servicio.");
});

server.on("error", (error) => {
  console.error("No se pudo iniciar Zaintza:", error.message);
  process.exitCode = 1;
});