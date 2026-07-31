import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ChartPaths } from './chart';

export interface DragRange {
  startIndex: number;
  endIndex: number;
}

// Click-and-drag "measure" interaction for line charts: while the mouse button
// is held, tracks the index under the cursor as the selection's live end point.
// A plain click (mouseup with no movement) clears the selection and falls back
// to normal single-point hover; an actual drag freezes the selection on release
// so it stays readable without holding the mouse down.
export function useChartRangeSelect(paths: ChartPaths) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragRange, setDragRange] = useState<DragRange | null>(null);
  const isDraggingRef = useRef(false);
  const pointCountRef = useRef(paths.points.length);

  // A range switch (or ticker change) swaps in a differently-sized points
  // array, which makes any stored indices point at the wrong spot on the new
  // series. Clear the selection when the point count actually changes, but
  // not on every paths update — a live price tick only updates values, not
  // length, and a frozen selection should survive those.
  useEffect(() => {
    if (pointCountRef.current === paths.points.length) return;
    pointCountRef.current = paths.points.length;
    isDraggingRef.current = false;
    setDragRange(null);
    setHoverIndex(null);
  }, [paths.points.length]);

  const indexFromClientX = useCallback(
    (clientX: number, bounds: DOMRect) => {
      if (bounds.width === 0 || !paths.points.length) return null;
      const ratio = (clientX - bounds.left) / bounds.width;
      return Math.round(Math.min(1, Math.max(0, ratio)) * (paths.points.length - 1));
    },
    [paths.points.length],
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      // Stops the browser's native text/element drag-select from kicking in
      // while measuring a range on the chart.
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const index = indexFromClientX(event.clientX, bounds);
      if (index === null) return;
      isDraggingRef.current = true;
      setHoverIndex(null);
      setDragRange({ startIndex: index, endIndex: index });
    },
    [indexFromClientX],
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const index = indexFromClientX(event.clientX, bounds);
      if (index === null) return;

      if (isDraggingRef.current) {
        setDragRange((current) => (current ? { ...current, endIndex: index } : { startIndex: index, endIndex: index }));
      } else {
        setHoverIndex(index);
      }
    },
    [indexFromClientX],
  );

  const finishDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setDragRange((current) => (current && current.startIndex === current.endIndex ? null : current));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', finishDrag);
    return () => window.removeEventListener('mouseup', finishDrag);
  }, [finishDrag]);

  return {
    hoverIndex,
    dragRange,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp: finishDrag,
    handleMouseLeave,
  };
}
