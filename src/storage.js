import { scene, dom } from './state.js';
import { checkReady } from './ui.js';
import { detectRooms } from './utils.js';

const LS_KEY = 'airview_v2';
const LS_KEY_V1 = 'airview_v1';
const SLOT_PREFIX = 'acdone_slot_';

export function getState() {
  return {
    v: 2,
    walls: scene.walls,
    roomTemps: scene.rooms.map(r => ({ cx: r.cx, cy: r.cy, temp: r.temp })),
    wins: scene.windows,
    furns: scene.furniture,
    doors: scene.doors,
    acUnits: scene.acUnits,
    southSide: scene.southSide,
    westSide: scene.westSide,
    insul: dom.insulation.value,
    extS: dom.extSouth.value,
    extW: dom.extWest.value,
  };
}

export function applyState(s) {
  if (s.v === 2 || s.walls) {
    // V2 format
    scene.walls = s.walls || [];
    scene.windows = s.wins || [];
    scene.furniture = s.furns || [];
    scene.doors = s.doors || [];
    scene.acUnits = s.acUnits || [];
    scene.southSide = s.southSide || null;
    scene.westSide = s.westSide || null;
    if (s.insul) dom.insulation.value = s.insul;
    if (s.extS) dom.extSouth.value = s.extS;
    if (s.extW) dom.extWest.value = s.extW;
    detectRooms();
    // Restore room temperatures
    if (s.roomTemps) {
      s.roomTemps.forEach(rt => {
        const match = scene.rooms.find(r => Math.abs(r.cx - rt.cx) < 1 && Math.abs(r.cy - rt.cy) < 1);
        if (match) match.temp = rt.temp;
      });
    }
  } else {
    // V1 migration: convert rooms to walls
    scene.walls = [];
    scene.windows = [];
    scene.doors = [];
    scene.acUnits = [];
    const rooms = s.rooms || [];
    rooms.forEach((r, ri) => {
      const x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;
      const baseWi = scene.walls.length;
      scene.walls.push({ x1, y1: y1, x2, y2: y1 }); // top
      scene.walls.push({ x1, y1: y2, x2, y2: y2 }); // bottom
      scene.walls.push({ x1, y1, x2: x1, y2 }); // left
      scene.walls.push({ x1: x2, y1, x2, y2 }); // right

      // Migrate windows
      const wallMap = { top: baseWi, bottom: baseWi + 1, left: baseWi + 2, right: baseWi + 3 };
      (s.wins || []).filter(w => w.ri === ri).forEach(w => {
        scene.windows.push({ wi: wallMap[w.wall], pos: w.pos });
      });
      (s.doors || []).filter(d => d.ri === ri).forEach(d => {
        scene.doors.push({ wi: wallMap[d.wall], pos: d.pos });
      });
      (s.acUnits || []).filter(u => u.ri === ri).forEach(u => {
        scene.acUnits.push({ wi: wallMap[u.wall], pos: u.pos, model: u.model, mode: u.mode, on: u.on });
      });
    });
    scene.furniture = s.furns || [];
    scene.southSide = s.southSide || null;
    scene.westSide = s.westSide || null;
    if (s.insul) dom.insulation.value = s.insul;
    if (s.extS) dom.extSouth.value = s.extS;
    if (s.extW) dom.extWest.value = s.extW;
    detectRooms();
    // Restore temperatures from old rooms
    rooms.forEach(r => {
      const match = scene.rooms.find(dr => Math.abs(dr.cx - (r.x + r.w / 2)) < 1 && Math.abs(dr.cy - (r.y + r.h / 2)) < 1);
      if (match) match.temp = r.temp;
    });
  }
  checkReady();
}

export function autoSave() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(getState())); } catch (e) { /* ignore */ }
}

/** Get list of saved slot names */
export function getSavedSlots() {
  const slots = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(SLOT_PREFIX)) {
      const name = key.slice(SLOT_PREFIX.length);
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const wallCount = (data.walls || []).length;
        const roomCount = (data.roomTemps || []).length;
        const acCount = (data.acUnits || []).length;
        slots.push({ name, key, wallCount, roomCount, acCount, savedAt: data._savedAt || null });
      } catch (e) {
        slots.push({ name, key, wallCount: 0, roomCount: 0, acCount: 0 });
      }
    }
  }
  // Sort by save date (newest first)
  slots.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  return slots;
}

/** Generate next default name */
function nextDefaultName() {
  const slots = getSavedSlots();
  let n = 1;
  while (slots.some(s => s.name === 'Pôdorys ' + n)) n++;
  return 'Pôdorys ' + n;
}

/** Save to named slot with prompt */
export function saveToSlot() {
  const defaultName = nextDefaultName();
  const name = prompt('Názov pôdorysu:', defaultName);
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const state = getState();
  state._savedAt = new Date().toISOString();
  try {
    localStorage.setItem(SLOT_PREFIX + trimmed, JSON.stringify(state));
    dom.statusMsg.textContent = 'Uložené: ' + trimmed + ' ✓';
  } catch (e) {
    dom.statusMsg.textContent = 'Chyba pri ukladaní';
  }
}

/** Load from named slot */
export function loadFromSlot(name) {
  const data = localStorage.getItem(SLOT_PREFIX + name);
  if (!data) { dom.statusMsg.textContent = 'Pôdorys nenájdený'; return; }
  try {
    applyState(JSON.parse(data));
    autoSave(); // also save as current autosave
    dom.statusMsg.textContent = 'Načítané: ' + name + ' ✓';
  } catch (e) {
    dom.statusMsg.textContent = 'Chyba: poškodené dáta';
  }
}

/** Delete a saved slot */
export function deleteSlot(name) {
  localStorage.removeItem(SLOT_PREFIX + name);
}

export function load() {
  let data = localStorage.getItem(LS_KEY);
  if (!data) data = localStorage.getItem(LS_KEY_V1); // try v1
  if (!data) { dom.statusMsg.textContent = 'Nič uložené'; return; }
  try {
    applyState(JSON.parse(data));
    dom.statusMsg.textContent = 'Načítané ✓';
  } catch (e) {
    dom.statusMsg.textContent = 'Chyba: poškodené dáta';
  }
}

export function exportJSON() {
  const a = document.createElement('a');
  a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(getState(), null, 2));
  a.download = 'acdone-podorys.json';
  a.click();
  dom.statusMsg.textContent = 'Exportované ✓';
}

export function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      applyState(JSON.parse(ev.target.result));
      dom.statusMsg.textContent = 'Importované ✓';
    } catch (e) {
      dom.statusMsg.textContent = 'Chyba: neplatný súbor';
    }
  };
  reader.readAsText(file);
}
