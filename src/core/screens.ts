// Screen state machine and modal stack. Generic over the render context,
// so core never depends on the DOM.

import type { InputEvent } from './input';

export type ScreenId = 'map' | 'town' | 'combat' | 'reward' | 'death' | 'victory' | 'gameOver';
export type ModalId = 'classChoice' | 'cardChoice' | 'inventory' | 'help' | 'merchant';

export interface Screen<R> {
  enter?(): void;
  exit?(): void;
  /** Fixed-step update (paused while a modal is open). */
  update(dt: number): void;
  render(r: R): void;
  onInput(e: InputEvent): void;
}

export interface Modal<R> extends Screen<R> {
  id: ModalId;
}

export class ScreenManager<R> {
  private screens = new Map<ScreenId, Screen<R>>();
  private modals: Modal<R>[] = [];
  private currentId: ScreenId | null = null;
  /** Called after every screen switch (e.g. to mirror into GameState). */
  onChange: ((id: ScreenId) => void) | null = null;

  register(id: ScreenId, screen: Screen<R>): void {
    this.screens.set(id, screen);
  }

  get current(): ScreenId | null {
    return this.currentId;
  }

  go(id: ScreenId): void {
    const next = this.screens.get(id);
    if (!next) throw new Error(`Screen not registered: ${id}`);
    if (this.currentId) this.screens.get(this.currentId)?.exit?.();
    this.currentId = id;
    next.enter?.();
    this.onChange?.(id);
  }

  pushModal(modal: Modal<R>): void {
    this.modals.push(modal);
    modal.enter?.();
  }

  popModal(): void {
    const m = this.modals.pop();
    m?.exit?.();
  }

  clearModals(): void {
    while (this.modals.length > 0) this.popModal();
  }

  get topModal(): Modal<R> | null {
    return this.modals[this.modals.length - 1] ?? null;
  }

  /** True while a modal is open: the game behind it is paused. */
  get isPaused(): boolean {
    return this.modals.length > 0;
  }

  update(dt: number): void {
    const modal = this.topModal;
    if (modal) {
      modal.update(dt);
      return;
    }
    this.screen()?.update(dt);
  }

  render(r: R): void {
    this.screen()?.render(r);
    for (const m of this.modals) m.render(r);
  }

  onInput(e: InputEvent): void {
    const modal = this.topModal;
    if (modal) modal.onInput(e);
    else this.screen()?.onInput(e);
  }

  private screen(): Screen<R> | undefined {
    return this.currentId ? this.screens.get(this.currentId) : undefined;
  }
}
