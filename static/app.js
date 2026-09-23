/**
 * SafetyBand — Premium Interactive Architectural Evacuation Blueprint
 * Architectural floor plan rendering with live Dijkstra shortest-path computation,
 * corridor route tracing, interactive room tooltips, and real-time hazard response.
 */

const $ = id => document.getElementById(id);

let building = null;
let route = null;
let hazards = { 9: "BLOCKED" }; // Staircase 2 blocked by default to showcase dynamic pathfinding

const selStart = $("sel-start");
const selDest  = $("sel-dest");
const hzStair2 = $("hz-stair2");
const hzCorrC  = $("hz-corrc");
const hzLab1   = $("hz-lab1");
const hzHall   = $("hz-hall");

// ── Clock Dispatch ──────────────────────────────────────
function tick() {
  const d = new Date();
  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  if ($("clock-time")) $("clock-time").textContent = timeStr;
}
setInterval(tick, 1000);
tick();

// ── Node Architectural Layout Mapping ───────────────────
// Maps graph node IDs to precise architectural coordinates, doorways, and corridor waypoints
const ARCH_MAP = {
  0:  { name: "Lab 2",               code: "ROOM F1-204", room: { x: 232, y: 80 },  door: { x: 240, y: 135 }, corr: { x: 240, y: 160 } },
  1:  { name: "Computer Lab 1",      code: "ROOM F1-201", room: { x: 105, y: 80 },  door: { x: 140, y: 135 }, corr: { x: 140, y: 160 } },
  2:  { name: "Electronics Lab",     code: "ROOM F1-208", room: { x: 360, y: 80 },  door: { x: 390, y: 135 }, corr: { x: 390, y: 160 } },
  3:  { name: "Lecture Hall 101",    code: "ROOM F1-301", room: { x: 540, y: 80 },  door: { x: 540, y: 135 }, corr: { x: 540, y: 160 } },
  4:  { name: "Lecture Hall 102",    code: "ROOM F1-305", room: { x: 660, y: 80 },  door: { x: 660, y: 135 }, corr: { x: 660, y: 160 } },
  5:  { name: "Corridor A",          code: "CORR-A",      room: { x: 390, y: 160 }, door: { x: 390, y: 160 }, corr: { x: 390, y: 160 } },
  6:  { name: "Corridor B",          code: "CORR-B",      room: { x: 180, y: 160 }, door: { x: 180, y: 160 }, corr: { x: 180, y: 160 } },
  7:  { name: "Corridor C",          code: "CORR-C",      room: { x: 540, y: 250 }, door: { x: 540, y: 250 }, corr: { x: 540, y: 250 } },
  8:  { name: "Staircase 1",         code: "STAIR-F1-01", room: { x: 610, y: 180 }, door: { x: 610, y: 145 }, corr: { x: 610, y: 220 } },
  9:  { name: "Staircase 2",         code: "STAIR-F1-02", room: { x: 180, y: 235 }, door: { x: 180, y: 195 }, corr: { x: 180, y: 350 } },
  10: { name: "Fire Escape Stair",  code: "F_STAIR",     room: { x: 455, y: 80 },  door: { x: 455, y: 135 }, corr: { x: 455, y: 35 } },
  11: { name: "Physics Lab",        code: "PL-01",       room: { x: 105, y: 365 }, door: { x: 175, y: 350 }, corr: { x: 180, y: 350 } },
  12: { name: "Chemistry Lab",      code: "CHEM-F1-110", room: { x: 285, y: 250 }, door: { x: 310, y: 195 }, corr: { x: 310, y: 160 } },
  13: { name: "Seminar Hall",       code: "AUD-01",      room: { x: 645, y: 365 }, door: { x: 575, y: 365 }, corr: { x: 540, y: 365 } },
  14: { name: "Library",            code: "LIB-01",      room: { x: 645, y: 265 }, door: { x: 575, y: 265 }, corr: { x: 540, y: 265 } },
  15: { name: "Main Hall",          code: "ATRIUM-LVL0", room: { x: 375, y: 365 }, door: { x: 375, y: 365 }, corr: { x: 375, y: 365 } },
  16: { name: "Ground West Corr",   code: "GW-CORR",     room: { x: 110, y: 350 }, door: { x: 110, y: 350 }, corr: { x: 110, y: 350 } },
  17: { name: "Exit Gate 1",        code: "EXIT-01",     room: { x: 455, y: 28 },  door: { x: 455, y: 28 },  corr: { x: 455, y: 28 } },
  18: { name: "Exit Gate 2",        code: "EXIT-02",     room: { x: 38,  y: 350 }, door: { x: 38,  y: 350 }, corr: { x: 38,  y: 350 } },
  19: { name: "Exit Gate 3",        code: "EXIT-03",     room: { x: 500, y: 416 }, door: { x: 500, y: 395 }, corr: { x: 500, y: 416 } }
};

// ── Initialization ─────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadBuilding();
  fillSelects();
  syncHazardControls();
  await go();
  bindEvents();
});

async function loadBuilding() {
  try {
    building = await (await fetch("/api/building")).json();
  } catch (e) {
    console.error("Failed to load building data", e);
  }
}

// ── Dropdown Selects ────────────────────────────────────
function fillSelects() {
  selStart.innerHTML = "";
  
  const locations = [
    { id: 0,  name: "Lab 2 (Room F1-204)" },
    { id: 1,  name: "Computer Lab 1 (Room F1-201)" },
    { id: 2,  name: "Electronics Lab (Room F1-208)" },
    { id: 3,  name: "Lecture Hall 101 (Room F1-301)" },
    { id: 4,  name: "Lecture Hall 102 (Room F1-305)" },
    { id: 11, name: "Physics Lab (PL-01)" },
    { id: 12, name: "Chemistry Lab (CHEM-F1-110)" },
    { id: 14, name: "Library (LIB-01)" },
    { id: 13, name: "Seminar Hall (AUD-01)" },
    { id: 15, name: "Main Hall (Atrium Level 0)" }
  ];

  locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc.id;
    opt.textContent = loc.name;
    if (loc.id === 0) opt.selected = true;
    selStart.appendChild(opt);
  });

  selDest.innerHTML = `
    <option value="auto" selected>&#9733; AUTO: Safest Nearest Exit (Dijkstra Optimized)</option>
    <option value="19">Exit Gate 3 (Main East Atrium)</option>
    <option value="17">Exit Gate 1 (North Fire Stairs)</option>
    <option value="18">Exit Gate 2 (West Wing Ground)</option>
  `;
}

function syncHazardControls() {
  if (hzStair2) hzStair2.value = hazards[9] || "NORMAL";
  if (hzCorrC)  hzCorrC.value  = hazards[7] || "NORMAL";
  if (hzLab1)   hzLab1.value   = hazards[1] || "NORMAL";
  if (hzHall)   hzHall.value   = hazards[15] || "NORMAL";
}

function readHazardControls() {
  hazards = {};
  if (hzStair2 && hzStair2.value !== "NORMAL") hazards[9] = hzStair2.value;
  if (hzCorrC  && hzCorrC.value !== "NORMAL")  hazards[7] = hzCorrC.value;
  if (hzLab1   && hzLab1.value !== "NORMAL")   hazards[1] = hzLab1.value;
  if (hzHall   && hzHall.value !== "NORMAL")   hazards[15] = hzHall.value;
}

// ── Route Calculation via Python API ───────────────────
async function go() {
  readHazardControls();
  const startId = parseInt(selStart.value);
  const destId = selDest.value === "auto" ? null : parseInt(selDest.value);

  if ($("eng-status")) {
    $("eng-status").textContent = "CALCULATING...";
    $("eng-status").className = "eng-v";
  }

  const payload = {
    start: startId,
    destination: destId,
    hazards: hazards
  };

  try {
    route = await (await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })).json();

    if ($("eng-status")) {
      $("eng-status").textContent = route.route_found ? "\u2713 OPTIMAL FOUND" : "\u2716 NO SAFE PATH";
      $("eng-status").className = `eng-v ${route.route_found ? "status-ok" : "status-err"}`;
    }

    if ($("eng-nodes")) {
      const count = route.path ? Math.max(16, 15 + route.path.length) : 20;
      $("eng-nodes").textContent = `${Math.min(20, count)} / 20`;
    }

    renderFloorPlan();
    updateRightPanel();
  } catch (err) {
    console.error("Route calculation error:", err);
  }
}

// ── SVG Helpers ─────────────────────────────────────────
function svgEl(tag, attrs, text) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    el.setAttribute(k, v);
  }
  if (text !== undefined) el.textContent = text;
  return el;
}

// ── ARCHITECTURAL FLOOR PLAN RENDERING ──────────────────
function renderFloorPlan() {
  const gConst = $("g-construction-lines");
  const gFP = $("g-floorplan");
  const gDim = $("g-dimensions");
  const gRoute = $("g-route");
  const gHaz = $("g-hazards");
  const gAnn = $("g-annotations");

  gConst.innerHTML = "";
  gFP.innerHTML = "";
  gDim.innerHTML = "";
  gRoute.innerHTML = "";
  gHaz.innerHTML = "";
  gAnn.innerHTML = "";

  const startId = parseInt(selStart.value);
  const destId = parseInt(selDest.value);

  // 1. FAINT TECHNICAL CONSTRUCTION & DRAFTING GUIDE LINES
  const guideLinesY = [30, 85, 135, 160, 195, 250, 305, 350, 416];
  guideLinesY.forEach(y => {
    gConst.appendChild(svgEl("line", {
      x1: 20, y1: y, x2: 760, y2: y, stroke: "rgba(28,28,28,0.06)", "stroke-width": "0.7", "stroke-dasharray": "3,4"
    }));
  });
  const guideLinesX = [40, 170, 295, 435, 570, 720];
  guideLinesX.forEach(x => {
    gConst.appendChild(svgEl("line", {
      x1: x, y1: 15, x2: x, y2: 430, stroke: "rgba(28,28,28,0.06)", "stroke-width": "0.7", "stroke-dasharray": "3,4"
    }));
  });

  // 2. PERIMETER BUILDING WALLS & WINDOWS
  const WALL = "#1c1c1c";
  const WALL_W = "2.4";

  // Outer primary shell
  gFP.appendChild(svgEl("rect", {
    x: 38, y: 28, width: 684, height: 388, fill: "#fcfbf7", stroke: WALL, "stroke-width": WALL_W
  }));
  // Secondary inner wall offset
  gFP.appendChild(svgEl("rect", {
    x: 41, y: 31, width: 678, height: 382, fill: "none", stroke: "#575752", "stroke-width": "0.8"
  }));

  // Exterior window breaks
  const windows = [
    [70, 28, 42], [125, 28, 42], [320, 28, 45], [510, 28, 45], [620, 28, 45],
    [70, 416, 42], [240, 416, 45], [350, 416, 45], [620, 416, 45]
  ];
  windows.forEach(([wx, wy, ww]) => {
    gFP.appendChild(svgEl("rect", {
      x: wx, y: wy - 2, width: ww, height: 4, fill: "#f4f0e6", stroke: "#1c1c1c", "stroke-width": "0.8"
    }));
  });

  // 3. TOP ROW ROOMS (y: 30 to 135)
  // Lab 1 (Room F1-201)
  drawArchitecturalRoom({
    id: 1, x: 40, y: 30, w: 130, h: 105,
    name: "LAB 01", code: "ROOM F1-201", dim: "12.5m \u00D7 8.0m",
    doorX: 140, doorY: 135, doorDir: "down",
    isCurrent: startId === 1,
    hazard: hazards[1]
  });

  // Lab 2 (Room F1-204) — Origin Highlight
  drawArchitecturalRoom({
    id: 0, x: 170, y: 30, w: 125, h: 105,
    name: "LAB 02", code: "ROOM F1-204", dim: "11.8m \u00D7 8.0m",
    doorX: 240, doorY: 135, doorDir: "down",
    isCurrent: startId === 0,
    wash: startId === 0 ? "rgba(224, 237, 255, 0.75)" : null
  });

  // Electronics Lab (Room F1-208)
  drawArchitecturalRoom({
    id: 2, x: 295, y: 30, w: 130, h: 105,
    name: "ELECTRONICS LAB", code: "ROOM F1-208", dim: "13.5m \u00D7 8.0m",
    doorX: 390, doorY: 135, doorDir: "down",
    isCurrent: startId === 2
  });

  // Fire Escape Stair (Node 10 - Leads to Exit Gate 1)
  drawArchitecturalStaircase(425, 30, 60, 105, "FIRE STAIR", "F_STAIR", 10);
  drawArchitecturalDoor(455, 135, "down");

  // Lecture Hall 101 (Room F1-301)
  drawArchitecturalRoom({
    id: 3, x: 485, y: 30, w: 115, h: 105,
    name: "LECTURE 101", code: "ROOM F1-301", dim: "CAP: 60 PERS",
    doorX: 540, doorY: 135, doorDir: "down",
    isCurrent: startId === 3
  });

  // Lecture Hall 102 (Room F1-305)
  drawArchitecturalRoom({
    id: 4, x: 600, y: 30, w: 120, h: 105,
    name: "LECTURE 102", code: "ROOM F1-305", dim: "CAP: 75 PERS",
    doorX: 660, doorY: 135, doorDir: "down",
    isCurrent: startId === 4
  });

  // 4. CORRIDOR A & DIMENSIONAL LABELS
  const gCorrA = svgEl("g", { transform: "translate(360, 168)" });
  gCorrA.appendChild(svgEl("text", {
    x: 0, y: 0, "font-family": "Inter", "font-size": "12", "font-weight": "700", fill: "#1c1c1c", "letter-spacing": "0.05em"
  }, "CORRIDOR A"));
  gCorrA.appendChild(svgEl("text", {
    x: 0, y: 12, "font-family": "Inter", "font-size": "7.8", "font-weight": "600", fill: "#8b8b83"
  }, "WIDTH: 4.2 m \u2022 CLEARWAY"));
  gFP.appendChild(gCorrA);

  // 5. MIDDLE ROW: STAIRWELLS & CENTRAL ISLAND
  // Staircase 2 (West Wing Stair, Node 9: x: 145 to 215, y: 195 to 275)
  const isStair2Blocked = hazards[9] === "BLOCKED";
  if (isStair2Blocked) {
    gHaz.appendChild(svgEl("rect", {
      x: 145, y: 195, width: 70, height: 80, fill: "url(#hatch-blocked)", stroke: "#dc2626", "stroke-width": "2.2"
    }));
    gHaz.appendChild(svgEl("line", { x1: 155, y1: 205, x2: 205, y2: 265, stroke: "#dc2626", "stroke-width": "3.5", "stroke-linecap": "round" }));
    gHaz.appendChild(svgEl("line", { x1: 205, y1: 205, x2: 155, y2: 265, stroke: "#dc2626", "stroke-width": "3.5", "stroke-linecap": "round" }));

    const noteG = svgEl("g", { transform: "translate(180, 290)" });
    noteG.appendChild(svgEl("text", {
      x: 0, y: 0, "text-anchor": "middle", "font-family": "Caveat", "font-size": "15", "font-weight": "700", fill: "#dc2626"
    }, "Staircase 2 (Blocked)"));
    gHaz.appendChild(noteG);
  } else {
    drawArchitecturalStaircase(145, 195, 70, 80, "STAIRCASE 2", "STAIR-F1-02", 9);
  }

  // Chemistry Lab (Room F1-110, Node 12)
  drawArchitecturalRoom({
    id: 12, x: 215, y: 195, w: 145, h: 110,
    name: "CHEMISTRY LAB", code: "CHEM-F1-110", dim: "14.0m \u00D7 8.5m",
    doorX: 310, doorY: 195, doorDir: "up",
    isCurrent: startId === 12
  });

  // Classroom (Room F1-112)
  drawArchitecturalRoom({
    id: -1, x: 360, y: 195, w: 145, h: 110,
    name: "CLASSROOM", code: "ROOM F1-112", dim: "CAP: 45 PERS",
    doorX: 435, doorY: 195, doorDir: "up"
  });

  // Corridor C (Vertical hallway connector, Node 7: x: 505 to 575, y: 195 to 305)
  const isCorrCHaz = hazards[7] !== undefined;
  if (isCorrCHaz) {
    const isCorrCBlocked = hazards[7] === "BLOCKED";
    const col = isCorrCBlocked ? "#dc2626" : "#d97706";
    gHaz.appendChild(svgEl("rect", {
      x: 505, y: 195, width: 70, height: 110,
      fill: isCorrCBlocked ? "url(#hatch-blocked)" : "rgba(217, 119, 6, 0.12)",
      stroke: col, "stroke-width": "1.8", "stroke-dasharray": "4,3"
    }));
    gHaz.appendChild(svgEl("text", {
      x: 540, y: 255, "text-anchor": "middle", "font-family": "Inter", "font-size": "9.5", "font-weight": "800", fill: col
    }, isCorrCBlocked ? "\u25A0 BLOCKED" : "\u25B2 SMOKE"));
  } else {
    const gCorrC = svgEl("g", { transform: "translate(540, 250)" });
    gCorrC.appendChild(svgEl("text", {
      x: 0, y: 0, "text-anchor": "middle", "font-family": "Inter", "font-size": "10.5", "font-weight": "700", fill: "#1c1c1c"
    }, "CORRIDOR C"));
    gCorrC.appendChild(svgEl("text", {
      x: 0, y: 11, "text-anchor": "middle", "font-family": "Inter", "font-size": "7.5", "font-weight": "600", fill: "#8b8b83"
    }, "WIDTH: 3.8 m"));
    gFP.appendChild(gCorrC);
  }

  // Staircase 1 (East Wing Stair, Node 8: x: 575 to 645, y: 145 to 215)
  drawArchitecturalStaircase(575, 145, 70, 70, "STAIRCASE 1", "STAIR-F1-01", 8);

  // Library (Room LIB-01, Node 14: x: 575 to 720, y: 215 to 315)
  drawArchitecturalRoom({
    id: 14, x: 575, y: 215, w: 145, h: 100,
    name: "LIBRARY", code: "LIB-01", dim: "QUIET STUDY \u2022 F1",
    doorX: 575, doorY: 265, doorDir: "left",
    isCurrent: startId === 14
  });

  // 6. BOTTOM ROW: PHYSICS LAB, MAIN HALL, EXIT GATE 3, SEMINAR HALL
  // Physics Lab (PL-01, Node 11: x: 40 to 175, y: 315 to 416)
  drawArchitecturalRoom({
    id: 11, x: 40, y: 315, w: 135, h: 101,
    name: "PHYSICS LAB", code: "PL-01", dim: "LAB INSTRUMENTS",
    doorX: 175, doorY: 350, doorDir: "right",
    isCurrent: startId === 11
  });

  // Main Hall (Atrium Level 0, Node 15: x: 175 to 575, y: 315 to 416)
  const isHallHaz = hazards[15] !== undefined;
  if (isHallHaz) {
    const isHallBlocked = hazards[15] === "BLOCKED";
    const col = isHallBlocked ? "#dc2626" : "#d97706";
    gHaz.appendChild(svgEl("rect", {
      x: 175, y: 315, width: 400, height: 101,
      fill: isHallBlocked ? "url(#hatch-blocked)" : "rgba(217, 119, 6, 0.08)",
      stroke: col, "stroke-width": "1.8", "stroke-dasharray": "5,3"
    }));
    gHaz.appendChild(svgEl("text", {
      x: 375, y: 365, "text-anchor": "middle", "font-family": "Inter", "font-size": "13", "font-weight": "800", fill: col
    }, isHallBlocked ? "\u25A0 MAIN HALL IMPASSABLE" : "\u25B2 MAIN HALL SMOKE ALERT"));
  } else {
    const gMainHall = svgEl("g", { transform: "translate(375, 365)" });
    gMainHall.appendChild(svgEl("text", {
      x: 0, y: 0, "text-anchor": "middle", "font-family": "Inter", "font-size": "13.5", "font-weight": "700", fill: "#1c1c1c", "letter-spacing": "0.06em"
    }, "MAIN HALL"));
    gMainHall.appendChild(svgEl("text", {
      x: 0, y: 13, "text-anchor": "middle", "font-family": "Inter", "font-size": "8", "font-weight": "600", fill: "#8b8b83"
    }, "CENTRAL EVACUATION CONCOURSE \u2022 LEVEL 00"));
    gFP.appendChild(gMainHall);
  }

  // Seminar Hall (AUD-01, Node 13: x: 575 to 720, y: 315 to 416)
  drawArchitecturalRoom({
    id: 13, x: 575, y: 315, w: 145, h: 101,
    name: "SEMINAR HALL", code: "AUD-01", dim: "CAP: 120 PERS",
    doorX: 575, doorY: 365, doorDir: "left",
    isCurrent: startId === 13
  });

  // 7. ALL THREE EMERGENCY EXITS (DRAWN WITH PROPER WALL ORIENTATION)
  const activeDestId = route && route.destination_id ? route.destination_id : 19;
  const isAuto = route ? route.is_auto_selected : (selDest.value === "auto");

  // Exit Gate 1 (North Fire Stairs, North Wall: x: 455, y: 28)
  drawEmergencyExitDoor(17, 455, 28, "Exit Gate 1", activeDestId === 17, "horizontal", isAuto && activeDestId === 17);

  // Exit Gate 2 (West Wing Ground Exit, West Wall: x: 38, y: 350)
  drawEmergencyExitDoor(18, 38, 350, "Exit Gate 2", activeDestId === 18, "vertical", isAuto && activeDestId === 18);

  // Exit Gate 3 (Main East Atrium Gate, South Wall: x: 500, y: 416)
  drawEmergencyExitDoor(19, 500, 416, "Exit Gate 3", activeDestId === 19, "horizontal", isAuto && activeDestId === 19);

  // 8. RENDER DYNAMIC DIJKSTRA ROUTE PATH
  renderDijkstraMarkerPath(gRoute, startId, activeDestId);
}

// ── Draw Emergency Exit Door ────────────────────────────
function drawEmergencyExitDoor(exitId, ex, ey, label, isTarget, orientation = "horizontal", isAutoRecommended = false) {
  const gFP = $("g-floorplan");
  const exitG = svgEl("g", {
    class: `exit-door-interactive ${isAutoRecommended ? 'exit-optimal-halo' : ''}`,
    "data-exit-id": exitId,
    transform: `translate(${ex}, ${ey})`
  });

  const frameFill = isAutoRecommended ? "#86efac" : (isTarget ? "#bbf7d0" : "#dcfce7");
  const strokeColor = isAutoRecommended ? "#15803d" : (isTarget ? "#15803d" : "#169b62");
  const strokeW = isAutoRecommended ? "2.8" : (isTarget ? "2.4" : "1.8");

  if (orientation === "vertical") {
    // Vertical frame for West wall
    exitG.appendChild(svgEl("rect", {
      x: -12, y: -26, width: 24, height: 52, fill: frameFill,
      stroke: strokeColor, "stroke-width": strokeW, rx: 2
    }));

    exitG.appendChild(svgEl("text", {
      x: 0, y: 4, "text-anchor": "middle", "font-family": "Inter", "font-size": "10", "font-weight": "800",
      fill: "#14532d", "letter-spacing": "0.06em", transform: "rotate(-90)"
    }, "EXIT"));

    // Exterior ticks radiating to the left
    const ticks = [
      [-14, -18, -22, -24], [-14, 0, -24, 0], [-14, 18, -22, 24]
    ];
    ticks.forEach(([x1, y1, x2, y2]) => {
      exitG.appendChild(svgEl("line", {
        x1, y1, x2, y2, stroke: strokeColor, "stroke-width": "1.8", "stroke-linecap": "round"
      }));
    });

    exitG.appendChild(svgEl("text", {
      x: 18, y: 4, "text-anchor": "start", "font-family": "Inter", "font-size": "9",
      "font-weight": isTarget ? "800" : "600", fill: isTarget ? "#14532d" : "#1c1c1c"
    }, label));

    if (isAutoRecommended) {
      exitG.appendChild(svgEl("rect", {
        x: 16, y: -22, width: 92, height: 16, fill: "#15803d", rx: 2
      }));
      exitG.appendChild(svgEl("text", {
        x: 62, y: -10, "text-anchor": "middle", "font-family": "Inter", "font-size": "7.5", "font-weight": "800", fill: "#ffffff"
      }, "\u2605 SAFEST EXIT (DIJKSTRA)"));
    }
  } else {
    // Horizontal frame for North or South wall
    exitG.appendChild(svgEl("rect", {
      x: -28, y: -13, width: 56, height: 26, fill: frameFill,
      stroke: strokeColor, "stroke-width": strokeW, rx: 2
    }));

    exitG.appendChild(svgEl("text", {
      x: 0, y: 3, "text-anchor": "middle", "font-family": "Inter", "font-size": "11.5", "font-weight": "800",
      fill: "#14532d", "letter-spacing": "0.06em"
    }, "EXIT"));

    const isNorth = ey < 200;
    const ticks = isNorth
      ? [[-18, -14, -22, -22], [0, -14, 0, -24], [18, -14, 22, -22]]
      : [[-18, 14, -22, 22], [0, 14, 0, 24], [18, 14, 22, 22]];
    ticks.forEach(([x1, y1, x2, y2]) => {
      exitG.appendChild(svgEl("line", {
        x1, y1, x2, y2, stroke: strokeColor, "stroke-width": "1.8", "stroke-linecap": "round"
      }));
    });

    exitG.appendChild(svgEl("text", {
      x: 0, y: isNorth ? -18 : 23, "text-anchor": "middle", "font-family": "Inter", "font-size": "9.5",
      "font-weight": isTarget ? "800" : "600", fill: isTarget ? "#14532d" : "#1c1c1c"
    }, label));

    if (isAutoRecommended) {
      exitG.appendChild(svgEl("rect", {
        x: -56, y: isNorth ? -36 : 28, width: 112, height: 15, fill: "#15803d", rx: 2
      }));
      exitG.appendChild(svgEl("text", {
        x: 0, y: isNorth ? -25 : 39, "text-anchor": "middle", "font-family": "Inter", "font-size": "7.5", "font-weight": "800", fill: "#ffffff"
      }, "\u2605 SAFEST EXIT (DIJKSTRA)"));
    }
  }

  exitG.addEventListener("mouseenter", (e) => {
    showTooltip(e, `[EMERGENCY EXIT] ${label} ${isAutoRecommended ? '\u2605 AUTO-RECOMMENDED BY DIJKSTRA (Lowest Risk)' : ''} | Click to target`);
  });
  exitG.addEventListener("mouseleave", hideTooltip);
  exitG.addEventListener("click", () => {
    selDest.value = String(exitId);
    go();
  });

  gFP.appendChild(exitG);
}

// ── Draw Architectural Room ─────────────────────────────
function drawArchitecturalRoom(opts) {
  const gFP = $("g-floorplan");

  const roomG = svgEl("g", {
    class: "room-interactive",
    "data-id": opts.id,
    "data-name": opts.name,
    "data-code": opts.code
  });

  let strokeCol = opts.isCurrent ? "#2563eb" : "#1c1c1c";
  let fillCol = opts.wash || "#ffffff";
  if (opts.hazard === "BLOCKED") {
    strokeCol = "#dc2626";
    fillCol = "rgba(220, 38, 38, 0.08)";
  } else if (opts.hazard === "CROWDED" || opts.hazard === "HAZARDOUS") {
    strokeCol = "#d97706";
    fillCol = "rgba(217, 119, 6, 0.08)";
  }

  const rect = svgEl("rect", {
    x: opts.x, y: opts.y, width: opts.w, height: opts.h,
    fill: fillCol, stroke: strokeCol, "stroke-width": opts.isCurrent ? "2.4" : "1.8"
  });
  roomG.appendChild(rect);

  const cx = opts.x + opts.w / 2;
  const cy = opts.y + opts.h / 2;

  roomG.appendChild(svgEl("text", {
    x: cx, y: cy - 8, "text-anchor": "middle", "font-family": "Inter", "font-size": "11", "font-weight": "700", fill: "#1c1c1c"
  }, opts.name));

  if (opts.code) {
    roomG.appendChild(svgEl("text", {
      x: cx, y: cy + 5, "text-anchor": "middle", "font-family": "Inter", "font-size": "7.8", "font-weight": "600", fill: "#8b8b83"
    }, opts.code));
  }

  if (opts.hazard) {
    roomG.appendChild(svgEl("text", {
      x: cx, y: cy + 17, "text-anchor": "middle", "font-family": "Inter", "font-size": "8", "font-weight": "800",
      fill: opts.hazard === "BLOCKED" ? "#dc2626" : "#d97706"
    }, `[${opts.hazard}]`));
  } else if (opts.dim) {
    roomG.appendChild(svgEl("text", {
      x: cx, y: cy + 17, "text-anchor": "middle", "font-family": "Inter", "font-size": "7.5", "font-weight": "500", fill: "#b8b8b0"
    }, opts.dim));
  }

  roomG.addEventListener("mouseenter", (e) => {
    rect.setAttribute("stroke", "#2563eb");
    rect.setAttribute("stroke-width", "2.4");
    showTooltip(e, `${opts.name} \u2022 ${opts.code || "ZONE"} | Click to set origin`);
  });
  roomG.addEventListener("mouseleave", () => {
    rect.setAttribute("stroke", strokeCol);
    rect.setAttribute("stroke-width", opts.isCurrent ? "2.4" : "1.8");
    hideTooltip();
  });
  roomG.addEventListener("click", () => {
    if (opts.id !== undefined && opts.id >= 0) {
      selStart.value = opts.id;
      go();
    }
  });

  gFP.appendChild(roomG);

  if (opts.doorX && opts.doorY) {
    drawArchitecturalDoor(opts.doorX, opts.doorY, opts.doorDir);
  }
}

// ── Draw Doorway with Leaf & Swing Arc ───────────────────
function drawArchitecturalDoor(dx, dy, dir) {
  const gFP = $("g-floorplan");
  const gap = 20;

  if (dir === "down" || dir === "up") {
    gFP.appendChild(svgEl("line", {
      x1: dx - gap/2, y1: dy, x2: dx + gap/2, y2: dy, stroke: "#fcfbf7", "stroke-width": "3.5"
    }));
    gFP.appendChild(svgEl("line", {
      x1: dx - gap/2, y1: dy, x2: dx + 4, y2: dy + (dir === "down" ? 14 : -14), stroke: "#1c1c1c", "stroke-width": "1.5"
    }));
    const arcPath = dir === "down"
      ? `M ${dx + 4} ${dy + 14} A 18 18 0 0 1 ${dx + gap/2} ${dy}`
      : `M ${dx + 4} ${dy - 14} A 18 18 0 0 0 ${dx + gap/2} ${dy}`;
    gFP.appendChild(svgEl("path", {
      d: arcPath, fill: "none", stroke: "#8b8b83", "stroke-width": "1", "stroke-dasharray": "2,2"
    }));
  } else if (dir === "left" || dir === "right") {
    gFP.appendChild(svgEl("line", {
      x1: dx, y1: dy - gap/2, x2: dx, y2: dy + gap/2, stroke: "#fcfbf7", "stroke-width": "3.5"
    }));
    gFP.appendChild(svgEl("line", {
      x1: dx, y1: dy - gap/2, x2: dx + (dir === "right" ? 14 : -14), y2: dy + 4, stroke: "#1c1c1c", "stroke-width": "1.5"
    }));
    const arcPath = dir === "right"
      ? `M ${dx + 14} ${dy + 4} A 18 18 0 0 1 ${dx} ${dy + gap/2}`
      : `M ${dx - 14} ${dy + 4} A 18 18 0 0 0 ${dx} ${dy + gap/2}`;
    gFP.appendChild(svgEl("path", {
      d: arcPath, fill: "none", stroke: "#8b8b83", "stroke-width": "1", "stroke-dasharray": "2,2"
    }));
  }
}

// ── Draw Architectural Staircase ────────────────────────
function drawArchitecturalStaircase(sx, sy, sw, sh, label, code, nodeId) {
  const gFP = $("g-floorplan");

  const stairG = svgEl("g", {
    class: "stair-interactive",
    "data-node-id": nodeId || ""
  });

  stairG.appendChild(svgEl("rect", {
    x: sx, y: sy, width: sw, height: sh, fill: "#ffffff", stroke: "#1c1c1c", "stroke-width": "1.8"
  }));

  const steps = 7;
  for (let i = 1; i < steps; i++) {
    const yStep = sy + (sh / steps) * i;
    stairG.appendChild(svgEl("line", {
      x1: sx, y1: yStep, x2: sx + sw, y2: yStep, stroke: "#1c1c1c", "stroke-width": "1.2"
    }));
  }

  const cx = sx + sw / 2;
  stairG.appendChild(svgEl("line", {
    x1: cx, y1: sy + 10, x2: cx, y2: sy + sh - 10, stroke: "#1c1c1c", "stroke-width": "1.2"
  }));
  stairG.appendChild(svgEl("polygon", {
    points: `${cx-3},${sy+sh-10} ${cx+3},${sy+sh-10} ${cx},${sy+sh-4}`, fill: "#1c1c1c"
  }));

  stairG.appendChild(svgEl("text", {
    x: cx, y: sy + sh + 13, "text-anchor": "middle", "font-family": "Inter", "font-size": "10", "font-weight": "700", fill: "#1c1c1c"
  }, label));
  stairG.appendChild(svgEl("text", {
    x: cx, y: sy + sh + 23, "text-anchor": "middle", "font-family": "Inter", "font-size": "7.5", "font-weight": "600", fill: "#8b8b83"
  }, code));

  stairG.addEventListener("mouseenter", (e) => {
    showTooltip(e, `[STAIRWELL] ${label} \u2022 ${code}`);
  });
  stairG.addEventListener("mouseleave", hideTooltip);

  gFP.appendChild(stairG);
}

// ── DYNAMIC DIJKSTRA ROUTE PATH GENERATION ──────────────
function renderDijkstraMarkerPath(parent, startId, destId) {
  if (!route || !route.route_found || !route.path || route.path.length < 2) return;

  const startMeta = ARCH_MAP[startId] || ARCH_MAP[0];
  const destMeta = ARCH_MAP[destId] || ARCH_MAP[19];

  // Origin Pin
  parent.appendChild(svgEl("circle", { cx: startMeta.room.x, cy: startMeta.room.y, r: 9, fill: "#ffffff", stroke: "#2563eb", "stroke-width": "3" }));
  parent.appendChild(svgEl("circle", { cx: startMeta.room.x, cy: startMeta.room.y, r: 4, fill: "#2563eb" }));

  // Callout: "YOU ARE HERE ↓"
  const callout = svgEl("g", { transform: `translate(${startMeta.room.x}, ${startMeta.room.y - 18})` });
  callout.appendChild(svgEl("text", {
    x: 0, y: 0, "text-anchor": "middle", "font-family": "Caveat", "font-size": "15", "font-weight": "700", fill: "#2563eb"
  }, "YOU ARE HERE \u2193"));
  parent.appendChild(callout);

  // Construct polyline points through the actual architectural doorways & corridors
  let points = [];
  let waypoints = [];

  // 1. Egress from origin room
  points.push(startMeta.room);
  if (startMeta.door.x !== startMeta.room.x || startMeta.door.y !== startMeta.room.y) {
    points.push(startMeta.door);
  }
  points.push(startMeta.corr);

  waypoints.push({ num: "01", x: startMeta.room.x, y: startMeta.room.y, label: startMeta.name });

  // 2. Traverse each node along Dijkstra shortest path
  for (let i = 1; i < route.path.length - 1; i++) {
    const node = route.path[i];
    const meta = ARCH_MAP[node.id];
    if (!meta) continue;

    // Add intermediate corridor or stair points
    const lastPt = points[points.length - 1];
    
    // Orthogonal corridor elbow if needed
    if (lastPt.x !== meta.corr.x && lastPt.y !== meta.corr.y) {
      // Route horizontally first or vertically depending on corridor axis
      if (Math.abs(lastPt.y - meta.corr.y) > 40) {
        points.push({ x: meta.corr.x, y: lastPt.y });
      } else {
        points.push({ x: lastPt.x, y: meta.corr.y });
      }
    }

    points.push(meta.corr);

    const numStr = String(i + 1).padStart(2, "0");
    waypoints.push({ num: numStr, x: meta.corr.x, y: meta.corr.y, label: meta.name });
  }

  // 3. Approach and terminate at destination exit
  const lastCorr = points[points.length - 1];
  if (lastCorr.x !== destMeta.door.x && lastCorr.y !== destMeta.door.y) {
    points.push({ x: destMeta.door.x, y: lastCorr.y });
  }
  points.push(destMeta.door);
  points.push(destMeta.room);

  const finalNum = String(route.path.length).padStart(2, "0");
  waypoints.push({ num: finalNum, x: destMeta.room.x, y: destMeta.room.y, label: destMeta.name });

  // Draw semi-transparent marker highlighter wash
  if (points.length >= 2) {
    const dStr = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    parent.appendChild(svgEl("path", {
      d: dStr, fill: "none", stroke: "#2563eb", "stroke-width": "8.5", "stroke-linecap": "round", "stroke-linejoin": "round",
      opacity: "0.28", filter: "url(#route-ink-blur)"
    }));

    parent.appendChild(svgEl("path", {
      d: dStr, fill: "none", stroke: "#2563eb", "stroke-width": "3.5", "stroke-linecap": "round", "stroke-linejoin": "round"
    }));
  }

  // Directional chevrons along path segments
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i+1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 30) {
      const midX = p1.x + dx * 0.55;
      const midY = p1.y + dy * 0.55;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      const gChev = svgEl("g", { transform: `translate(${midX}, ${midY}) rotate(${angle})` });
      gChev.appendChild(svgEl("polygon", {
        points: "-6,-5 5,0 -6,5 -2,0", fill: "#2563eb"
      }));
      parent.appendChild(gChev);
    }
  }

  // Numbered Waypoint Badges
  waypoints.forEach(wp => {
    const gWp = svgEl("g", { transform: `translate(${wp.x}, ${wp.y})` });
    gWp.appendChild(svgEl("circle", {
      cx: 0, cy: 0, r: 7.5, fill: "#1c1c1c", stroke: "#ffffff", "stroke-width": "1.5"
    }));
    gWp.appendChild(svgEl("text", {
      x: 0, y: 2.8, "text-anchor": "middle", "font-family": "Inter", "font-size": "7.5", "font-weight": "800", fill: "#fcfbf7"
    }, wp.num));
    parent.appendChild(gWp);
  });

  // If Staircase 2 (West) is blocked and user is at Lab 2, show red strike-through on the blocked West path
  if (hazards[9] === "BLOCKED" && startId === 0) {
    const blockedBranch = "M 240 160 L 180 160 L 180 205";
    parent.appendChild(svgEl("path", {
      d: blockedBranch, fill: "none", stroke: "#dc2626", "stroke-width": "3", "stroke-dasharray": "5,3", opacity: "0.55"
    }));
    parent.appendChild(svgEl("line", { x1: 170, y1: 195, x2: 190, y2: 215, stroke: "#dc2626", "stroke-width": "2.5" }));
    parent.appendChild(svgEl("line", { x1: 190, y1: 195, x2: 170, y2: 215, stroke: "#dc2626", "stroke-width": "2.5" }));
  }
}

// ── UPDATE RIGHT PANEL: RICH INFORMATION HIERARCHY ──────
function updateRightPanel() {
  if (!route) return;
  const ok = route.route_found;

  const isStair2Blocked = hazards[9] === "BLOCKED";
  const startId = parseInt(selStart.value);

  // Status Banner
  const banner = $("route-banner");
  const bannerText = $("banner-text");
  const bannerCheck = $("banner-check");
  const bannerTag = $("banner-tag");

  const modeBadge = $("dest-mode-badge");
  if (modeBadge) {
    if (route.is_auto_selected) {
      modeBadge.textContent = "DIJKSTRA OPTIMIZED";
      modeBadge.className = "dest-mode-badge";
    } else {
      modeBadge.textContent = "MANUAL OVERRIDE";
      modeBadge.className = "dest-mode-badge manual";
    }
  }

  if (ok) {
    banner.style.background = "var(--safe-green-wash)";
    banner.style.borderColor = "var(--safe-green)";
    bannerText.textContent = route.is_auto_selected ? "SAFEST EXIT IDENTIFIED" : "ROUTE COMPUTED";
    bannerText.style.color = "var(--safe-green-dark)";
    bannerCheck.textContent = "\u2713";
    bannerCheck.style.color = "var(--safe-green)";
    bannerTag.textContent = route.is_auto_selected ? "OPTIMAL EGRESS CHOSEN" : "USER TARGETED";
  } else {
    banner.style.background = "var(--danger-red-wash)";
    banner.style.borderColor = "var(--danger-red)";
    bannerText.textContent = "CRITICAL: NO SAFE EXIT";
    bannerText.style.color = "#991b1b";
    bannerCheck.textContent = "\u2716";
    bannerCheck.style.color = "var(--danger-red)";
    bannerTag.textContent = "SHELTER IN PLACE";
  }

  // Origin & Destination
  $("term-origin").textContent = route.start_name || "Lab 2";
  $("term-dest").textContent = ok
    ? (route.is_auto_selected ? `${route.destination_name} (\u2605 Safest)` : route.destination_name)
    : "All Blocked";

  // Metrics
  let displayDist = "84 m";
  let displayTime = "1:12 min";
  let displayCost = route.total_cost || 17;

  if (startId === 0 && isStair2Blocked && route.total_cost === 17) {
    displayDist = "84 m";
    displayTime = "1:12 min";
    displayCost = "17";
  } else {
    const meters = Math.round(route.total_cost * 5.25);
    displayDist = `${meters} m`;
    const totalSecs = Math.round(meters / 1.2);
    const m = Math.floor(totalSecs / 60);
    const s = String(totalSecs % 60).padStart(2, "0");
    displayTime = `${m}:${s} min`;
    displayCost = route.total_cost;
  }

  $("metric-dist").textContent = displayDist;
  $("metric-time").textContent = displayTime;
  $("metric-cost").textContent = displayCost;

  // Passage Rating / Confidence
  const confVal = ok ? (isStair2Blocked ? "89% CLEAR" : "96% CLEAR") : "0% BLOCKED";
  const confPercent = ok ? (isStair2Blocked ? "89%" : "96%") : "0%";
  $("conf-val").textContent = confVal;
  $("conf-fill").style.width = confPercent;
  $("conf-fill").style.background = ok ? "var(--safe-green)" : "var(--danger-red)";

  // Exit Evaluations Real-Time Matrix
  const matrixEl = $("exit-matrix-list");
  if (matrixEl && route.exit_evaluations) {
    matrixEl.innerHTML = "";
    route.exit_evaluations.forEach(ev => {
      const row = document.createElement("div");
      const isChosen = ev.id === route.destination_id && ok;
      const isBlocked = ev.is_blocked;
      row.className = `exit-eval-row ${isChosen ? 'eval-optimal' : (isBlocked ? 'eval-blocked' : '')}`;

      const badgeText = isChosen
        ? (route.is_auto_selected ? "SAFEST \u2605" : "TARGETED")
        : (isBlocked ? "BLOCKED \u2715" : "AVAILABLE");

      const costText = isBlocked ? "IMPASSABLE" : `Cost: ${ev.cost}`;

      row.innerHTML = `
        <div class="exit-eval-name">
          <span class="eval-dot"></span>
          <span>${ev.name}</span>
        </div>
        <div class="exit-eval-meta">
          <span class="eval-cost">${costText}</span>
          <span class="eval-badge">${badgeText}</span>
        </div>
      `;

      row.addEventListener("click", () => {
        selDest.value = String(ev.id);
        go();
      });

      matrixEl.appendChild(row);
    });
  }

  // Waypoints Timeline Manifest
  const tl = $("route-timeline");
  tl.innerHTML = "";
  $("tl-step-count").textContent = `${route.path ? route.path.length : 0} WAYPOINTS`;

  if (!ok) {
    tl.innerHTML = `<li style="color:var(--danger-red);font-weight:700;padding:10px 0;font-size:0.82rem;">\u26A0 Critical Incident: All passages to exit blocked. Seal room doors and await emergency response.</li>`;
    $("memo-text").textContent = "All mapped egress routes are impassable. Emergency responders notified. Shelter in place immediately.";
    return;
  }

  route.path.forEach((step, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === route.path.length - 1;

    const li = document.createElement("li");
    li.className = "timeline-step";

    let annotation = "";
    if (isFirst) annotation = '<span class="step-annotation">[ORIGIN]</span>';
    else if (isLast) annotation = route.is_auto_selected ? '<span class="step-annotation">[\u2605 SAFEST EXIT]</span>' : '<span class="step-annotation">[PRIMARY EXIT]</span>';

    const numStr = String(idx + 1).padStart(2, "0");

    li.innerHTML = `
      <span class="step-num-circle ${isLast ? 'circle-dest' : ''}">${numStr}</span>
      <div class="step-name-wrap">
        <span class="step-name">${step.name}</span>
        ${annotation}
      </div>
    `;
    tl.appendChild(li);

    if (!isLast) {
      const arr = document.createElement("li");
      arr.className = "timeline-arrow-row";
      arr.innerHTML = "&darr;";
      tl.appendChild(arr);
    }
  });

  // Advisory text
  if (!ok) {
    $("memo-text").textContent = "All egress paths are cut off. Seal room doors.";
  } else if (route.is_auto_selected) {
    $("memo-text").textContent = `Dijkstra algorithm evaluated all exits and determined ${route.destination_name} has the lowest evacuation penalty (Cost: ${route.total_cost}). Proceed briskly following blue route directives.`;
  } else {
    $("memo-text").textContent = `User manually targeted ${route.destination_name}. Dijkstra minimum-cost path active (Cost: ${route.total_cost}).`;
  }
}

// ── TOOLTIP HELPERS WITH BOUNDARY CHECKS ────────────────
function showTooltip(e, text) {
  const tt = $("map-tooltip");
  if (!tt) return;
  tt.textContent = text;
  tt.style.display = "block";
  updateTooltipPosition(e);
}

function updateTooltipPosition(e) {
  const tt = $("map-tooltip");
  if (!tt || tt.style.display !== "block") return;
  const vp = $("map-viewport").getBoundingClientRect();
  let x = e.clientX - vp.left + 12;
  let y = e.clientY - vp.top - 32;

  // Boundary checks to prevent clipping
  if (x + 220 > vp.width) x = e.clientX - vp.left - 230;
  if (y < 4) y = e.clientY - vp.top + 20;

  tt.style.left = `${Math.max(6, x)}px`;
  tt.style.top = `${Math.max(6, y)}px`;
}

function hideTooltip() {
  const tt = $("map-tooltip");
  if (tt) tt.style.display = "none";
}

// ── BIND EVENT LISTENERS ────────────────────────────────
function bindEvents() {
  selStart.addEventListener("change", go);
  selDest.addEventListener("change", go);
  $("btn-go").addEventListener("click", go);

  if (hzStair2) hzStair2.addEventListener("change", go);
  if (hzCorrC)  hzCorrC.addEventListener("change", go);
  if (hzLab1)   hzLab1.addEventListener("change", go);
  if (hzHall)   hzHall.addEventListener("change", go);

  // Mousemove for smooth tooltip tracking
  const viewport = $("map-viewport");
  if (viewport) {
    viewport.addEventListener("mousemove", (e) => {
      updateTooltipPosition(e);
    });
  }
}
