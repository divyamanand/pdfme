/**
 * Reusable button factory for the dynamic table UI.
 * Extracted from the tables plugin pattern (tables/uiRender.ts).
 */

export interface ButtonOptions {
  width: number;
  height: number;
  top: string;
  left?: string;
  right?: string;
  text: string;
  onClick: (e: MouseEvent) => void;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.style.width = `${options.width}px`;
  button.style.height = `${options.height}px`;
  button.style.position = 'absolute';
  button.style.top = options.top;
  if (options.left !== undefined) {
    button.style.left = options.left;
  }
  if (options.right !== undefined) {
    button.style.right = options.right;
  }
  button.innerText = options.text;
  button.onclick = options.onClick;
  return button;
}
