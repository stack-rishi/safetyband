"""
Unit and Integration Tests for SafetyBand Emergency Evacuation Optimizer.
Verifies graph structure, Dijkstra's algorithm, dynamic recalculation, and safety weights.
"""

import math
import unittest

from safetyband.graph import BuildingGraph, NodeType, SafetyCondition, create_college_building
from safetyband.dijkstra import dijkstra_shortest_path, dijkstra_nearest_exit, run_dijkstra


class TestSafetyBand(unittest.TestCase):
    def setUp(self):
        self.graph = create_college_building()

    def test_building_graph_structure(self):
        """Verify building nodes, floors, and emergency exit count."""
        self.assertEqual(len(self.graph.nodes), 20)
        exits = self.graph.get_exits()
        self.assertEqual(len(exits), 3)
        exit_names = {e.name for e in exits}
        self.assertIn("Exit Gate 1", exit_names)
        self.assertIn("Exit Gate 2", exit_names)
        self.assertIn("Exit Gate 3", exit_names)

        # Verify Lab 2 exists on Floor 1
        lab2 = self.graph.find_node("Lab 2")
        self.assertIsNotNone(lab2)
        self.assertEqual(lab2.floor, 1)
        self.assertEqual(lab2.node_type, NodeType.LABORATORY)

    def test_core_mvp_scenario_1(self):
        """
        Scenario 1:
        Current Location : Lab 2
        Emergency Exit   : Exit Gate 3
        Recommended Route: Lab 2 -> Corridor C -> Staircase 1 -> Main Hall -> Exit Gate 3
        Total Cost       : 16
        """
        # Block Staircase 2 (to simulate central route via Corridor C)
        self.graph.set_node_hazard(9, float("inf"))

        res = dijkstra_shortest_path(self.graph, 0, 19)
        self.assertTrue(res.route_found)
        self.assertEqual(res.total_cost, 16)
        path_names = [n.name for n in res.path_nodes]
        expected_path = ["Lab 2", "Corridor C", "Staircase 1", "Main Hall", "Exit Gate 3"]
        self.assertEqual(path_names, expected_path)
        self.assertEqual(res.status, "SAFE ROUTE FOUND")

    def test_dynamic_recalculation_scenario_2(self):
        """
        Scenario 2:
        BEFORE: Lab 2 -> Corridor B -> Staircase 2 -> Exit 3 (Cost = 12)
        Staircase 2 becomes BLOCKED (and Corridor C smoky)
        AFTER:  Lab 2 -> Corridor A -> Staircase 1 -> Exit 3 (Cost = 17)
        """
        # 1. BEFORE
        before_res = dijkstra_shortest_path(self.graph, 0, 19)
        self.assertTrue(before_res.route_found)
        self.assertEqual(before_res.total_cost, 12)
        before_names = [n.name for n in before_res.path_nodes]
        self.assertEqual(before_names, ["Lab 2", "Corridor B", "Staircase 2", "Exit Gate 3"])

        # 2. DISASTER EVENT: Staircase 2 becomes BLOCKED, Corridor C has smoke
        self.graph.set_node_hazard(9, float("inf"))
        self.graph.set_node_hazard(7, float("inf"))

        # 3. AFTER: Recalculates route automatically
        after_res = dijkstra_shortest_path(self.graph, 0, 19)
        self.assertTrue(after_res.route_found)
        self.assertEqual(after_res.total_cost, 17)
        after_names = [n.name for n in after_res.path_nodes]
        self.assertEqual(after_names, ["Lab 2", "Corridor A", "Staircase 1", "Main Hall", "Exit Gate 3"])

    def test_nearest_safe_exit_selection(self):
        """Verify Dijkstra auto-selects the nearest safe exit."""
        res = dijkstra_nearest_exit(self.graph, 0)
        self.assertTrue(res.route_found)
        self.assertIn(res.destination_name, ["Exit Gate 2", "Exit Gate 3", "Exit Gate 1"])
        self.assertLessEqual(res.total_cost, 12)

    def test_hazard_weight_multipliers(self):
        """Verify crowd (3x), narrow (5x), and hazard (10x) penalties."""
        base_res = dijkstra_shortest_path(self.graph, 0, 19)
        base_cost = base_res.total_cost

        # Increase Corridor B to CROWDED (3x)
        self.graph.set_node_hazard(6, SafetyCondition.CROWDED)
        crowded_res = dijkstra_shortest_path(self.graph, 0, 19)
        self.assertGreater(crowded_res.total_cost, base_cost)

        # Increase Corridor B to HAZARDOUS (10x)
        self.graph.set_node_hazard(6, SafetyCondition.HAZARDOUS)
        hazardous_res = dijkstra_shortest_path(self.graph, 0, 19)
        # Should divert or significantly increase cost
        self.assertGreaterEqual(hazardous_res.total_cost, 16)

    def test_all_exits_blocked(self):
        """Verify system handles case where all exits are cut off."""
        for exit_node in self.graph.get_exits():
            self.graph.set_node_hazard(exit_node.id, float("inf"))

        res = dijkstra_nearest_exit(self.graph, 0)
        self.assertFalse(res.route_found)
        self.assertTrue(math.isinf(res.total_cost))
        self.assertIn("BLOCKED", res.status)


if __name__ == "__main__":
    unittest.main()
