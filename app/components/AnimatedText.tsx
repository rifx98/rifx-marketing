'use client';

import React, { useRef, useEffect, useState } from 'react';

interface AnimatedTextProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
  className?: string;
  delay?: number;    // base delay in ms before any word animates
  stagger?: number;  // ms between each word
  duration?: number; // ms per word transition
  once?: boolean;
}

/**
 * AnimatedText — Word Mask Reveal
 *
 * Each word is wrapped in an overflow:hidden clip so it slides up
 * from behind an invisible curtain. No typing, no letter-by-letter.
 * This is the classic premium agency reveal effect.
 *
 * Usage:
 *   <AnimatedText as="h1" className="text-6xl font-bold">
 *     Hola Mundo
 *   </AnimatedText>
 */
export default function AnimatedText({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
  stagger = 80,
  duration = 700,
  once = true,
}: AnimatedTextProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  // Global word counter for stagger across all text nodes
  let wordIndex = 0;

  const renderNode = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') {
      return splitToWords(node);
    }
    if (React.isValidElement(node)) {
      const el = node as React.ReactElement<{ children?: React.ReactNode }>;
      const kids = (el.props as { children?: React.ReactNode }).children;
      if (!kids) return node;
      return React.cloneElement(el, {
        children: Array.isArray(kids)
          ? kids.map((kid, i) => <React.Fragment key={i}>{renderNode(kid)}</React.Fragment>)
          : renderNode(kids),
      });
    }
    return node;
  };

  const splitToWords = (text: string): React.ReactNode => {
    // Split on spaces but keep them as separators
    const parts = text.split(/(\s+)/);
    return parts.map((part, i) => {
      if (/^\s+$/.test(part)) {
        // Pure whitespace — render as-is
        return <span key={i} aria-hidden="true" style={{ display: 'inline' }}>{part}</span>;
      }
      const wi = wordIndex++;
      const wordDelay = delay + wi * stagger;
      return (
        // The outer span clips — overflow hidden acts as the "curtain"
        <span
          key={i}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            overflow: 'hidden',
            verticalAlign: 'bottom',
            // Small padding so descenders aren't cut off
            paddingBottom: '0.05em',
            marginBottom: '-0.05em',
          }}
        >
          {/* Inner span is the word that slides up */}
          <span
            style={{
              display: 'inline-block',
              transform: inView ? 'translateY(0)' : 'translateY(110%)',
              opacity: inView ? 1 : 0,
              transition: `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${duration * 0.6}ms ease`,
              transitionDelay: `${wordDelay}ms`,
              willChange: 'transform',
            }}
          >
            {part}
          </span>
        </span>
      );
    });
  };

  return (
    // @ts-expect-error — dynamic tag
    <Tag
      ref={containerRef}
      className={className}
      // aria-label reconstructs the plain text for screen readers
      aria-label={typeof children === 'string' ? children : undefined}
    >
      {React.Children.map(children, (child, i) => (
        <React.Fragment key={i}>{renderNode(child)}</React.Fragment>
      ))}
    </Tag>
  );
}
