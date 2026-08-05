import { describe, expect, it } from 'vitest';
import { buildChartPaths } from './chart';

describe('buildChartPaths', () => {
  it('creates correctly scaled line, area, and point data', () => {
    const paths = buildChartPaths([10, 20, 15], 100, 50, 5);

    expect(paths.line).toBe('M0.0 45.0 L50.0 5.0 L100.0 25.0');
    expect(paths.area).toBe('M0 50 L0.0 45.0 L50.0 5.0 L100.0 25.0 L100 50 Z');
    expect(paths.points).toEqual([
      { x: 0, y: 45, value: 10 },
      { x: 50, y: 5, value: 20 },
      { x: 100, y: 25, value: 15 },
    ]);
  });

  it('handles a single or flat series without invalid coordinates', () => {
    expect(buildChartPaths([42], 100, 50, 5).points).toEqual([{ x: 0, y: 45, value: 42 }]);
    expect(buildChartPaths([7, 7], 100, 50, 5).points).toEqual([
      { x: 0, y: 45, value: 7 },
      { x: 100, y: 45, value: 7 },
    ]);
  });
});
