// Contrato v1: solo escenarios ficticios. No exporta cuentas, equipos ni IP.
export const FORMAT = 'zaintza-laguntza';
export const RULE_TITLES = {
  'ZAINTZA-AUTH-001': 'Revisar fallos de autenticación repetidos',
  'ZAINTZA-AUTH-002': 'Revisar posible password spraying',
};
export const MAX_FILE_BYTES = 16384;
const fail = () => { throw new Error('Archivo de intercambio no válido. Utiliza una exportación ficticia v1 de Zaintza SOC.'); };
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && !value.startsWith('0000') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function validateExchange(value) {
  if (!keys(value, ['format', 'version', 'environment', 'sourceInstanceId', 'detection'])
    || value.format !== FORMAT || value.version !== 1 || value.environment !== 'demo'
    || value.sourceInstanceId !== 'zaintza-demo-v1') fail();
  const d = value.detection;
  if (!keys(d, ['id', 'ruleId', 'firstSeen', 'lastSeen', 'eventCount', 'evidenceRefs'])
    || typeof d.ruleId !== 'string' || !Object.hasOwn(RULE_TITLES, d.ruleId) || !validDate(d.firstSeen) || !validDate(d.lastSeen)
    || Date.parse(d.lastSeen) < Date.parse(d.firstSeen) || Date.parse(d.lastSeen) - Date.parse(d.firstSeen) > 300000
    || !Number.isInteger(d.eventCount) || d.eventCount < 5 || d.eventCount > 100
    || !Array.isArray(d.evidenceRefs) || d.evidenceRefs.length !== d.eventCount
    || new Set(d.evidenceRefs).size !== d.eventCount
    || d.evidenceRefs.some(ref => typeof ref !== 'string' || !/^DEMO-4625-[0-9]{1,12}$/.test(ref))
    || typeof d.id !== 'string' || !d.evidenceRefs.some(ref => d.id === d.ruleId + ':' + ref)) fail();
  return { format: FORMAT, version: 1, environment: 'demo', sourceInstanceId: 'zaintza-demo-v1',
    detection: { id: d.id, ruleId: d.ruleId, firstSeen: d.firstSeen, lastSeen: d.lastSeen,
      eventCount: d.eventCount, evidenceRefs: [...d.evidenceRefs].sort() } };
}

export function createExchange(event, detection, events, demo) {
  if (!demo || !event?.id?.startsWith('DEMO-4625-')) throw new Error('Esta primera versión solo permite exportar detecciones ficticias.');
  if (!Array.isArray(detection?.relatedEventIds)) fail();
  const related = detection.relatedEventIds.map(id => events.find(item => item.id === id));
  if (related.some(item => !item || item.eventId !== 4625 || !item.id.startsWith('DEMO-4625-'))) fail();
  const dates = related.map(item => new Date(item.timestamp).toISOString()).sort();
  return validateExchange({ format: FORMAT, version: 1, environment: 'demo', sourceInstanceId: 'zaintza-demo-v1',
    detection: { id: detection.ruleId + ':' + event.id, ruleId: detection.ruleId,
      firstSeen: dates[0], lastSeen: dates.at(-1), eventCount: related.length,
      evidenceRefs: related.map(item => item.id) } });
}

export function exchangeDraft(value) {
  const source = validateExchange(value);
  const d = source.detection;
  return { title: 'Prueba Zaintza: ' + RULE_TITLES[d.ruleId].replace('Revisar ', ''),
    description: `Prueba con datos ficticios de Zaintza SOC. Regla ${d.ruleId}: ${d.eventCount} fallos entre ${d.firstSeen} y ${d.lastSeen}. He preparado esta incidencia para revisar el intercambio; no confirma una avería ni un ataque real.`,
    category: 'Acceso y cuentas', priority: 'medium', deviceId: '' };
}
