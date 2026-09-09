type PracticeItemMetric = {
  isUsed?: boolean;
  itemsPracticedApplies?: boolean;
  itemsPracticed?: number | null;
  totalPracticeItems?: number | null | undefined;
};

export function formatItemsPracticed(metric: PracticeItemMetric): string {
  if (metric.itemsPracticedApplies === false) return '-';
  const practiced = metric.isUsed ? Number(metric.itemsPracticed ?? 0) : 0;
  // null means the snapshot does not provide a total, not an empty lesson.
  const total = metric.totalPracticeItems;
  if (total === null || total === undefined || !Number.isFinite(total)) {
    return Number.isFinite(practiced) ? String(practiced) : '-';
  }
  return `${Number.isFinite(practiced) ? practiced : 0} / ${total}`;
}
