'use client';

import React, { useRef } from 'react';
import { motion, useInView, Variants } from 'framer-motion';

interface AnimatedTextProps {
  children: React.ReactNode;
  as?: any;
  className?: string;
  delay?: number;
  stagger?: number;
  mode?: 'word' | 'letter';
  once?: boolean;
}

export default function AnimatedText({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0, // delay in ms
  stagger = 30, // stagger in ms
  mode = 'word',
  once = true,
}: AnimatedTextProps) {
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(containerRef, { once, margin: "-10% 0px" });

  const textToAnimate = React.Children.toArray(children).join('');

  // Contenedor principal con stagger
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger / 1000,
        delayChildren: delay / 1000,
      },
    },
  };

  // Variantes profesionales: Desplazamiento desde abajo con ligero ángulo y rotación, luego asienta
  const childVariants: Variants = {
    hidden: { 
      y: '120%', 
      opacity: 0, 
      rotate: 4, 
      filter: 'blur(4px)' 
    },
    visible: {
      y: '0%',
      opacity: 1,
      rotate: 0,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        damping: 18,
        stiffness: 120,
        mass: 0.8
      },
    },
  };

  const renderContent = () => {
    if (!textToAnimate) {
      return children; // Fallback for complex children
    }

    if (mode === 'word') {
      const words = textToAnimate.split(' ');
      return words.map((word, index) => (
        <span
          key={index}
          style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.1em', marginRight: '0.25em' }}
        >
          <motion.span
            variants={childVariants}
            style={{ display: 'inline-block', willChange: 'transform, opacity, filter' }}
          >
            {word}
          </motion.span>
        </span>
      ));
    }

    if (mode === 'letter') {
      const words = textToAnimate.split(' ');
      return words.map((word, wordIndex) => (
        <span
          key={wordIndex}
          style={{ display: 'inline-block', overflow: 'hidden', marginRight: '0.25em', paddingBottom: '0.1em' }}
        >
          {Array.from(word).map((letter, letterIndex) => (
            <motion.span
              key={letterIndex}
              variants={childVariants}
              style={{ display: 'inline-block', willChange: 'transform, opacity, filter' }}
            >
              {letter}
            </motion.span>
          ))}
        </span>
      ));
    }
  };

  // Get the correct motion component statically to avoid remounts
  const MotionComponents: Record<string, any> = {
    h1: motion.h1,
    h2: motion.h2,
    h3: motion.h3,
    h4: motion.h4,
    p: motion.p,
    span: motion.span,
    div: motion.div,
  };
  const MotionTag = MotionComponents[Tag] || motion.div;

  return (
    <MotionTag
      ref={containerRef}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      aria-label={textToAnimate || undefined}
    >
      <span aria-hidden="true" style={{ display: 'inline-block' }}>
        {renderContent()}
      </span>
    </MotionTag>
  );
}
