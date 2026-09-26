import type { GraphNode, GraphEdge, DijkstraResult } from '@/types';

export class DijkstraGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private adjacencyList: Map<string, { node: string; weight: number }[]> = new Map();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, []);
    }
  }

  addEdge(edge: GraphEdge): void {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) return;
    this.adjacencyList.get(edge.from)!.push({ node: edge.to, weight: edge.weight });
    this.adjacencyList.get(edge.to)!.push({ node: edge.from, weight: edge.weight });
  }

  shortestPath(source: string, destination: string): DijkstraResult {
    if (!this.nodes.has(source) || !this.nodes.has(destination)) {
      return { path: [], distance: 0, unreachable: true };
    }

    const distances: Map<string, number> = new Map();
    const previous: Map<string, string | null> = new Map();
    const visited: Set<string> = new Set();
    const queue: { id: string; dist: number }[] = [];

    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, nodeId === source ? 0 : Infinity);
      previous.set(nodeId, null);
    }

    queue.push({ id: source, dist: 0 });

    while (queue.length > 0) {
      queue.sort((a, b) => a.dist - b.dist);
      const current = queue.shift()!;

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      if (current.id === destination) break;

      const neighbors = this.adjacencyList.get(current.id) || [];
      for (const neighbor of neighbors) {
        if (visited.has(neighbor.node)) continue;
        const newDist = current.dist + neighbor.weight;
        if (newDist < (distances.get(neighbor.node) ?? Infinity)) {
          distances.set(neighbor.node, newDist);
          previous.set(neighbor.node, current.id);
          queue.push({ id: neighbor.node, dist: newDist });
        }
      }
    }

    const dist = distances.get(destination);
    if (dist === undefined || dist === Infinity) {
      return { path: [], distance: 0, unreachable: true };
    }

    const path: string[] = [];
    let current: string | null = destination;
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) ?? null;
    }

    return { path, distance: dist, unreachable: false };
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const seen: Set<string> = new Set();
    for (const [from, neighbors] of this.adjacencyList) {
      for (const n of neighbors) {
        const key = [from, n.node].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ from, to: n.node, weight: n.weight });
        }
      }
    }
    return edges;
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function buildGraphFromLocations(
  locations: { id: string; label: string; lat: number; lng: number }[]
): DijkstraGraph {
  const graph = new DijkstraGraph();
  for (const loc of locations) {
    graph.addNode({ id: loc.id, label: loc.label, lat: loc.lat, lng: loc.lng });
  }
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const dist = haversineDistance(
        locations[i].lat,
        locations[i].lng,
        locations[j].lat,
        locations[j].lng
      );
      if (dist < 50) {
        graph.addEdge({
          from: locations[i].id,
          to: locations[j].id,
          weight: Math.round(dist * 100) / 100,
        });
      }
    }
  }
  return graph;
}

export { haversineDistance };
