import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoEvents } from '../src/data/demoEvents.js';
import { createExchange, validateExchange } from '../src/integration/zaintzaExchange.js';

test('la exportación reproduce el ejemplo común sin datos de cuentas o red', async () => {
  const events = createDemoEvents();
  const event = events.find(e => e.detection?.ruleId === 'ZAINTZA-AUTH-001');
  const original = structuredClone(events);
  const source = createExchange(event, event.detection, events, true);
  const fixture = JSON.parse(await readFile(new URL('../examples/zaintza-demo-v1.json', import.meta.url), 'utf8'));
  assert.deepEqual(source, fixture);
  assert.deepEqual(events, original);
  const text = JSON.stringify(source);
  for (const value of [event.username, event.computer, event.sourceIp, 'processName', 'notes']) assert.ok(!text.includes(value));
});

test('las dos reglas tienen exportación y no se permite el modo real', () => {
  const events = createDemoEvents();
  for (const ruleId of ['ZAINTZA-AUTH-001', 'ZAINTZA-AUTH-002']) {
    const event = events.find(e => e.detections?.some(d => d.ruleId === ruleId));
    const detection = event.detections.find(d => d.ruleId === ruleId);
    assert.equal(createExchange(event, detection, events, true).detection.ruleId, ruleId);
    assert.throws(() => createExchange(event, detection, events, false), /solo permite exportar detecciones ficticias/);
  }
});

test('rechaza versiones desconocidas, datos reales, campos adicionales y evidencias incompletas', () => {
  const events = createDemoEvents(); const event = events.find(e => e.detection);
  const source = createExchange(event, event.detection, events, true);
  for (const changes of [{ version: 2 }, { environment: 'real' }, { username: 'no-permitido' }, { detection: {} }]) {
    assert.throws(() => validateExchange({ ...source, ...changes }), /no válido/);
  }
  assert.throws(() => createExchange(event, event.detection, [event], true), /no válido/);
  assert.throws(() => validateExchange({ ...source, detection: { ...source.detection, eventCount: 101 } }), /no válido/);
});
