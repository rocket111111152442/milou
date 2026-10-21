import { h, css } from '../engine/dom.js';

/**
 * Caméra 3D CSS. La scène possède une perspective ; le "monde" reçoit la transformation inverse de la caméra.
 * x/y : travelling, z : dolly (positif = recul), rx/ry/rz : orbite autour de l'origine du monde (centre de l'image).
 */
export class MotionCamera {
  constructor(parent, { perspective = 1600, originX = 540, originY = 960 } = {}) {
    this.viewport = h('div', { class: 'cam-viewport' });
    this.viewport.style.perspective = `${perspective}px`;
    this.viewport.style.perspectiveOrigin = `${originX}px ${originY}px`;
    this.world = h('div', { class: 'cam-world' });
    this.viewport.append(this.world);
    parent.append(this.viewport);
    this.state = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, shakeX: 0, shakeY: 0 };
  }
  set(s) {
    Object.assign(this.state, s);
    const c = this.state;
    css(this.world, 'transform',
      `translate3d(${(c.shakeX).toFixed(2)}px,${(c.shakeY).toFixed(2)}px,${(-c.z).toFixed(2)}px) rotateZ(${c.rz.toFixed(3)}deg) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg) translate3d(${(-c.x).toFixed(2)}px,${(-c.y).toFixed(2)}px,0px)`);
  }
}
