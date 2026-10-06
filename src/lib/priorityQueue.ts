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
  const severityScore = Math.max(0, Math.min(input.severity, 100));
  const urgencyScore = Math.max(0, Math.min(input.urgency, 100));
  const affectedScore = Math.max(0, Math.min(input.affectedPeople, 100));
  const waitingScore = Math.max(0, Math.min((input.waitingTimeHours / 168) * 100, 100));

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

  return { score: Math.round(total * 100) / 100, level, factors };
}

export interface PriorityQueueEntry {
  id: string;
  score: number;
  level: PriorityLevel;
  factors: Record<string, number>;
  waitingTimeHours: number;
  data: Report;
}

export function calculateReportPriority(report: Report, evaluatedAt = Date.now()): PriorityQueueEntry {
  const createdAt = Date.parse(report.created_at);
  const waitingTimeHours = Number.isFinite(createdAt)
    ? Math.max(0, (evaluatedAt - createdAt) / (1000 * 60 * 60))
    : 0;
  const priority = calculatePriorityScore({
    severity: SEVERITY_VALUES[report.severity || ''] || 0,
    urgency: URGENCY_VALUES[report.urgency] || URGENCY_VALUES.medium,
    affectedPeople: report.affected_people || 0,
    waitingTimeHours,
  });

  return {
    id: report.id,
    score: priority.score,
    level: priority.level,
    factors: priority.factors,
    waitingTimeHours,
    data: report,
  };
}

export class MaxHeap {
  private heap: PriorityQueueEntry[] = [];

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  insert(report: Report, evaluatedAt = Date.now()): void {
    this.heap.push(calculateReportPriority(report, evaluatedAt));
    this.heapifyUp(this.heap.length - 1);
  }

  peek(): PriorityQueueEntry | undefined {
    return this.heap[0];
  }

  extractMax(): PriorityQueueEntry | undefined {
    if (this.heap.length === 0) return undefined;
    const max = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.heapifyDown(0);
    }
    return max;
  }

  remove(reportId: string): PriorityQueueEntry | undefined {
    const index = this.heap.findIndex((entry) => entry.id === reportId);
    if (index < 0) return undefined;

    const removed = this.heap[index];
    const last = this.heap.pop()!;
    if (index < this.heap.length) {
      this.heap[index] = last;
      const parent = Math.floor((index - 1) / 2);
      if (index > 0 && this.compare(this.heap[index], this.heap[parent]) > 0) {
        this.heapifyUp(index);
      } else {
        this.heapifyDown(index);
      }
    }
    return removed;
  }

  updatePriority(report: Report, evaluatedAt = Date.now()): void {
    this.remove(report.id);
    this.insert(report, evaluatedAt);
  }

  toPriorityArray(): PriorityQueueEntry[] {
    const copy = new MaxHeap();
    copy.heap = [...this.heap];
    const entries: PriorityQueueEntry[] = [];
    while (!copy.isEmpty()) entries.push(copy.extractMax()!);
    return entries;
  }

  buildHeap(reports: Report[], evaluatedAt = Date.now()): void {
    this.heap = reports.map((report) => calculateReportPriority(report, evaluatedAt));
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.heapifyDown(i);
    }
  }

  private compare(a: PriorityQueueEntry, b: PriorityQueueEntry): number {
    if (a.score !== b.score) return a.score - b.score;
    if (a.factors.severity !== b.factors.severity) return a.factors.severity - b.factors.severity;
    if (a.factors.urgency !== b.factors.urgency) return a.factors.urgency - b.factors.urgency;
    if (a.waitingTimeHours !== b.waitingTimeHours) return a.waitingTimeHours - b.waitingTimeHours;

    const aCreatedAt = Date.parse(a.data.created_at);
    const bCreatedAt = Date.parse(b.data.created_at);
    if (Number.isFinite(aCreatedAt) && Number.isFinite(bCreatedAt) && aCreatedAt !== bCreatedAt) {
      return bCreatedAt - aCreatedAt;
    }
    return b.data.report_id.localeCompare(a.data.report_id);
  }

  private heapifyUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parent]) <= 0) break;
      [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
      index = parent;
    }
  }

  private heapifyDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let largest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < length && this.compare(this.heap[left], this.heap[largest]) > 0) {
        largest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[largest]) > 0) {
        largest = right;
      }
      if (largest === index) break;
      [this.heap[index], this.heap[largest]] = [this.heap[largest], this.heap[index]];
      index = largest;
    }
  }
}

export function buildPriorityQueue(reports: Report[], evaluatedAt = Date.now()): MaxHeap {
  const heap = new MaxHeap();
  const eligible = reports.filter((report) =>
    ['verified', 'prioritized'].includes(report.status) &&
    !report.is_duplicate
  );
  heap.buildHeap(eligible, evaluatedAt);
  return heap;
}
