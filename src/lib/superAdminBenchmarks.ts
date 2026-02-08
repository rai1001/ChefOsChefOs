export interface HotelBenchmark {
  hotel_id: string;
  hotel_name: string;
  cost_per_pax_30d: number;
  waste_qty_30d: number;
  task_completion_pct_30d: number;
  purchase_on_time_pct_30d: number;
}

export interface RankedBenchmark extends HotelBenchmark {
  score: number;
}

export function calculateBenchmarkScore(benchmark: HotelBenchmark): number {
  // Lower cost/waste is better; higher completion/on-time is better.
  const costScore = Math.max(0, 100 - benchmark.cost_per_pax_30d * 2);
  const wasteScore = Math.max(0, 100 - benchmark.waste_qty_30d);
  const completionScore = benchmark.task_completion_pct_30d;
  const onTimeScore = benchmark.purchase_on_time_pct_30d;
  return Number(
    (costScore * 0.25 + wasteScore * 0.25 + completionScore * 0.25 + onTimeScore * 0.25).toFixed(2),
  );
}

export function rankHotelBenchmarks(rows: HotelBenchmark[]): RankedBenchmark[] {
  return rows
    .map((row) => ({ ...row, score: calculateBenchmarkScore(row) }))
    .sort((a, b) => b.score - a.score);
}
