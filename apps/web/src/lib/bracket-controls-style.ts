/**
 * GC-Stats - bracket-controls-style
 *
 * React Flow's default Controls buttons are light-themed (white background,
 * dark icon) regardless of page theme — both bracket canvases (public site,
 * admin editor) are dark, so this restyles them inline rather than pulling
 * in a whole custom Controls implementation for 4 buttons. Apply by adding
 * className="gcs-flow-canvas" to the element wrapping <ReactFlow> and
 * rendering <style>{CONTROLS_DARK_STYLE}</style> once inside it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const CONTROLS_DARK_STYLE = `
.gcs-flow-canvas .react-flow__controls-button {
  background: #1a1a1a;
  border-bottom: 1px solid #262626;
  fill: #e5e5e5;
}
.gcs-flow-canvas .react-flow__controls-button:hover {
  background: #262626;
}
.gcs-flow-canvas .react-flow__controls-button svg { fill: #e5e5e5; }
`;
