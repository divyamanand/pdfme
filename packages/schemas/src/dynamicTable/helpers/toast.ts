/**
 * Lightweight DOM toast for dynamic table constraint notifications.
 * Appends a temporary floating message that auto-dismisses.
 */

export function showToast(message: string, durationMs = 2500): void {
  const el = document.createElement('div');
  el.textContent = message;
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#333',
    color: '#fff',
    padding: '8px 18px',
    borderRadius: '6px',
    fontSize: '13px',
    zIndex: '99999',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.2s',
  } as CSSStyleDeclaration);

  document.body.appendChild(el);

  // Fade in
  requestAnimationFrame(() => { el.style.opacity = '1'; });

  // Fade out and remove
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, durationMs);
}
