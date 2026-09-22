import type { PriorityLevel, Report } from '@/types';

export interface PriorityInput {
  severity: number;
  urgency: number;
  affectedPeople: number;
  waitingTimeHours: number;
}

export interface PriorityWeights {
  severity: number;
  urgency: number;
  affectedPeople: number;
  waitingTime: number;
}

export const DEFAULT_WEIGHTS: PriorityWeights = {
  severity: 40,
  urgency: 25,
  affectedPeople: 20,
  waitingTime: 15,
};

export const SEVERITY_VALUES: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

export const URGENCY_VALUES: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

export function calculatePriorityScore(
  input: PriorityInput,
  weights: PriorityWeights = DEFAULT_WEIGHTS
): { score: number; level: PriorityLevel; factors: Record<string, number> } {
  const severityScore = Math.min(input.severity, 100);
  const urgencyScore = Math.min(input.urgency, 100);
  const affectedScore = Math.min((input.affectedPeople / 100) * 100, 100);
  const waitingScore = Math.min((input.waitingTimeHours / 168) * 100, 100);

  const total =
    (severityScore * weights.severity +
      urgencyScore * weights.urgency +
      affectedScore * weights.affectedPeople +
      waitingScore * weights.waitingTime) /
    100;

  const factors = {
    severity: severityScore,
    urgency: urgencyScore,
    affectedPeople: affectedScore,
    waitingTime: waitingScore,
  };

  let level: PriorityLevel = 'low';
  if (total >= 75) level = 'critical';
  else if (total >= 55) level = 'high';
  else if (total >= 35) level = 'medium';

  return { score: Math.round(total), level, factors };
}

interface HeapNode {
  id: string;
  score: number;
  data: Report;
}

export class MaxHeap {
  private heap: HeapNode[] = [];

  get size(): number {
    return this.heap.length;
  }

  insert(node: HeapNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  extractMax(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined;
    const max = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return max;
  }

  peek(): HeapNode | undefined {
    return this.heap[0];
  }

  toSortedArray(): HeapNode[] {
    const copy = [...this.heap];
    copy.sort((a, b) => b.score - a.score);
    return copy;
  }

  buildHeap(nodes: HeapNode[]): void {
    this.heap = [...nodes];
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.bubbleDown(i);
    }
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[index].score <= this.heap[parent].score) break;
      [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let largest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < length && this.heap[left].score > this.heap[largest].score) {
        largest = left;
      }
      if (right < length && this.heap[right].score > this.heap[largest].score) {
        largest = right;
      }
      if (largest === index) break;
      [this.heap[index], this.heap[largest]] = [this.heap[largest], this.heap[index]];
      index = largest;
    }
  }
}

export function buildPriorityQueue(reports: Report[]): MaxHeap {
  const heap = new MaxHeap();
  const nodes = reports
    .filter((r) => r.status !== 'resolved' && r.status !== 'cancelled' && r.status !== 'rejected' && r.status !== 'duplicate')
    .map((r) => ({
      id: r.id,
      score: r.priority_score || 0,
      data: r,
    }));
  heap.buildHeap(nodes);
  return heap;
}
