/** Registries + active tool — SPEC.md §4.4. */
import { describe, expect, it, vi } from 'vitest';
import { createRegistry, DuplicateRegistrationError } from './create';

interface Def {
  id: string;
  n?: number;
}

describe('createRegistry', () => {
  it('registers, lists and gets', () => {
    const reg = createRegistry<Def>('test');
    reg.register({ id: 'a' });
    reg.register({ id: 'b' });
    expect(reg.list().map((d) => d.id)).toEqual(['a', 'b']);
    expect(reg.get('b')).toEqual({ id: 'b' });
  });

  it('treats a duplicate id as a hard error', () => {
    const reg = createRegistry<Def>('blockTypes');
    reg.register({ id: 'body' });
    expect(() => reg.register({ id: 'body' })).toThrow(DuplicateRegistrationError);
  });

  it('unregisters through the returned disposer', () => {
    const reg = createRegistry<Def>('test');
    const dispose = reg.register({ id: 'a' });
    dispose();
    expect(reg.list()).toEqual([]);
    expect(() => dispose()).not.toThrow();
  });

  it('notifies subscribers on register and dispose', () => {
    const reg = createRegistry<Def>('test');
    const cb = vi.fn();
    const off = reg.subscribe(cb);

    const dispose = reg.register({ id: 'a' });
    expect(cb).toHaveBeenCalledTimes(1);
    dispose();
    expect(cb).toHaveBeenCalledTimes(2);

    off();
    reg.register({ id: 'c' });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('hands out a new array identity per change (so React re-renders)', () => {
    const reg = createRegistry<Def>('test');
    const before = reg.list();
    reg.register({ id: 'a' });
    expect(reg.list()).not.toBe(before);
    expect(reg.list()).toBe(reg.list());
  });
});
