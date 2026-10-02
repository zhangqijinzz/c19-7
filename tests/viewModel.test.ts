import { describe, expect, it, vi } from 'vitest';
import { createStarterDocument } from '../src/domain';
import type { LayoutRepository } from '../src/repository';
import type { LayoutDocument } from '../src/types';
import { ExpoSketchViewModel } from '../src/viewModel';

const fakeRepository = (initial: LayoutDocument | null = null): LayoutRepository => ({
  load: vi.fn(async () => initial ?? createStarterDocument()),
  save: vi.fn(async (_document) => {}),
});

describe('ExpoSketchViewModel', () => {
  it('initializes and updates the selected layout', async () => {
    const repository = fakeRepository();
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('ready');
    const count = vm.state.document.elements.length;
    vm.addElement('booth');
    expect(vm.state.document.elements).toHaveLength(count + 1);
    expect(vm.state.selectedId).toContain('booth-');
  });

  it('updates analysis immediately after moving an element into an overlap', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    expect(vm.state.analysis.overlaps.length).toBeGreaterThan(0);
  });

  it('recovers the example if repository loading fails', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => { throw new Error('bad storage'); }), save: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    expect(vm.state.document.title).toContain('春日创意市集');
  });

  it('shows a save error without dropping the working document', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => createStarterDocument()), save: vi.fn(async () => { throw new Error('quota'); }) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    vm.addElement('stage');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vm.state.document.elements.some((element) => element.kind === 'stage' && element.id.startsWith('stage-'))).toBe(true);
    expect(vm.state.notice.tone).toBe('error');
  });

  it('ignores invalid dimensions instead of corrupting the working selection', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const before = vm.state.document.elements[0].width;
    vm.resizeSelected(0, 0);
    expect(vm.state.document.elements[0].width).toBe(before);
  });

  it('reads and writes rotated dimensions through the on-canvas footprint', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('booth-1');
    vm.rotateSelected();
    // 香氛展位 5 × 3.5 旋转后，属性面板与图上读数都是横向 3.5、纵向 5
    const rotated = vm.state.selectedElement;
    expect(rotated?.displayWidth).toBe(3.5);
    expect(rotated?.displayHeight).toBe(5);
    // 把图上横向宽度改成 4（占地口径），映射回自身深度 4，位置不变
    const xBefore = vm.state.document.elements.find((element) => element.id === 'booth-1')?.x;
    vm.resizeSelected(4, rotated!.displayHeight);
    const stored = vm.state.document.elements.find((element) => element.id === 'booth-1');
    expect(stored?.width).toBe(5);
    expect(stored?.height).toBe(4);
    expect(stored?.x).toBe(xBefore);
    expect(vm.state.selectedElement?.displayWidth).toBe(4);
  });

  it('keeps a rotated element centered on the same spot after rotating', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('booth-1');
    const centerBefore = (() => {
      const el = vm.state.document.elements.find((element) => element.id === 'booth-1')!;
      return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    })();
    vm.rotateSelected();
    const after = vm.state.selectedElement!;
    expect(after.x + after.displayWidth / 2).toBeCloseTo(centerBefore.x, 6);
    expect(after.y + after.displayHeight / 2).toBeCloseTo(centerBefore.y, 6);
  });
});
