"""
FastAPI Web Server for SafetyBand Emergency Evacuation Optimizer.
Provides RESTful APIs and serves the real-time evacuation web interface.
"""

import math
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from safetyband.graph import BuildingGraph, NodeType, SafetyCondition, create_college_building
from safetyband.dijkstra import dijkstra_shortest_path, dijkstra_nearest_exit

app = FastAPI(
    title="SafetyBand Emergency Evacuation API",
    description="Emergency pathfinding system using Dijkstra's algorithm for campus evacuation",
    version="1.0.0",
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared graph instance
current_graph = create_college_building()


class RouteRequest(BaseModel):
    start: Any = 0
    destination: Optional[Any] = None
    hazards: Optional[Dict[str, Any]] = None


class HazardUpdateRequest(BaseModel):
    target_type: str = "node"  # "node" or "edge"
    target_id: Any
    hazard: Any  # "NORMAL", "CROWDED", "NARROW", "HAZARDOUS", "BLOCKED", or float


@app.get("/api/building")
def get_building():
    """Returns all nodes, edges, and current safety conditions."""
    return current_graph.to_dict()


@app.post("/api/route")
def calculate_route(req: RouteRequest):
    """
    Computes minimum-cost evacuation route from start to destination (or nearest safe exit).
    Applies any on-the-fly hazards requested.
    """
    # Clone graph or apply hazards
    g = create_college_building()
    # Apply baseline hazards from current_graph
    for nid, node in current_graph.nodes.items():
        g.set_node_hazard(nid, node.hazard)

    # Apply request-specific temporary hazards if any
    if req.hazards:
        for key, h_val in req.hazards.items():
            parsed_hazard = SafetyCondition.parse(h_val)
            node = g.find_node(key)
            if node:
                g.set_node_hazard(node.id, parsed_hazard)

    start_node = g.find_node(req.start)
    if not start_node:
        raise HTTPException(status_code=400, detail=f"Start location '{req.start}' not found")

    dest_node = None
    if req.destination and str(req.destination).lower() not in ("auto", "nearest", "none", ""):
        dest_node = g.find_node(req.destination)
        if not dest_node:
            raise HTTPException(status_code=400, detail=f"Destination '{req.destination}' not found")

    if dest_node:
        result = dijkstra_shortest_path(g, start_node.id, dest_node.id)
    else:
        result = dijkstra_nearest_exit(g, start_node.id)

    return result.to_dict()


@app.post("/api/hazards/set")
def update_hazard(req: HazardUpdateRequest):
    """Sets a safety hazard condition on a specific node or corridor."""
    parsed_hazard = SafetyCondition.parse(req.hazard)
    if req.target_type == "node":
        node = current_graph.find_node(req.target_id)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        current_graph.set_node_hazard(node.id, parsed_hazard)
        return {
            "status": "success",
            "message": f"Updated {node.name} to {SafetyCondition.get_name(parsed_hazard)}",
            "node": node.to_dict(),
        }
    elif req.target_type == "edge":
        # Target ID expected as "u-v" e.g. "0-6"
        parts = str(req.target_id).split("-")
        if len(parts) == 2:
            u_node = current_graph.find_node(parts[0])
            v_node = current_graph.find_node(parts[1])
            if u_node and v_node:
                current_graph.set_edge_hazard(u_node.id, v_node.id, parsed_hazard)
                return {"status": "success", "message": f"Updated corridor {u_node.name} - {v_node.name}"}
        raise HTTPException(status_code=400, detail="Invalid edge format. Expected 'nodeA-nodeB'")
    raise HTTPException(status_code=400, detail="Invalid target_type. Expected 'node' or 'edge'")


@app.post("/api/hazards/reset")
def reset_hazards():
    """Resets all hazards in the building back to NORMAL condition."""
    current_graph.reset_all_hazards()
    return {"status": "success", "message": "All hazards reset to NORMAL"}


@app.post("/api/demo/scenario1")
def demo_scenario1():
    """Core MVP demonstration: Lab 2 -> Exit Gate 3 (Cost: 16 via Corridor C)."""
    g = create_college_building()
    g.set_node_hazard(9, float("inf"))  # Staircase 2 blocked
    result = dijkstra_shortest_path(g, 0, 19)
    return {
        "title": "Scenario 1: Core MVP Route (Corridor C)",
        "expected_cost": 16,
        "result": result.to_dict(),
    }


@app.post("/api/demo/scenario2")
def demo_scenario2():
    """
    Dynamic Recalculation Demonstration:
    BEFORE: Lab 2 -> Corridor B -> Staircase 2 -> Exit 3 (Cost: 12)
    AFTER: Staircase 2 becomes BLOCKED -> Lab 2 -> Corridor A -> Staircase 1 -> Exit 3 (Cost: 17)
    """
    g = create_college_building()

    # Before
    before_res = dijkstra_shortest_path(g, 0, 19)

    # Disaster: Staircase 2 & Corridor C blocked
    g.set_node_hazard(9, float("inf"))
    g.set_node_hazard(7, float("inf"))
    after_res = dijkstra_shortest_path(g, 0, 19)

    return {
        "title": "Scenario 2: Dynamic Route Recalculation",
        "before": {
            "description": "Lab 2 -> Corridor B -> Staircase 2 -> Exit 3",
            "cost": 12,
            "result": before_res.to_dict(),
        },
        "disaster_event": "FIRE ALERT: Staircase 2 is completely blocked! Smoke in Corridor C!",
        "after": {
            "description": "Lab 2 -> Corridor A -> Staircase 1 -> Exit 3",
            "cost": 17,
            "result": after_res.to_dict(),
        },
    }


# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/favicon.ico", include_in_schema=False)
def serve_favicon():
    return FileResponse("static/favicon.ico")


@app.get("/")
def serve_index():
    return FileResponse("static/index.html")

