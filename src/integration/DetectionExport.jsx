import { useState } from 'react';
import { createExchange, exchangeDraft } from './zaintzaExchange.js';

export default function DetectionExport({ event, detection, events, demo }) {
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  function prepare() {
    try { setSource(createExchange(event, detection, events, demo)); setError(''); }
    catch (problem) { setError(problem.message); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(source, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = 'zaintza-demo-' + source.detection.id.split(':').at(-1) + '-' + source.detection.ruleId + '.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="z-export" aria-label="Intercambio con Laguntza IT">
    <h4>Preparar una incidencia en Laguntza IT</h4>
    <p>Primera versión con datos ficticios. La descarga no crea una incidencia ni cambia esta investigación.</p>
    {demo ? <button type="button" className="z-button" onClick={prepare}>Revisar exportación ficticia</button>
      : <p>La exportación de eventos reales todavía no está habilitada.</p>}
    {error && <p role="alert">{error}</p>}
    {source && <div>
      <p><strong>Solo datos ficticios:</strong> regla, intervalo, número de fallos y referencias de eventos. No incluye cuentas, equipos, IP ni notas.</p>
      <p>{exchangeDraft(source).description}</p>
      <details><summary>Ver los datos exactos del archivo</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(source, null, 2)}</pre></details>
      <button type="button" className="z-button" onClick={download}>Descargar JSON para Laguntza IT</button>
      <p>En Laguntza, abre «Importar prueba de Zaintza» y revisa el archivo antes de confirmar. No lo envíes al formulario de aparatos.</p>
    </div>}
  </section>;
}
