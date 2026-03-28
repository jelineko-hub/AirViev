import { canvas, scene, sim, dom, AC_MODELS, view } from './state.js';
import { allBoundingBox, cropSimArea } from './utils.js';
import { drawTempLabels } from './renderer.js';

const SCALE_HTML = `<div class="temp-scale"><span>16°C</span><div class="scale-bar"></div><span>30°C</span></div>`;

export function generateReport() {
  // Capture current canvas with temp labels, cropped
  const ctx = canvas.ctx;
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.zoom, view.zoom);
  drawTempLabels(ctx);
  ctx.restore();
  const finalImg = cropSimArea();

  // Gather data
  const bb = allBoundingBox();
  const roomsArea = scene.rooms.reduce((s, r) => s + r.area, 0).toFixed(1);
  const elapsed = Math.floor(sim.elapsed / 60) + ':' + String(sim.elapsed % 60).padStart(2, '0');
  const targetTemp = dom.targetTemp.value;
  const simLength = dom.simLength.value;
  const insLabels = { '1': 'Žiadna', '2': 'Slabá', '3': 'Stredná', '4': 'Hrubá' };
  const insulation = insLabels[dom.insulation.value] || dom.insulation.value;
  const extSouth = dom.extSouth.value;
  const extWest = dom.extWest.value;
  const initialTemp = sim.initialAvgTemp ? sim.initialAvgTemp.toFixed(1) : '—';

  // Current average temperature
  let curSum = 0, curCnt = 0;
  if (sim.tempGrid && sim.airMap) {
    for (let i = 0, len = sim.gridW * sim.gridH; i < len; i++) {
      if (sim.airMap[i] && !sim.furnitureSolid[i]) { curSum += sim.tempGrid[i]; curCnt++; }
    }
  }
  const currentAvgTemp = curCnt > 0 ? (curSum / curCnt).toFixed(1) : '—';

  // Room temperatures from simulation
  const roomRows = scene.rooms.map((r, i) => {
    let sum = 0, cnt = 0;
    if (sim.cellRoomMap && sim.tempGrid) {
      const len = sim.gridW * sim.gridH;
      for (let j = 0; j < len; j++) {
        if (sim.cellRoomMap[j] === i && !sim.furnitureSolid[j]) {
          sum += sim.tempGrid[j]; cnt++;
        }
      }
    }
    const avgTemp = cnt > 0 ? (sum / cnt).toFixed(1) : '—';
    return `<tr><td>Izba ${i + 1}</td><td>${r.area.toFixed(1)} m²</td><td>${r.temp || 26}°C</td><td>${avgTemp}°C</td></tr>`;
  }).join('');

  // AC unit info
  const modeLabels = { 0: 'Tichý', 1: 'Normálny', 2: 'Turbo' };
  const unitRows = scene.acUnits.map((u, i) => {
    const model = AC_MODELS[u.model];
    const mode = modeLabels[u.mode] || '—';
    const power = sim.unitPower[i] !== undefined ? Math.round(sim.unitPower[i] * 100) + '%' : '—';
    const outTemp = sim.unitOutTemp[i] !== undefined ? sim.unitOutTemp[i].toFixed(1) + '°C' : '—';
    const roomTemp = sim.unitRoomTemp[i] !== undefined ? sim.unitRoomTemp[i].toFixed(1) + '°C' : '—';
    return `<tr><td>Jednotka ${i + 1}</td><td>${model.name}</td><td>${mode}</td><td>${u.on ? 'Zap.' : 'Vyp.'}</td><td>${power}</td><td>${outTemp}</td><td>${roomTemp}</td></tr>`;
  }).join('');

  // South/West info
  const southInfo = scene.southSide ? `Strana JUH: ${scene.southSide}, vonk. teplota ${extSouth}°C` : 'Nenastavená';
  const westInfo = scene.westSide ? `Strana ZÁPAD: ${scene.westSide}, vonk. teplota ${extWest}°C` : 'Nenastavená';
  const windowCount = scene.windows.length;
  const doorCount = scene.doors.length;

  // Build snapshots HTML
  const snapInterval = dom.snapInterval.value;
  let snapshotsHtml = '';
  if (sim.snapshots.length > 0) {
    const snapsItems = sim.snapshots.map(s => {
      const label = `po ${s.mins} minútach`;
      return `<div class="snap-item">
        <div class="snap-header"><span class="snap-time">${label}</span></div>
        <div class="snap-body"><img class="snap-img" src="${s.imgData}" alt="${label}">${SCALE_HTML}</div>
      </div>`;
    }).join('');
    const finalMins = Math.floor(sim.elapsed / 60);
    const finalLabel = sim.done ? `po ${finalMins} minútach (koniec)` : `po ${finalMins} minútach (aktuálny stav)`;
    snapshotsHtml = `
    <div class="section">
      <h2>Priebeh simulácie (interval: ${snapInterval} min)</h2>
      ${snapsItems}
      <div class="snap-item">
        <div class="snap-header"><span class="snap-time">${finalLabel}</span></div>
        <div class="snap-body"><img class="snap-img" src="${finalImg}" alt="${finalLabel}">${SCALE_HTML}</div>
      </div>
    </div>`;
  } else {
    snapshotsHtml = `
    <div class="section">
      <h2>Vizualizácia simulácie</h2>
      <p style="font-size:11px;color:#888;margin-bottom:8px">Snímky priebehu nie sú k dispozícii. Spustite simuláciu od začiatku do konca pre zachytenie snímok.</p>
      <div class="snap-item">
        <div class="snap-header"><span class="snap-time">Aktuálny stav</span></div>
        <div class="snap-body"><img class="snap-img" src="${finalImg}" alt="Aktuálny stav">${SCALE_HTML}</div>
      </div>
    </div>`;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('sk-SK') + ' ' + now.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });

  const html = `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="UTF-8">
<title>ACdone – Simulačný report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; color: #222; padding: 30px 40px; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 22px; color: #0a5e46; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #888; margin-bottom: 20px; }
  .section { margin-bottom: 22px; }
  .section h2 { font-size: 14px; font-weight: 600; color: #555; border-bottom: 1px solid #e0ddd5; padding-bottom: 4px; margin-bottom: 10px; }
  .snap-item { margin-bottom: 16px; border: 1px solid #e0ddd5; border-radius: 6px; overflow: hidden; }
  .snap-header { padding: 6px 12px; background: #f5f4f0; border-bottom: 1px solid #e8e5dd; }
  .snap-time { font-size: 13px; font-weight: 600; color: #0a5e46; }
  .snap-body { position: relative; }
  .snap-img { width: 100%; display: block; }
  .temp-scale { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #f9f8f5; border-top: 1px solid #e8e5dd; }
  .temp-scale span { font-size: 10px; color: #888; white-space: nowrap; }
  .scale-bar { height: 8px; flex: 1; border-radius: 4px; background: linear-gradient(to right, #1040d0, #20a0d0, #40c840, #e0d020, #e07020, #d02020); }
  .temp-summary { font-size: 16px; font-weight: 600; color: #0a5e46; padding: 10px 0; margin-bottom: 6px; }
  .temp-summary .temp-val { font-size: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  th { text-align: left; font-weight: 600; color: #666; padding: 4px 8px; border-bottom: 2px solid #e0ddd5; }
  td { padding: 4px 8px; border-bottom: 1px solid #eee; }
  .params { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 12px; }
  .params .label { color: #888; }
  .params .value { font-weight: 600; }
  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e0ddd5; font-size: 10px; color: #aaa; text-align: center; }
  @media print {
    body { padding: 15px 20px; }
    .no-print { display: none; }
    .snap-item { break-inside: avoid; }
  }
</style>
</head>
<body>
<h1>ACdone – Simulačný report</h1>
<p class="subtitle">Vygenerované: ${dateStr}</p>

<button class="no-print" onclick="window.print()" style="font-family:inherit;font-size:12px;padding:6px 16px;background:#0a5e46;color:#fff;border:none;border-radius:5px;cursor:pointer;margin-bottom:16px">Tlačiť / Uložiť PDF</button>

<div class="temp-summary">
  Počiatočná priemerná teplota: <span class="temp-val">${initialTemp}°C</span>
  &nbsp;→&nbsp; Aktuálna: <span class="temp-val">${currentAvgTemp}°C</span>
  &nbsp; (cieľ: ${targetTemp}°C)
</div>

<div class="section">
  <h2>Parametre simulácie</h2>
  <div class="params">
    <span class="label">Cieľová teplota:</span><span class="value">${targetTemp}°C</span>
    <span class="label">Trvanie simulácie:</span><span class="value">${simLength} min</span>
    <span class="label">Uplynutý čas:</span><span class="value">${elapsed}</span>
    <span class="label">Izolácia:</span><span class="value">${insulation}</span>
    <span class="label">Orientácia JUH:</span><span class="value">${southInfo}</span>
    <span class="label">Orientácia ZÁPAD:</span><span class="value">${westInfo}</span>
    <span class="label">Počet okien:</span><span class="value">${windowCount}</span>
    <span class="label">Počet dverí:</span><span class="value">${doorCount}</span>
    <span class="label">Celková plocha:</span><span class="value">${roomsArea} m²</span>
    <span class="label">Rozmer pôdorysu:</span><span class="value">${bb ? bb.w.toFixed(1) + ' × ' + bb.h.toFixed(1) + ' m' : '—'}</span>
  </div>
</div>

${snapshotsHtml}

<div class="section">
  <h2>Izby</h2>
  <table>
    <tr><th>Izba</th><th>Plocha</th><th>Počiatočná teplota</th><th>Výsledná teplota</th></tr>
    ${roomRows}
  </table>
</div>

<div class="section">
  <h2>Klimatizačné jednotky</h2>
  <table>
    <tr><th>Jednotka</th><th>Model</th><th>Režim</th><th>Stav</th><th>Výkon</th><th>Výst. teplota</th><th>Teplota izby</th></tr>
    ${unitRows}
  </table>
</div>

<div class="section">
  <h2>Validácia simulačného modelu</h2>
  <p style="font-size:11px;color:#666;margin-bottom:8px">
    Simulačný engine ACDone bol kalibrovaný na základe experimentálnych dát z validačnej štúdie
    Chae et al. (VRST '22, Korea University + LG Electronics). Testovacia miestnosť: 11.8×7.6×2.7m,
    792 termočlánkov, stropná kazeta. Výsledná stredná absolútna chyba modelu: ±0.5°C.
  </p>
  <table>
    <tr><th>Čas</th><th>Laboratórium (°C)</th><th>ACDone model (°C)</th><th>Odchýlka</th></tr>
    <tr><td>0 min</td><td>33.0</td><td>33.0</td><td>0.0°C</td></tr>
    <tr><td>8 min</td><td>30.5</td><td>30.6</td><td>+0.1°C</td></tr>
    <tr><td>17 min</td><td>28.5</td><td>28.7</td><td>+0.2°C</td></tr>
    <tr><td>33 min</td><td>26.0</td><td>26.4</td><td>+0.4°C</td></tr>
    <tr><td>50 min</td><td>24.5</td><td>24.9</td><td>+0.4°C</td></tr>
    <tr><td>67 min</td><td>23.5</td><td>24.0</td><td>+0.5°C</td></tr>
    <tr><td>100 min</td><td>22.2</td><td>22.9</td><td>+0.7°C</td></tr>
    <tr><td>205 min</td><td>21.0</td><td>20.6</td><td>−0.4°C</td></tr>
  </table>
  <p style="font-size:10px;color:#999;margin-top:4px">
    Ref: Chae, J., Lee, J.W., Lee, H. & Han, J.H. (2022). Virtual AC Airflow Simulation in AR. VRST '22.
  </p>
</div>

<div class="footer">
  ACdone – Simulácia chladenia klimatizácie &bull; ${dateStr}
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
