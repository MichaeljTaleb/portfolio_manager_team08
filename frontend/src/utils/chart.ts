export interface ChartPaths {
  line: string;
  area: string;
}

export const buildChartPaths = (values: number[], width = 720, height = 210, padding = 14): ChartPaths => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (index: number) => (values.length === 1 ? 0 : (index / (values.length - 1)) * width);
  const y = (value: number) => padding + (1 - (value - min) / span) * (height - padding * 2);

  const line = values
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
    .join(' ');

  const area = `M0 ${height} ${values
    .map((value, index) => `L${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
    .join(' ')} L${width} ${height} Z`;

  return { line, area };
};
