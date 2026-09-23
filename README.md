<div align="center">

# 🛡️ SAFETYBAND
### Dynamic Emergency Evacuation Path Optimizer

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-success?style=flat-square&logo=githubpages&logoColor=white)](https://stack-rishi.github.io/safetyband/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-Passing-success?style=flat-square&logo=checkmarx&logoColor=white)]()
[![Status](https://img.shields.io/badge/Status-Operational-169b62?style=flat-square)]()

**Real-time, hazard-weighted campus pathfinding engine powered by Dijkstra's Algorithm and rendered on an interactive architectural blueprint console.**

[🌐 Launch Live Blueprint Demo](https://stack-rishi.github.io/safetyband/) • [Key Features](#-key-features) • [Algorithmic Engine](#-algorithmic-engine) • [Architecture](#-architecture) • [Building Topology](#-building-topology) • [Quickstart](#-quickstart) • [API Reference](#-api-reference)

---

</div>

## 📌 Overview

During emergencies (fires, toxic smoke leaks, structural collapses, or stampedes), conventional static evacuation maps fail because they cannot adapt to rapidly shifting hazards. Evacuees panic and frequently run toward blocked passages or congested bottlenecks.

**SafetyBand** solves this by modeling multi-story facilities as **dynamic weighted graphs**. Utilizing a min-heap implementation of **Dijkstra’s Algorithm**, the system continuously assesses real-time sensor overrides and hazard states across all corridors, stairwells, and exits. 

Instead of requiring users to guess which exit is open, SafetyBand's primary mode **automatically determines and routes evacuees to the single nearest and safest exit gate in the entire facility with the lowest cumulative hazard score.**

---

## ✨ Key Features

- **★ Automated Nearest & Safest Exit Selection (`AUTO Mode`)**:
  - Evacuees do not need to guess which exit to pick. SafetyBand simultaneously computes shortest paths to every available building exit and commands the optimal egress route.
- **Dynamic Real-Time Hazard Weighting**:
  - Automatically avoids smoke, heavy crowds, narrow bottlenecks, and completely seals off fire-blocked routes ($\infty$ weight), instantly calculating an alternate detour.
- **Real-Time Exit Gate Readiness Matrix**:
  - Live side-by-side evaluation of all facility exit gates, scoring each gate's accessibility, hazard penalty, and Dijkstra distance in real time.
- **Interactive Architectural Blueprint Interface**:
  - Designed around an authentic engineering floor plan aesthetic (warm drafting paper canvas, technical linework, orthogonal corridor routing, and tactile interactive rooms).
- **Turn-by-Turn Waypoint Timeline**:
  - Generates clear, unambiguous directional directives and safety advisory memos (e.g. protocol compliance, stairwell guidance, pace instructions).
- **Fully Interactive SVG Floor Plan**:
  - Click any room to immediately set your origin; click any exit gate to target or override destination; hover over staircases and corridors for live technical readouts.

---

## 🧠 Algorithmic Engine

SafetyBand models facility navigation as a non-negative weighted graph $G = (V, E)$, solved using **Dijkstra's Greedy Shortest Path Algorithm** with a Min-Heap priority queue.

### 1. Dynamic Edge Weight Formulation

The effective traversal cost $W_{\text{eff}}(u, v)$ between node $u$ and node $v$ is determined by base passage distance and real-time safety multipliers:

$$W_{\text{eff}}(u, v) = \begin{cases} 
\infty & \text{if } H_u = \infty \lor H_v = \infty \lor H_{uv} = \infty \\
\text{base\_cost}(u, v) \times \max(H_u, H_v, H_{uv}) & \text{otherwise}
\end{cases}$$

Where hazard multipliers $H$ correspond to calibrated field safety ratings:
| Hazard State | Multiplier ($H$) | Operational Meaning |
|---|:---:|---|
| **NORMAL** | $1\times$ | Clear, unobstructed passage |
| **CROWDED** | $3\times$ | Dense occupant volume; stampede avoidance penalty |
| **NARROW** | $5\times$ | Structural constriction; bottleneck penalty |
| **HAZARDOUS** | $10\times$ | Smoke / airborne alert; high-risk deterrent |
| **BLOCKED** | $\infty$ | Active fire / impassable debris; route completely forbidden |

### 2. Time & Space Complexity

- **Time Complexity**: $\mathcal{O}((V + E) \log V)$ using Python's binary min-heap (`heapq`).
- **Space Complexity**: $\mathcal{O}(V + E)$ for adjacency mapping and shortest path predecessor tracking.
- **Evaluation Benchmark**: Evaluates all 20 nodes and 34 graph edges in $< 1.5\text{ ms}$, delivering instantaneous client updates on hazard state changes.

---

## 🏛️ System Architecture

```text
  ┌────────────────────────────────────────────────────────────────────────┐
  │                 CLIENT LAYER (Architectural Blueprint)                 │
  │  - Interactive SVG Vector Floor Plan (ViewBox 780x470)                 │
  │  - Real-Time Hazard Overrides (Corridor C, Staircase 2, Main Hall, ...)│
  │  - Live Exit Gate Readiness Matrix & Waypoint Directives Timeline      │
  │  - Engineering Typography (Inter + Technical Annotation)               │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │ HTTP REST API (JSON)
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                   BACKEND LAYER (FastAPI Web Server)                   │
  │  - GET  /api/building       -> Exports full graph topology & conditions│
  │  - POST /api/route          -> Dijkstra shortest path calculation     │
  │  - POST /api/hazards/set    -> Applies dynamic sensor/hazard updates   │
  │  - POST /api/hazards/reset  -> Restores baseline facility conditions   │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                   GRAPH & ALGORITHM CORE (Pure Python)                 │
  │  - BuildingGraph (20 Nodes, 34 Edges, Dual-Floor Academic Complex)     │
  │  - run_dijkstra()           -> Min-heap priority traversal             │
  │  - dijkstra_nearest_exit()  -> Automated multi-exit optimizer          │
  │  - dijkstra_shortest_path() -> Point-to-point constrained pathfinding  │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ Building Topology

SafetyBand models a complete dual-floor academic facility with 20 structural nodes:

### Floor 01 — Upper Level (Academic & Laboratories)
| Node ID | Room Code | Designation | Primary Connectors |
|:---:|:---:|---|---|
| `0` | `ROOM F1-204` | **Lab 2** | Corridor A, Corridor B, Corridor C |
| `1` | `ROOM F1-201` | **Computer Lab 1** | Corridor B |
| `2` | `ROOM F1-208` | **Electronics Lab** | Corridor A |
| `3` | `ROOM F1-301` | **Lecture Hall 101** | Corridor C |
| `4` | `ROOM F1-305` | **Lecture Hall 102** | Corridor C, Staircase 1 |
| `5` | `CORR-A` | **Corridor A** | Lab 2, Electronics Lab, Staircase 1, Fire Stair |
| `6` | `CORR-B` | **Corridor B** | Lab 2, Computer Lab 1, Staircase 2 |
| `7` | `CORR-C` | **Corridor C** | Lab 2, Lecture 101, Lecture 102, Staircase 1 |
| `8` | `STAIR-F1-01` | **Staircase 1 (East Wing)** | Corridor A, Corridor C, Ground Main Hall |
| `9` | `STAIR-F1-02` | **Staircase 2 (West Wing)** | Corridor B, Ground West Corridor, Exit Gate 3 Direct |
| `10` | `F_STAIR` | **Fire Escape Stair** | Corridor A, North Exit Gate 1 |

### Floor 00 — Ground Level (Concourses & Exits)
| Node ID | Room Code | Designation | Primary Connectors |
|:---:|:---:|---|---|
| `11` | `PL-01` | **Physics Lab** | Ground West Corridor |
| `12` | `CHEM-F1-110` | **Chemistry Lab** | Main Hall Concourse |
| `13` | `AUD-01` | **Seminar Hall** | Main Hall Concourse |
| `14` | `LIB-01` | **Library** | Main Hall Concourse |
| `15` | `ATRIUM-LVL0` | **Main Hall (Central Atrium)** | Staircase 1, Library, Chemistry, Seminar, Exit 3 |
| `16` | `GW-CORR` | **Ground West Corridor** | Staircase 2, Physics Lab, Exit Gate 2 |
| `17` | `EXIT-01` | **Exit Gate 1 (North Fire Stairs)** | Fire Escape Stair (Floor 1 North) |
| `18` | `EXIT-02` | **Exit Gate 2 (West Wing Ground)** | Ground West Corridor (Floor 0 West) |
| `19` | `EXIT-03` | **Exit Gate 3 (Main East Atrium)** | Main Hall Concourse (Floor 0 South-East) |

---

## 🚀 Quickstart

### Prerequisites
- Python 3.9 or higher
- Standard `pip` package manager

### 1. Clone the Repository
```bash
git clone https://github.com/stack-rishi/safetyband.git
cd safetyband
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Launch the Server
```bash
python run.py
```
Open your browser and navigate to:
```
http://127.0.0.1:8000
```

#### Optional CLI Flags
```bash
# Enable hot reloading for active frontend/backend development
python run.py --reload

# Bind to a custom port
python run.py --port 8080

# Bind to all network interfaces (for LAN drill demonstrations)
python run.py --host 0.0.0.0 --port 8000
```

---

## 🧪 Automated Testing

SafetyBand includes an end-to-end automated test suite verifying graph integrity, multi-exit Dijkstra optimization, dynamic recalculation during disaster injection, and edge-case handling:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

```text
Ran 6 tests in 0.001s

OK
```

### Test Coverage Highlights
- `test_building_graph_structure`: Asserts exact 20-node dual-floor topology and exit existence.
- `test_core_mvp_scenario_1`: Validates core corridor evacuation baseline ($Cost = 16$).
- `test_dynamic_recalculation_scenario_2`: Validates automatic detour recalculation when Staircase 2 is compromised ($12 \to 17$).
- `test_nearest_safe_exit_selection`: Asserts Dijkstra correctly evaluates all available exits and picks the minimum-cost gate.
- `test_hazard_weight_multipliers`: Confirms mathematical accuracy of $3\times$, $5\times$, and $10\times$ crowd/hazard penalties.
- `test_all_exits_blocked`: Verifies safe failure mode with `SHELTER IN PLACE` protocol when all egress points are impassable.

---

## 🔌 API Reference

### 1. `GET /api/building`
Returns the complete graph specification, active nodes, edges, base weights, and current hazard conditions.

### 2. `POST /api/route`
Computes the minimum-cost egress path with dynamic hazard overlays.

**Request Body (`auto` exit selection):**
```json
{
  "start": 0,
  "destination": "auto",
  "hazards": {
    "9": "BLOCKED"
  }
}
```

**Response Example:**
```json
{
  "route_found": true,
  "start_id": 0,
  "start_name": "Lab 2",
  "destination_id": 17,
  "destination_name": "Exit Gate 1",
  "total_cost": 13,
  "status": "SAFE ROUTE FOUND",
  "is_auto_selected": true,
  "exit_evaluations": [
    { "id": 17, "name": "Exit Gate 1", "cost": 13, "status": "OPTIMAL_SELECTED", "is_blocked": false },
    { "id": 19, "name": "Exit Gate 3", "cost": 16, "status": "AVAILABLE", "is_blocked": false },
    { "id": 18, "name": "Exit Gate 2", "cost": 999999, "status": "BLOCKED", "is_blocked": true }
  ],
  "node_count": 4,
  "path": [
    { "id": 0, "name": "Lab 2", "floor": 1, "instruction": "START at Lab 2 (Floor 1)" },
    { "id": 5, "name": "Corridor A", "floor": 1, "instruction": "Proceed along Corridor A" },
    { "id": 10, "name": "Fire Escape Stair", "floor": 1, "instruction": "Take Fire Escape Stair down" },
    { "id": 17, "name": "Exit Gate 1", "floor": 0, "instruction": "EVACUATE safely through Exit Gate 1" }
  ]
}
```

### 3. `POST /api/hazards/set`
Injects dynamic hazards on a node or corridor corridor segment.
```json
{
  "target_type": "node",
  "target_id": 9,
  "hazard": "BLOCKED"
}
```

### 4. `POST /api/hazards/reset`
Resets all building hazards back to baseline `NORMAL` status.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Developed for emergency response systems and algorithm research. Every second counts.</sub>
</div>
