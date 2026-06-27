// Column-based overlap layout (Google Calendar style).
// Given items with start/end, assigns each a column index and the
// total number of columns of its overlap cluster.

export interface LayoutInput {
  key: string;
  start: Date;
  end: Date;
}

export interface LayoutResult<T extends LayoutInput> {
  item: T;
  col: number;
  cols: number;
  /** left as percent (0-100) within the day column */
  leftPct: number;
  /** width as percent (0-100) within the day column */
  widthPct: number;
}

export function layoutOverlaps<T extends LayoutInput>(items: T[]): LayoutResult<T>[] {
  const sorted = [...items].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime()
  );

  const results: LayoutResult<T>[] = [];
  let cluster: { idx: number; col: number; end: Date }[] = [];
  let clusterEnd: Date | null = null;

  const finalize = () => {
    if (cluster.length === 0) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) {
      const r = results[c.idx];
      r.cols = cols;
      r.widthPct = 100 / cols;
      r.leftPct = c.col * (100 / cols);
    }
    cluster = [];
    clusterEnd = null;
  };

  for (let i = 0; i < sorted.length; i++) {
    const it = sorted[i];
    if (clusterEnd !== null && it.start.getTime() >= clusterEnd.getTime()) {
      finalize();
    }
    // find first available column
    const used = new Set(cluster.filter((c) => c.end.getTime() > it.start.getTime()).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;

    const idx = results.length;
    results.push({ item: it, col, cols: 1, leftPct: 0, widthPct: 100 });
    cluster.push({ idx, col, end: it.end });
    if (clusterEnd === null || it.end.getTime() > clusterEnd.getTime()) clusterEnd = it.end;
  }
  finalize();

  return results;
}
