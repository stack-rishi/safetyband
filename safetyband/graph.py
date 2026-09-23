"""
Building Graph Representation for SafetyBand Emergency Evacuation System.
Models college building structure with rooms, corridors, staircases, and exits.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any
import math


class NodeType(str, Enum):
    CLASSROOM = "Classroom"
    LABORATORY = "Laboratory"
    CORRIDOR = "Corridor"
    STAIRCASS = "Staircase"
    HALL = "Hall"
    EXIT = "Emergency Exit"


class SafetyCondition:
    NORMAL = 1
    CROWDED = 3
    NARROW = 5
    HAZARDOUS = 10
    BLOCKED = float("inf")

    NAMES = {
        1: "Normal Route",
        3: "Crowded Route",
        5: "Narrow Route",
        10: "Hazardous Route",
        float("inf"): "Blocked Route",
    }

    @classmethod
    def get_name(cls, cost: float) -> str:
        if math.isinf(cost) or cost >= 999999:
            return "Blocked Route"
        return cls.NAMES.get(int(cost), f"Hazard Level ({cost}x)")

    @classmethod
    def parse(cls, val: Any) -> float:
        if isinstance(val, (int, float)):
            return float(val) if not math.isinf(val) else float("inf")
        s = str(val).strip().upper()
        if s in ("BLOCKED", "INF", "INFINITY", "FIRE", "CLOSED"):
            return float("inf")
        if s in ("HAZARDOUS", "HAZARD", "SMOKE", "10"):
            return float(cls.HAZARDOUS)
        if s in ("NARROW", "5"):
            return float(cls.NARROW)
        if s in ("CROWDED", "CROWD", "3"):
            return float(cls.CROWDED)
        if s in ("NORMAL", "CLEAR", "OPEN", "1"):
            return float(cls.NORMAL)
        try:
            return float(s)
        except ValueError:
            return float(cls.NORMAL)


@dataclass
class Node:
    id: int
    name: str
    code: str
    node_type: NodeType
    floor: int  # 0 = Ground, 1 = 1st Floor
    x: int      # 2D coordinate for map visualization
    y: int
    hazard: float = SafetyCondition.NORMAL

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "type": self.node_type.value,
            "floor": self.floor,
            "x": self.x,
            "y": self.y,
            "hazard": self.hazard if not math.isinf(self.hazard) else 999999,
            "hazard_name": SafetyCondition.get_name(self.hazard),
        }


@dataclass
class Edge:
    target: int
    base_cost: int
    description: str
    hazard: float = SafetyCondition.NORMAL

    def get_effective_cost(self, src_node: Node, target_node: Node) -> float:
        # If either endpoint or the corridor itself is blocked
        if (math.isinf(src_node.hazard) or 
            math.isinf(target_node.hazard) or 
            math.isinf(self.hazard)):
            return float("inf")

        effective_hazard = max(self.hazard, target_node.hazard)
        return self.base_cost * effective_hazard


class BuildingGraph:
    def __init__(self, name: str = "Campus Engineering Block"):
        self.name = name
        self.nodes: Dict[int, Node] = {}
        self.adjacency: Dict[int, List[Edge]] = {}

    def add_node(self, id: int, name: str, code: str, node_type: NodeType, floor: int, x: int, y: int) -> Node:
        node = Node(id=id, name=name, code=code, node_type=node_type, floor=floor, x=x, y=y)
        self.nodes[id] = node
        if id not in self.adjacency:
            self.adjacency[id] = []
        return node

    def add_edge(self, u: int, v: int, base_cost: int, description: str = "", bidirectional: bool = True):
        if u not in self.nodes or v not in self.nodes:
            raise ValueError(f"Node {u} or {v} does not exist in graph")

        edge_uv = Edge(target=v, base_cost=base_cost, description=description)
        self.adjacency[u].append(edge_uv)

        if bidirectional:
            edge_vu = Edge(target=u, base_cost=base_cost, description=description)
            self.adjacency[v].append(edge_vu)

    def find_node(self, identifier: Any) -> Optional[Node]:
        if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
            return self.nodes.get(int(identifier))
        s = str(identifier).strip().lower()
        # Search by exact name or code
        for n in self.nodes.values():
            if n.name.lower() == s or n.code.lower() == s:
                return n
        # Partial match
        for n in self.nodes.values():
            if s in n.name.lower() or s in n.code.lower():
                return n
        return None

    def set_node_hazard(self, node_id: int, hazard: float) -> bool:
        if node_id in self.nodes:
            self.nodes[node_id].hazard = hazard
            return True
        return False

    def set_edge_hazard(self, u: int, v: int, hazard: float) -> bool:
        updated = False
        if u in self.adjacency:
            for edge in self.adjacency[u]:
                if edge.target == v:
                    edge.hazard = hazard
                    updated = True
        if v in self.adjacency:
            for edge in self.adjacency[v]:
                if edge.target == u:
                    edge.hazard = hazard
                    updated = True
        return updated

    def reset_all_hazards(self):
        for node in self.nodes.values():
            node.hazard = SafetyCondition.NORMAL
        for edges in self.adjacency.values():
            for edge in edges:
                edge.hazard = SafetyCondition.NORMAL

    def get_exits(self) -> List[Node]:
        return [n for n in self.nodes.values() if n.node_type == NodeType.EXIT]

    def to_dict(self) -> Dict[str, Any]:
        node_list = [node.to_dict() for node in self.nodes.values()]
        edge_list = []
        seen = set()
        for u, edges in self.adjacency.items():
            for e in edges:
                pair = tuple(sorted([u, e.target]))
                if pair not in seen:
                    seen.add(pair)
                    eff_cost = e.get_effective_cost(self.nodes[u], self.nodes[e.target])
                    edge_list.append({
                        "source": u,
                        "target": e.target,
                        "base_cost": e.base_cost,
                        "effective_cost": eff_cost if not math.isinf(eff_cost) else 999999,
                        "hazard": e.hazard if not math.isinf(e.hazard) else 999999,
                        "hazard_name": SafetyCondition.get_name(e.hazard),
                        "description": e.description,
                    })
        return {
            "name": self.name,
            "total_nodes": len(self.nodes),
            "total_edges": len(edge_list),
            "nodes": node_list,
            "edges": edge_list,
        }


def create_college_building() -> BuildingGraph:
    """
    Creates a 2-floor college building map with 20 nodes:
    Floor 1:
      - Lab 2 (Computer Lab 2)
      - Computer Lab 1
      - Electronics Lab
      - Lecture Hall 101
      - Lecture Hall 102
      - Corridor A (Connects Lab 2 to Staircase 1 / East wing)
      - Corridor B (Connects Lab 2 to Staircase 2 / West wing)
      - Corridor C (Central corridor connecting Lab 2 to Staircase 1)
      - Staircase 1 (East Wing stair to Ground Main Hall)
      - Staircase 2 (West Wing stair to Ground West Exit)
      - Fire Escape Stair (North fire stair to Exit Gate 1)
    Floor 0 (Ground):
      - Physics Lab
      - Chemistry Lab
      - Seminar Hall
      - Library
      - Main Hall (Central atrium connecting to Exit Gate 3)
      - Ground West Corr
      - Exit Gate 1 (North Emergency Exit)
      - Exit Gate 2 (West Emergency Exit)
      - Exit Gate 3 (Main East Gate)
    """
    g = BuildingGraph("College Science & Tech Block")

    # Floor 1 (Upper Floor) - x in [80, 720], y in [70, 220]
    g.add_node(0, "Lab 2",               "CL2",     NodeType.LABORATORY, 1, 190, 100)
    g.add_node(1, "Computer Lab 1",      "CL1",     NodeType.LABORATORY, 1,  80, 100)
    g.add_node(2, "Electronics Lab",     "EL",      NodeType.LABORATORY, 1, 300, 100)
    g.add_node(3, "Lecture Hall 101",    "LH101",   NodeType.CLASSROOM,  1, 620, 100)
    g.add_node(4, "Lecture Hall 102",    "LH102",   NodeType.CLASSROOM,  1, 710, 100)
    g.add_node(5, "Corridor A",          "CORR_A",  NodeType.CORRIDOR,   1, 380, 100)
    g.add_node(6, "Corridor B",          "CORR_B",  NodeType.CORRIDOR,   1, 190, 190)
    g.add_node(7, "Corridor C",          "CORR_C",  NodeType.CORRIDOR,   1, 480, 150)
    g.add_node(8, "Staircase 1",         "STAIR_1", NodeType.STAIRCASS,  1, 560, 210)
    g.add_node(9, "Staircase 2",         "STAIR_2", NodeType.STAIRCASS,  1, 190, 270)
    g.add_node(10, "Fire Escape Stair",  "F_STAIR", NodeType.STAIRCASS,  1, 380,  40)

    # Floor 0 (Ground Floor) - x in [80, 750], y in [300, 430]
    g.add_node(11, "Physics Lab",        "PL",      NodeType.LABORATORY, 0, 100, 410)
    g.add_node(12, "Chemistry Lab",      "CHEM",    NodeType.LABORATORY, 0, 240, 410)
    g.add_node(13, "Seminar Hall",       "SEM",     NodeType.CLASSROOM,  0, 680, 410)
    g.add_node(14, "Library",            "LIB",     NodeType.CLASSROOM,  0, 680, 310)
    g.add_node(15, "Main Hall",          "M_HALL",  NodeType.HALL,       0, 560, 330)
    g.add_node(16, "Ground West Corr",   "GW_CORR", NodeType.CORRIDOR,   0, 190, 350)
    g.add_node(17, "Exit Gate 1",        "EXIT_1",  NodeType.EXIT,       0, 380,  15)
    g.add_node(18, "Exit Gate 2",        "EXIT_2",  NodeType.EXIT,       0,  50, 350)
    g.add_node(19, "Exit Gate 3",        "EXIT_3",  NodeType.EXIT,       0, 750, 330)

    # Edges calibrated to match MVP specifications:
    # 1. MVP Route: Lab 2 -> Corridor C -> Staircase 1 -> Main Hall -> Exit Gate 3
    #    Costs: 3 + 4 + 5 + 4 = 16
    g.add_edge(0, 7, base_cost=3, description="Lab 2 East door to Corridor C")
    g.add_edge(7, 8, base_cost=4, description="Corridor C to Staircase 1 East Wing")
    g.add_edge(8, 15, base_cost=5, description="Staircase 1 down to Ground Main Hall")
    g.add_edge(15, 19, base_cost=4, description="Main Hall to Exit Gate 3")

    # 2. Dynamic Recalculation Route (Before):
    #    Lab 2 -> Corridor B (3) -> Staircase 2 (4) -> Exit 3 via Ground Express Corridor (5) = 12!
    #    And Staircase 2 down to Ground West Corridor (2) -> Exit Gate 2 (3)
    g.add_edge(0, 6, base_cost=3, description="Lab 2 South door to Corridor B")
    g.add_edge(6, 9, base_cost=4, description="Corridor B to Staircase 2 West Wing")
    g.add_edge(9, 19, base_cost=5, description="Staircase 2 Ground Direct to Exit 3")
    g.add_edge(9, 16, base_cost=2, description="Staircase 2 Ground Landing to West Corridor")
    g.add_edge(16, 18, base_cost=3, description="Ground West Corridor to Exit Gate 2")

    # 3. Dynamic Recalculation Route (After):
    #    When Staircase 2 is blocked (and Corridor C is crowded/unavailable in Scenario 2):
    #    Lab 2 -> Corridor A (4) -> Staircase 1 (4) -> Exit 3 (9 via Main Hall: 5+4) = 17!
    g.add_edge(0, 5, base_cost=4, description="Lab 2 North door to Corridor A")
    g.add_edge(5, 8, base_cost=4, description="Corridor A Direct Connector to Staircase 1")
    g.add_edge(5, 7, base_cost=3, description="Corridor A cross passage to Corridor C")

    # Fire escape to Exit 1
    g.add_edge(5, 10, base_cost=4, description="Corridor A to Fire Escape Stair")
    g.add_edge(10, 17, base_cost=5, description="Fire Escape down to Exit Gate 1 (North)")

    # Other academic spaces
    g.add_edge(1, 6, base_cost=3, description="Computer Lab 1 to Corridor B")
    g.add_edge(2, 5, base_cost=2, description="Electronics Lab to Corridor A")
    g.add_edge(3, 7, base_cost=3, description="Lecture Hall 101 to Corridor C")
    g.add_edge(4, 7, base_cost=3, description="Lecture Hall 102 to Corridor C")
    g.add_edge(4, 8, base_cost=3, description="Lecture Hall 102 to Staircase 1")

    # Ground Floor rooms
    g.add_edge(11, 16, base_cost=3, description="Physics Lab to Ground West Corridor")
    g.add_edge(12, 15, base_cost=4, description="Chemistry Lab to Main Hall")
    g.add_edge(13, 15, base_cost=3, description="Seminar Hall to Main Hall")
    g.add_edge(14, 15, base_cost=3, description="Library to Main Hall")

    return g
