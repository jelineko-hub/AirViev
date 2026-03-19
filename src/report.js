import { canvas, scene, sim, dom, AC_MODELS } from './state.js';
import { allBoundingBox } from './utils.js';

export function generateReport() {
  // Capture current canvas as image
  const imgData = canvas.el.toDataURL('image/png');

  // Gather data
  const bb = allBoundingBox();
  const totalArea = bb ? (bb.w * bb.h).toFixed(1) : '—';
  const roomsArea = scene.rooms.reduce((s, r) => s + r.area, 0).toFixed(1);
  const elapsed = Math.floor(sim.elapsed / 60) + ':' + String(sim.elapsed % 60).padStart(2, '0');
  const targetTemp = dom.targetTemp.value;
  const simLength = dom.simLength.value;
  const insLabels = { '1': 'Žiadna', '2': 'Slabá', '3': 'Stredná', '4': 'Hrubá' };
  const insulation = insLabels[dom.insulation.value] || dom.insulation.value;
  const extSouth = dom.extSouth.value;
  const extWest = dom.extWest.value;

  // Room temperatures from simulation
  const roomRows = scene.rooms.map((r, i) => {
    // Calculate average temperature for this room from sim grid
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
  body { font-family: 'DM Sans', sans-serif; color: #222; padding: 30px 40px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 22px; color: #0a5e46; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #888; margin-bottom: 20px; }
  .section { margin-bottom: 18px; }
  .section h2 { font-size: 14px; font-weight: 600; color: #555; border-bottom: 1px solid #e0ddd5; padding-bottom: 4px; margin-bottom: 8px; }
  .sim-img { width: 100%; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 16px; }
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
  }
</style>
</head>
<body>
<h1>ACdone – Simulačný report</h1>
<p class="subtitle">Vygenerované: ${dateStr}</p>

<button class="no-print" onclick="window.print()" style="font-family:inherit;font-size:12px;padding:6px 16px;background:#0a5e46;color:#fff;border:none;border-radius:5px;cursor:pointer;margin-bottom:16px">Tlačiť / Uložiť PDF</button>

<div class="section">
  <h2>Vizualizácia simulácie</h2>
  <img class="sim-img" src="${imgData}" alt="Simulácia">
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

<div class="footer">
  ACdone – Simulácia chladenia klimatizácie &bull; ${dateStr}
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
