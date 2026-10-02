import { describe, expect, it } from 'vitest';
import { analyzeLayout, findBoundsIssues, findNarrowChannels, findOverlaps, getBoundingBox } from '../src/domain';
import type { ExpoElement } from '../src/types';

const item = (id: string, x: number, y: number, width = 4, height = 3): ExpoElement => ({ id, kind: 'booth', name: id, x, y, width, height, rotation: 0 });

describe('layout domain rules', () => {
  it('detects overlap area between two elements', () => {
    expect(findOverlaps([item('a', 1, 1), item('b', 3, 2)])).toEqual([{ firstId: 'a', secondId: 'b', amount: 4 }]);
  });

  it('detects field overflow and rotated bounds', () => {
    const rotated = { ...item('rotated', 8, 2, 2, 5), rotation: 90 };
    expect(findBoundsIssues({ width: 10, height: 10 }, [rotated])).toEqual([{ elementId: 'rotated', overflow: 1.5 }]);
  });

  it('rotates the occupied box around the element center, matching the canvas', () => {
    const box = getBoundingBox({ ...item('rotated', 4, 2, 5, 3.5), rotation: 90 });
    expect(box).toMatchObject({ left: 4.75, top: 1.25, width: 3.5, height: 5 });
    expect(box.left + box.width / 2).toBeCloseTo(6.5);
    expect(box.top + box.height / 2).toBeCloseTo(3.75);
  });

  it('reports no overflow when a rotated element sits flush against the wall on canvas', () => {
    const flush = { ...item('flush', 23.75, 2, 5, 3.5), rotation: 90 };
    expect(getBoundingBox(flush).right).toBeCloseTo(28);
    expect(findBoundsIssues({ width: 28, height: 18 }, [flush])).toEqual([]);
  });

  it('flags a pass narrower than the minimum channel', () => {
    expect(findNarrowChannels([item('a', 1, 1), item('b', 5.5, 1)])).toEqual([{ firstId: 'a', secondId: 'b', gap: 0.5 }]);
  });

  it('returns a path when entrance and focus area exist', () => {
    const analysis = analyzeLayout({ version: 1, title: 'x', field: { width: 20, height: 12 }, elements: [{ ...item('entry', 1, 5, 2, 1), kind: 'entrance' }, { ...item('stage', 10, 2, 5, 3), kind: 'stage' }] });
    expect(analysis.path?.points).toHaveLength(3);
    expect(analysis.path?.distance).toBeGreaterThan(0);
  });
});
