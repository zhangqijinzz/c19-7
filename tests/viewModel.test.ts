import { describe, expect, it, vi } from 'vitest';
import { createStarterDocument, getBoundingBox } from '../src/domain';
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

  it('rotates around the element center so the footprint stays in place', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const before = getBoundingBox(vm.state.document.elements.find((element) => element.id === 'booth-1')!);
    vm.selectElement('booth-1');
    vm.rotateSelected();
    const rotated = vm.state.document.elements.find((element) => element.id === 'booth-1')!;
    const box = getBoundingBox(rotated);
    expect(rotated.rotation).toBe(90);
    expect(box.left + box.width / 2).toBeCloseTo(before.left + before.width / 2);
    expect(box.top + box.height / 2).toBeCloseTo(before.top + before.height / 2);
    expect(vm.state.selectedElement?.displayWidth).toBeCloseTo(box.width);
  });

  it('resizes a rotated element from its occupied top-left corner without jumping', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('booth-1');
    vm.rotateSelected();
    const before = getBoundingBox(vm.state.document.elements.find((element) => element.id === 'booth-1')!);
    vm.resizeSelected(4, 5);
    const resized = getBoundingBox(vm.state.document.elements.find((element) => element.id === 'booth-1')!);
    expect(resized.width).toBe(4);
    expect(resized.height).toBe(5);
    expect(resized.left).toBeCloseTo(before.left);
    expect(resized.top).toBeCloseTo(before.top);
    expect(vm.state.selectedElement?.displayWidth).toBe(4);
  });

  it('keeps unrotated resize anchored at the stored top-left as before', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('booth-1');
    vm.resizeSelected(6, 4);
    const element = vm.state.document.elements.find((item) => item.id === 'booth-1')!;
    expect([element.x, element.y, element.width, element.height]).toEqual([4, 2, 6, 4]);
  });
});
