"""
Dijkstra's Algorithm Implementation for SafetyBand.
Implements the greedy shortest path algorithm using a Min-Heap Priority Queue.
Calculates optimal evacuation routes considering dynamic safety conditions.
"""

from dataclasses import dataclass, field
import heapq
import math
from typing import Dict, List, Optional, Tuple, Any

from safetyband.graph import BuildingGraph, Node, NodeType, SafetyCondition


@dataclass
class PathResult:
    start_id: int
    start_name: str
    destination_id: int
    destination_name: str
    total_cost: float
    path_nodes: List[Node]
    step_costs: List[int]
    instructions: List[str]
    route_found: bool
    status: str
    exit_evaluations: List[Dict[str, Any]] = field(default_factory=list)
    is_auto_selected: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "route_found": self.route_found,
            "start_id": self.start_id,
            "start_name": self.start_name,
            "destination_id": self.destination_id,
            "destination_name": self.destination_name,
            "total_cost": self.total_cost if not math.isinf(self.total_cost) else 999999,
            "status": self.status,
            "is_auto_selected": self.is_auto_selected,
            "exit_evaluations": self.exit_evaluations,
            "node_count": len(self.path_nodes),
            "path": [
                {
                    "id": n.id,
                    "name": n.name,
                    "code": n.code,
                    "type": n.node_type.value,
                    "floor": n.floor,
                    "x": n.x,
                    "y": n.y,
                    "step_cost": self.step_costs[i] if i < len(self.step_costs) else 0,
                    "instruction": self.instructions[i] if i < len(self.instructions) else "",
                }
                for i, n in enumerate(self.path_nodes)
            ],
        }


def run_dijkstra(graph: BuildingGraph, start_id: int) -> Tuple[Dict[int, float], Dict[int, Optional[int]]]:
    """
    Executes Dijkstra's Greedy Algorithm from start_id across graph.
    Returns:
        dist: dictionary mapping node_id -> minimum cost from start_id
        parent: dictionary mapping node_id -> predecessor node_id along optimal route
    Time Complexity: O((V + E) log V) using Min-Heap
    """
    if start_id not in graph.nodes:
        raise ValueError(f"Start node ID {start_id} not in graph")

    dist: Dict[int, float] = {node_id: float("inf") for node_id in graph.nodes}
    parent: Dict[int, Optional[int]] = {node_id: None for node_id in graph.nodes}

    # If the start location itself is blocked
    start_node = graph.nodes[start_id]
    if math.isinf(start_node.hazard):
        return dist, parent

    dist[start_id] = 0.0
    # Priority Queue storing (current_distance, node_id)
    pq: List[Tuple[float, int]] = [(0.0, start_id)]

    visited = set()

    while pq:
        curr_dist, u = heapq.heappop(pq)

        if u in visited:
            continue
        visited.add(u)

        if curr_dist >= float("inf"):
            break

        u_node = graph.nodes[u]

        for edge in graph.adjacency.get(u, []):
            v = edge.target
            v_node = graph.nodes[v]

            weight = edge.get_effective_cost(u_node, v_node)

            if math.isinf(weight):
                continue  # Route impassable/blocked

            if dist[u] + weight < dist[v]:
                dist[v] = dist[u] + weight
                parent[v] = u
                heapq.heappush(pq, (dist[v], v))

    return dist, parent


def _generate_instructions(graph: BuildingGraph, path_nodes: List[Node], step_costs: List[int]) -> List[str]:
    instructions: List[str] = []
    for i, curr in enumerate(path_nodes):
        if i == 0:
            instructions.append(f"START at {curr.name} (Floor {curr.floor})")
        else:
            prev = path_nodes[i - 1]
            if curr.node_type == NodeType.EXIT:
                instructions.append(f"EVACUATE safely through {curr.name}")
            elif curr.node_type == NodeType.STAIRCASS and prev.floor != curr.floor:
                instructions.append(f"Take {curr.name} down from Floor {prev.floor} to Floor {curr.floor}")
            elif prev.node_type == NodeType.STAIRCASS and prev.floor != curr.floor:
                instructions.append(f"Descend stairs to Floor {curr.floor}, entering {curr.name}")
            else:
                instructions.append(f"Proceed along {curr.name}")
    return instructions


def _reconstruct_path(
    graph: BuildingGraph, start_id: int, dest_id: int, total_cost: float, parent: Dict[int, Optional[int]]
) -> PathResult:
    start_node = graph.nodes[start_id]
    dest_node = graph.nodes[dest_id]

    if math.isinf(total_cost):
        return PathResult(
            start_id=start_id,
            start_name=start_node.name,
            destination_id=dest_id,
            destination_name=dest_node.name,
            total_cost=float("inf"),
            path_nodes=[],
            step_costs=[],
            instructions=[],
            route_found=False,
            status="NO SAFE ROUTE FOUND (BLOCKED)",
        )

    # Reconstruct path backwards
    curr: Optional[int] = dest_id
    reverse_nodes: List[int] = []
    while curr is not None:
        reverse_nodes.append(curr)
        if curr == start_id:
            break
        curr = parent.get(curr)

    if not reverse_nodes or reverse_nodes[-1] != start_id:
        return PathResult(
            start_id=start_id,
            start_name=start_node.name,
            destination_id=dest_id,
            destination_name=dest_node.name,
            total_cost=float("inf"),
            path_nodes=[],
            step_costs=[],
            instructions=[],
            route_found=False,
            status="NO SAFE ROUTE FOUND",
        )

    path_ids = list(reversed(reverse_nodes))
    path_nodes = [graph.nodes[nid] for nid in path_ids]

    # Calculate step costs
    step_costs: List[int] = [0]
    for i in range(1, len(path_nodes)):
        u = path_nodes[i - 1].id
        v = path_nodes[i].id
        step_cost = 0
        for edge in graph.adjacency.get(u, []):
            if edge.target == v:
                eff = edge.get_effective_cost(graph.nodes[u], graph.nodes[v])
                step_cost = int(eff) if not math.isinf(eff) else 999999
                break
        step_costs.append(step_cost)

    instructions = _generate_instructions(graph, path_nodes, step_costs)

    return PathResult(
        start_id=start_id,
        start_name=start_node.name,
        destination_id=dest_id,
        destination_name=dest_node.name,
        total_cost=int(total_cost),
        path_nodes=path_nodes,
        step_costs=step_costs,
        instructions=instructions,
        route_found=True,
        status="SAFE ROUTE FOUND",
    )


def dijkstra_shortest_path(graph: BuildingGraph, start_id: int, dest_id: int) -> PathResult:
    """Computes minimum-cost path from start_id to a specific destination exit."""
    dist, parent = run_dijkstra(graph, start_id)
    res = _reconstruct_path(graph, start_id, dest_id, dist.get(dest_id, float("inf")), parent)
    
    exits = graph.get_exits()
    exit_evals: List[Dict[str, Any]] = []
    for exit_node in exits:
        cost = dist.get(exit_node.id, float("inf"))
        status = "MANUAL_TARGET" if exit_node.id == dest_id else ("BLOCKED" if math.isinf(cost) else "AVAILABLE")
        exit_evals.append({
            "id": exit_node.id,
            "name": exit_node.name,
            "code": exit_node.code,
            "cost": int(cost) if not math.isinf(cost) else 999999,
            "is_blocked": math.isinf(cost),
            "status": status,
        })
    exit_evals.sort(key=lambda x: x["cost"])
    res.exit_evaluations = exit_evals
    res.is_auto_selected = False
    return res


def dijkstra_nearest_exit(graph: BuildingGraph, start_id: int) -> PathResult:
    """Finds the nearest safe emergency exit from start_id using Dijkstra's algorithm."""
    dist, parent = run_dijkstra(graph, start_id)

    exits = graph.get_exits()
    if not exits:
        raise ValueError("Building graph has no emergency exit nodes")

    best_exit: Optional[Node] = None
    min_cost = float("inf")

    exit_evals: List[Dict[str, Any]] = []
    for exit_node in exits:
        cost = dist.get(exit_node.id, float("inf"))
        exit_evals.append({
            "id": exit_node.id,
            "name": exit_node.name,
            "code": exit_node.code,
            "cost": int(cost) if not math.isinf(cost) else 999999,
            "is_blocked": math.isinf(cost),
        })
        if cost < min_cost:
            min_cost = cost
            best_exit = exit_node

    exit_evals.sort(key=lambda x: x["cost"])
    for ev in exit_evals:
        if best_exit and ev["id"] == best_exit.id and not math.isinf(min_cost):
            ev["status"] = "OPTIMAL_SELECTED"
        elif ev["is_blocked"]:
            ev["status"] = "BLOCKED"
        else:
            ev["status"] = "AVAILABLE"

    if best_exit is None or math.isinf(min_cost):
        start_node = graph.nodes[start_id]
        return PathResult(
            start_id=start_id,
            start_name=start_node.name,
            destination_id=-1,
            destination_name="None",
            total_cost=float("inf"),
            path_nodes=[],
            step_costs=[],
            instructions=[],
            route_found=False,
            status="ALL EMERGENCY EXITS BLOCKED",
            exit_evaluations=exit_evals,
            is_auto_selected=True,
        )

    res = _reconstruct_path(graph, start_id, best_exit.id, min_cost, parent)
    res.exit_evaluations = exit_evals
    res.is_auto_selected = True
    return res


def format_mvp_output(result: PathResult) -> str:
    """
    Formats the route into the exact text structure required by the MVP prompt:
    ================================
              SAFETYBAND
    ================================

    Current Location : Lab 2
    Emergency Exit   : Exit Gate 3

    Recommended Route:

    Lab 2
     ↓
    Corridor C
     ↓
    Staircase 1
     ↓
    Main Hall
     ↓
    Exit Gate 3

    Total Cost : 16
    Status     : SAFE ROUTE FOUND
    ================================
    """
    lines = [
        "================================",
        "          SAFETYBAND            ",
        "================================",
        "",
        f"Current Location : {result.start_name}",
        f"Emergency Exit   : {result.destination_name}",
        "",
        "Recommended Route:",
        "",
    ]

    if not result.route_found:
        lines.append("NO SAFE ROUTE FOUND!")
        lines.append("Seek immediate shelter in a secure room.")
    else:
        for i, node in enumerate(result.path_nodes):
            lines.append(node.name)
            if i < len(result.path_nodes) - 1:
                lines.append(" ↓")

    lines.append("")
    cost_str = str(int(result.total_cost)) if not math.isinf(result.total_cost) else "INF"
    lines.append(f"Total Cost : {cost_str}")
    lines.append(f"Status     : {result.status}")
    lines.append("================================")
    return "\n".join(lines)
