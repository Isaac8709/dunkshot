// /design-sync preview stub for the `phaser` engine.
// The real ExerciseModal embeds a Phaser canvas; bundling Phaser (~1.5MB+)
// pushes _ds_bundle.js past the 5MB upload limit. This stub keeps the modal
// chrome real and renderable while the animation canvas stays empty in
// preview cards. It is NOT shipped to the app at runtime — only used to build
// the design-sync bundle. The real component code is unchanged.
class Scene { constructor() {} }
class Game {
  constructor() {
    this.events = { on() {}, off() {}, once() {}, emit() {} }
    this.scene = { start() {}, stop() {}, restart() {}, getScene() { return null } }
    this.scale = { on() {}, off() {} }
  }
  destroy() {}
}
const Phaser = {
  Scene, Game,
  AUTO: 0, WEBGL: 1, CANVAS: 2,
  Scale: { FIT: 0, CENTER_BOTH: 0, RESIZE: 0, NONE: 0 },
}
export default Phaser
