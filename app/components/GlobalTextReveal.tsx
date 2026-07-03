'use client';

import { useEffect } from 'react';

const SELECTOR = [
  'p',
  'h3', 'h4', 'h5', 'h6',
  'li',
  'blockquote',
  'label',
].join(', ');

// Elements/selectors to skip entirely
const SKIP_PARENTS = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'code',
  'pre',
  'script',
  '[data-no-reveal]',
  '.material-symbols-outlined',
  '.no-reveal',
];

const PROCESSED_ATTR = 'data-rv';

/**
 * GlobalTextReveal
 *
 * Runs once after mount. Finds every p, h3–h6, li on the page,
 * splits their text into word-level spans with an overflow:hidden
 * clip, then uses IntersectionObserver to slide each word up when
 * the element enters the viewport.
 *
 * Skips:
 *  - Elements already processed by AnimatedText (data-animated-text)
 *  - Short/icon-only strings (< 4 chars of alphabetic content)
 *  - Elements inside buttons, links, forms, etc.
 *  - Elements with class 'no-reveal' or attribute 'data-no-reveal'
 */
export default function GlobalTextReveal() {
  useEffect(() => {
    // No corre en el panel: la mutación directa del DOM (reemplazar nodos de
    // texto por spans) choca con los re-renders de React del dashboard y
    // provoca crashes de "removeChild" que tumban toda la app.
    if (window.location.pathname.startsWith('/panel')) return;

    // Small delay so React fully hydrates before we touch the DOM
    const init = setTimeout(() => {
      processAll();
    }, 400);

    return () => clearTimeout(init);
  }, []);

  return null;
}

// ─── DOM Processing ──────────────────────────────────────────────────────────

function shouldSkip(el: Element): boolean {
  // Already processed
  if (el.hasAttribute(PROCESSED_ATTR)) return true;
  // Animated by AnimatedText component
  if (el.closest('[data-animated-text]')) return true;
  // Inside a skip parent
  if (SKIP_PARENTS.some(s => el.closest(s))) return true;
  // Inside material icons
  if (el.classList.contains('material-symbols-outlined')) return true;
  // Text too short to be meaningful (icons, numbers, etc.)
  const text = el.textContent?.trim() ?? '';
  if (text.length < 4) return true;
  // No real alphabetic content
  if (!/[a-zA-ZÀ-ÿ]/.test(text)) return true;
  return false;
}

function wrapWords(el: Element) {
  if (shouldSkip(el)) return false;

  el.setAttribute(PROCESSED_ATTR, '1');

  // Walk all text nodes directly inside this element (not deep into children
  // that are themselves block elements — only one level deep to avoid issues)
  const childNodes = Array.from(el.childNodes);

  childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text.trim()) return;

      const parts = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      parts.forEach(part => {
        if (/^\s+$/.test(part) || part === '') {
          // Whitespace — preserve as text node
          fragment.appendChild(document.createTextNode(part));
        } else {
          const outer = document.createElement('span');
          outer.style.cssText = [
            'display:inline-block',
            'overflow:hidden',
            'vertical-align:bottom',
            'padding-bottom:0.06em',
            'margin-bottom:-0.06em',
          ].join(';');

          const inner = document.createElement('span');
          inner.className = 'rv-word'; // for the observer to find
          inner.style.cssText = [
            'display:inline-block',
            'transform:translateY(105%)',
            'opacity:0',
            `transition:transform 750ms cubic-bezier(0.16,1,0.3,1), opacity 400ms ease`,
            'will-change:transform',
          ].join(';');
          inner.textContent = part;

          outer.appendChild(inner);
          fragment.appendChild(outer);
        }
      });

      node.parentNode?.replaceChild(fragment, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // For inline elements (strong, em, span, etc.) recurse lightly
      const childEl = node as Element;
      const tag = childEl.tagName.toLowerCase();
      // Only recurse into safe inline elements
      if (['strong', 'em', 'b', 'i', 'u', 'mark', 'span'].includes(tag)) {
        const childText = childEl.childNodes;
        Array.from(childText).forEach(cn => {
          if (cn.nodeType === Node.TEXT_NODE) {
            const text = cn.textContent ?? '';
            if (!text.trim()) return;

            const parts = text.split(/(\s+)/);
            const fragment = document.createDocumentFragment();

            parts.forEach(part => {
              if (/^\s+$/.test(part) || part === '') {
                fragment.appendChild(document.createTextNode(part));
              } else {
                const outer = document.createElement('span');
                outer.style.cssText = [
                  'display:inline-block',
                  'overflow:hidden',
                  'vertical-align:bottom',
                  'padding-bottom:0.06em',
                  'margin-bottom:-0.06em',
                ].join(';');

                const inner = document.createElement('span');
                inner.className = 'rv-word';
                inner.style.cssText = [
                  'display:inline-block',
                  'transform:translateY(105%)',
                  'opacity:0',
                  `transition:transform 750ms cubic-bezier(0.16,1,0.3,1), opacity 400ms ease`,
                  'will-change:transform',
                ].join(';');
                inner.textContent = part;

                outer.appendChild(inner);
                fragment.appendChild(outer);
              }
            });

            cn.parentNode?.replaceChild(fragment, cn);
          }
        });
      }
    }
  });

  return true;
}

function revealElement(el: Element) {
  const words = Array.from(el.querySelectorAll('.rv-word')) as HTMLElement[];
  words.forEach((word, i) => {
    word.style.transitionDelay = `${i * 55}ms`;
    word.style.transform = 'translateY(0)';
    word.style.opacity = '1';
  });
}

function processAll() {
  const elements = Array.from(document.querySelectorAll(SELECTOR));

  const processed: Element[] = [];
  elements.forEach(el => {
    const ok = wrapWords(el);
    if (ok) processed.push(el);
  });

  if (!processed.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          revealElement(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  processed.forEach(el => observer.observe(el));
}
