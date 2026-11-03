import { test } from "node:test";
import assert from "node:assert/strict";
import { describeLogonType, describeStatus } from "../src/detection/windowsCodes.js";

test("traduce los códigos de error más habituales del evento 4625", () => {
  assert.equal(describeStatus("0xC000006A"), "Contraseña incorrecta");
  assert.equal(describeStatus("0xc0000064"), "La cuenta no existe");
  assert.equal(describeStatus("0xc0000234"), "Cuenta bloqueada");
  assert.equal(describeStatus(" 0xc0000072 "), "Cuenta deshabilitada");
});

test("devuelve null para códigos vacíos o desconocidos", () => {
  assert.equal(describeStatus(""), null);
  assert.equal(describeStatus("-"), null);
  assert.equal(describeStatus("0x0"), null);
  assert.equal(describeStatus(undefined), null);
  assert.equal(describeStatus("0xdeadbeef"), null);
});

test("traduce los tipos de inicio de sesión", () => {
  assert.equal(describeLogonType("3"), "Red (recurso compartido, SMB…)");
  assert.equal(describeLogonType(10), "Escritorio remoto (RDP)");
  assert.equal(describeLogonType("2"), "Interactivo (en el propio equipo)");
  assert.equal(describeLogonType("99"), null);
  assert.equal(describeLogonType("-"), null);
});
