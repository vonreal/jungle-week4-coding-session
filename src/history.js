// 상태 히스토리 모듈 — VDOM 스냅샷의 Undo/Redo 관리

import { cloneVdom } from './vdom.js';

export class History {
  constructor() {
    this._stack = []; // VDOM 스냅샷 배열
    this._cursor = -1; // 현재 위치
  }

  /**
   * 새 VDOM 상태를 히스토리에 추가
   * cursor 이후의 기록은 삭제됨
   */
  push(vdom) {
    // cursor 이후 기록 삭제
    this._stack = this._stack.slice(0, this._cursor + 1);
    this._stack.push(cloneVdom(vdom));
    this._cursor = this._stack.length - 1;
  }

  /**
   * 현재 상태 반환
   */
  current() {
    if (this._cursor < 0) return null;
    return cloneVdom(this._stack[this._cursor]);
  }

  /**
   * 이전 상태로 이동 (Undo)
   */
  undo() {
    if (!this.canUndo()) return null;
    this._cursor--;
    return this.current();
  }

  /**
   * 다음 상태로 이동 (Redo)
   */
  redo() {
    if (!this.canRedo()) return null;
    this._cursor++;
    return this.current();
  }

  canUndo() {
    return this._cursor > 0;
  }

  canRedo() {
    return this._cursor < this._stack.length - 1;
  }

  get size() {
    return this._stack.length;
  }

  get cursor() {
    return this._cursor;
  }
}
