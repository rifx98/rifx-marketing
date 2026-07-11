"use client";

import React, { ElementType } from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  className?: string;
  as?: ElementType;
}

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  className = "",
  as = "div",
}: FadeInProps) {
  const MotionComponent = motion(as as React.ForwardRefExoticComponent<any>);

  return (
    <MotionComponent
      className={className}
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "50px", amount: 0 }}
      transition={{
        delay,
        duration,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </MotionComponent>
  );
}
