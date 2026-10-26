// Minimal typed event bus. Logic emits, render subscribes.

type Handler<E> = (e: E) => void;

export class EventBus<E extends { type: string }> {
  private handlers = new Map<string, Set<Handler<E>>>();
  private any = new Set<Handler<E>>();

  on<T extends E['type']>(type: T, fn: Handler<Extract<E, { type: T }>>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn as Handler<E>);
    return () => set.delete(fn as Handler<E>);
  }

  onAny(fn: Handler<E>): () => void {
    this.any.add(fn);
    return () => this.any.delete(fn);
  }

  emit(e: E): void {
    const set = this.handlers.get(e.type);
    if (set) for (const fn of set) fn(e);
    for (const fn of this.any) fn(e);
  }

  clear(): void {
    this.handlers.clear();
    this.any.clear();
  }
}
