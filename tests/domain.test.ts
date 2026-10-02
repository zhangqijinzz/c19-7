import { describe, expect, it } from 'vitest';
import { analyzeLayout, findBoundsIssues, findNarrowChannels, findOverlaps, getBoundingBox, getRenderPlacement, rotateElementQuarterTurn } from '../src/domain';
import type { ExpoElement } from '../src/types';

const item = (id: string, x: number, y: number, width = 4, height = 3): ExpoElement => ({ id, kind: 'booth', name: id, x, y, width, height, rotation: 0 });

// 由摆放参数还原旋转后可视包围盒
const visualBox = (element: ExpoElement) => {
  const placement = getRenderPlacement(element);
  const isQuarterTurn = placement.rotation % 180 !== 0;
  const visualWidth = isQuarterTurn ? placement.height : placement.width;
  const visualHeight = isQuarterTurn ? placement.width : placement.height;
  return {
    left: placement.left - (visualWidth - placement.width) / 2,
    top: placement.top - (visualHeight - placement.height) / 2,
    right: placement.left + placement.width / 2 + visualWidth / 2,
    bottom: placement.top + placement.height / 2 + visualHeight / 2,
    width: visualWidth,
    height: visualHeight,
  };
};

describe('layout domain rules', () => {
  it('detects overlap area between two elements', () => {
    expect(findOverlaps([item('a', 1, 1), item('b', 3, 2)])).toEqual([{ firstId: 'a', secondId: 'b', amount: 4 }]);
  });

  it('detects field overflow and rotated bounds', () => {
    const rotated = { ...item('rotated', 8, 2, 2, 5), rotation: 90 };
    expect(findBoundsIssues({ width: 10, height: 10 }, [rotated])).toEqual([{ elementId: 'rotated', overflow: 3 }]);
  });

  it('flags a pass narrower than the minimum channel', () => {
    expect(findNarrowChannels([item('a', 1, 1), item('b', 5.5, 1)])).toEqual([{ firstId: 'a', secondId: 'b', gap: 0.5 }]);
  });

  it('returns a path when entrance and focus area exist', () => {
    const analysis = analyzeLayout({ version: 1, title: 'x', field: { width: 20, height: 12 }, elements: [{ ...item('entry', 1, 5, 2, 1), kind: 'entrance' }, { ...item('stage', 10, 2, 5, 3), kind: 'stage' }] });
    expect(analysis.path?.points).toHaveLength(3);
    expect(analysis.path?.distance).toBeGreaterThan(0);
  });

  it('places unrotated elements with zero offset so their behavior is unchanged', () => {
    const element = item('plain', 4, 2, 5, 3.5);
    expect(getRenderPlacement(element)).toEqual({ left: 4, top: 2, width: 5, height: 3.5, rotation: 0 });
  });

  it('keeps the rendered visual footprint identical to the checked bounding box after rotation', () => {
    const rotated = { ...item('rotated', 19, 2.75, 5, 3.5), rotation: 90 };
    const checked = getBoundingBox(rotated);
    const visual = visualBox(rotated);
    expect(visual.left).toBeCloseTo(checked.left, 10);
    expect(visual.top).toBeCloseTo(checked.top, 10);
    expect(visual.right).toBeCloseTo(checked.right, 10);
    expect(visual.bottom).toBeCloseTo(checked.bottom, 10);
    expect(visual.width).toBe(checked.width);
    expect(visual.height).toBe(checked.height);
  });

  it('does not flag a rotated element that visually hugs the wall', () => {
    // 横向 5、纵向 3.5 的展位旋转后贴住右边墙：右边 = 场地宽
    const hugging = { ...item('hugging', 24.5, 5, 5, 3.5), rotation: 90 };
    expect(findBoundsIssues({ width: 28, height: 18 }, [hugging])).toEqual([]);
    // 超出 0.8 m 时，检查值与可见越界量一致
    const overflowing = { ...hugging, x: 25.3 };
    expect(findBoundsIssues({ width: 28, height: 18 }, [overflowing])).toEqual([{ elementId: 'hugging', overflow: 0.8 }]);
  });

  it('rotates around the visual center without jumping and updates the footprint origin', () => {
    const element = item('booth', 4, 2, 5, 3.5);
    const before = getBoundingBox(element);
    const centerBefore = { x: before.left + before.width / 2, y: before.top + before.height / 2 };
    const rotated = rotateElementQuarterTurn(element);
    const after = getBoundingBox(rotated);
    const centerAfter = { x: after.left + after.width / 2, y: after.top + after.height / 2 };
    expect(rotated.rotation).toBe(90);
    expect(centerAfter.x).toBeCloseTo(centerBefore.x, 10);
    expect(centerAfter.y).toBeCloseTo(centerBefore.y, 10);
    expect(rotated.x).toBeCloseTo(4.75, 2);
    expect(rotated.y).toBeCloseTo(1.25, 2);
    // 连续旋转四次回到原位
    let current = element;
    for (let step = 0; step < 4; step += 1) current = rotateElementQuarterTurn(current);
    expect(current.rotation).toBe(0);
    expect(current.x).toBeCloseTo(element.x, 6);
    expect(current.y).toBeCloseTo(element.y, 6);
  });
});
