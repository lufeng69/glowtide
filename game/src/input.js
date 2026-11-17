// input.js — keyboard + mouse state, in logical canvas coordinates (1280x720).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, consumed by main loop
    this.mouseX = 640;
    this.mouseY = 300;
    this.mouseDown = false;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * 1280;
      this.mouseY = ((e.clientY - r.top) / r.height) * 720;
    };
    this._onMouseDown = (e) => { if (e.button === 0) this.mouseDown = true; };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  down(code) { return this.keys.has(code); }
  // true once for the frame the key went down; main loop clears after use
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); }

  moveX() {
    let x = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return x;
  }
  moveY() {
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    return y;
  }
  get dash() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
}
