import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEvents, RULES } from "../src/detection/rules.js";
import { createDemoEvents } from "../src/data/demoEvents.js";

const START = Date.parse("2026-10-01T10:00:00Z");
let nextRecordId = 1;

function failure({
  secondsAfterStart = 0,
  username = "ana",
  sourceIp = "192.0.2.10",
  computer = "PC-01",
  logonType = "3",
  eventId = 4625,
} = {}) {
  const recordId = nextRecordId++;

  return {
    id: `WIN-4625-${recordId}`,
    eventId,
    recordId,
    timestamp: new Date(START + secondsAfterStart * 1000).toISOString(),
    computer,
    username,
    sourceIp,
    logonType,
  };
}

function rulesOf(event) {
  return event.detections.map((detection) => detection.ruleId);
}

test("AUTH-001: cinco fallos de la misma cuenta en cinco minutos generan detección", () => {
  const events = Array.from({ length: 5 }, (_, index) =>
    failure({ secondsAfterStart: index * 60 })
  );

  const result = detectEvents(events);

  assert.deepEqual(rulesOf(result[3]), []);
  assert.deepEqual(rulesOf(result[4]), ["ZAINTZA-AUTH-001"]);
  assert.equal(result[4].detection.count, 5);
  assert.equal(result[4].detection.relatedEventIds.length, 5);
  assert.equal(result[4].detection.mitre.id, "T1110.001");
});

test("AUTH-001: cuatro fallos no alcanzan el umbral", () => {
  const events = Array.from({ length: 4 }, (_, index) =>
    failure({ secondsAfterStart: index * 10 })
  );

  const result = detectEvents(events);

  assert.ok(result.every((event) => event.detection === null));
});

test("AUTH-001: los fallos fuera de la ventana de cinco minutos no cuentan", () => {
  const events = Array.from({ length: 5 }, (_, index) =>
    failure({ secondsAfterStart: index * 90 })
  );

  const result = detectEvents(events);

  // 0, 90, 180, 270 y 360 s: el primero queda fuera de la ventana del último.
  assert.ok(result.every((event) => !rulesOf(event).includes("ZAINTZA-AUTH-001")));
});

test("AUTH-001: distinta IP o tipo de acceso no se agrupan", () => {
  const events = [
    ...Array.from({ length: 3 }, (_, index) =>
      failure({ secondsAfterStart: index, sourceIp: "192.0.2.10" })
    ),
    ...Array.from({ length: 2 }, (_, index) =>
      failure({ secondsAfterStart: 10 + index, sourceIp: "192.0.2.99" })
    ),
    failure({ secondsAfterStart: 20, logonType: "10" }),
  ];

  const result = detectEvents(events);

  assert.ok(result.every((event) => event.detection === null));
});

test("AUTH-002: una IP que prueba cinco cuentas distintas se detecta como password spraying", () => {
  const accounts = ["admin", "backup", "rrhh", "contabilidad", "invitado"];
  const events = accounts.map((username, index) =>
    failure({ username, secondsAfterStart: index * 20, sourceIp: "198.51.100.7" })
  );

  const result = detectEvents(events);
  const last = result.at(-1);

  assert.deepEqual(rulesOf(last), ["ZAINTZA-AUTH-002"]);
  assert.equal(last.detection.accountCount, 5);
  assert.equal(last.detection.mitre.id, "T1110.003");
  assert.ok(result.slice(0, 4).every((event) => event.detection === null));
});

test("AUTH-002: muchos fallos de una sola cuenta no son password spraying", () => {
  const events = Array.from({ length: 8 }, (_, index) =>
    failure({ secondsAfterStart: index * 5, username: "ana" })
  );

  const result = detectEvents(events);

  assert.ok(result.every((event) => !rulesOf(event).includes("ZAINTZA-AUTH-002")));
});

test("AUTH-002: la misma cuenta repetida cuenta una sola vez", () => {
  const usernames = ["ana", "ANA", "ana", "luis", "marta", "pedro"];
  const events = usernames.map((username, index) =>
    failure({ username, secondsAfterStart: index * 10 })
  );

  const result = detectEvents(events);

  // Solo hay cuatro cuentas distintas: ana, luis, marta y pedro.
  assert.ok(result.every((event) => !rulesOf(event).includes("ZAINTZA-AUTH-002")));
});

test("un mismo evento puede cumplir las dos reglas", () => {
  const events = [
    ...["luis", "marta", "pedro", "sara"].map((username, index) =>
      failure({ username, secondsAfterStart: index })
    ),
    ...Array.from({ length: 5 }, (_, index) =>
      failure({ username: "ana", secondsAfterStart: 10 + index })
    ),
  ];

  const result = detectEvents(events);

  assert.deepEqual(rulesOf(result.at(-1)), ["ZAINTZA-AUTH-001", "ZAINTZA-AUTH-002"]);
  assert.equal(result.at(-1).detection.ruleId, "ZAINTZA-AUTH-001");
});

test("se ignoran eventos sin cuenta, con otro EventID o con fecha no válida", () => {
  const events = [
    ...Array.from({ length: 3 }, (_, index) => failure({ secondsAfterStart: index })),
    failure({ secondsAfterStart: 5, username: "-" }),
    failure({ secondsAfterStart: 6, eventId: 4624 }),
    { ...failure(), timestamp: "fecha no válida" },
  ];

  const result = detectEvents(events);

  assert.ok(result.every((event) => event.detection === null));
});

test("el resultado mantiene el orden original de los eventos", () => {
  const events = [
    failure({ secondsAfterStart: 30 }),
    failure({ secondsAfterStart: 10 }),
    failure({ secondsAfterStart: 20 }),
  ];

  const result = detectEvents(events);

  assert.deepEqual(
    result.map((event) => event.id),
    events.map((event) => event.id)
  );
});

test("todas las reglas declaran su técnica de MITRE ATT&CK", () => {
  for (const rule of Object.values(RULES)) {
    assert.match(rule.mitre.id, /^T\d{4}(\.\d{3})?$/);
    assert.match(rule.mitre.url, /^https:\/\/attack\.mitre\.org\/techniques\//);
  }
});

test("la demo muestra un ejemplo de cada regla", () => {
  const detected = new Set(
    createDemoEvents().flatMap((event) => rulesOf(event))
  );

  assert.deepEqual([...detected].sort(), Object.keys(RULES).sort());
});
