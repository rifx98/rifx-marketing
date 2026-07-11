"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface AnimatedTextProps {
  text: string;
  className?: string;
}

export default function AnimatedText({ text, className = "" }: AnimatedTextProps) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.8", "end 0.2"],
  });

  const characters = text.split("");

  return (
    <p ref={containerRef} className={className} style={{ position: "relative" }}>
      {characters.map((char, i) => {
        const start = i / characters.length;
        const end = start + (1 / characters.length);
        
        return (
          <Character 
            key={i} 
            char={char} 
            progress={scrollYProgress} 
            range={[start, end]} 
          />
        );
      })}
    </p>
  );
}

function Character({ char, progress, range }: { char: string, progress: any, range: number[] }) {
  const opacity = useTransform(progress, range, [0.2, 1]);
  
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ opacity: 0 }}>{char === " " ? "\u00A0" : char}</span>
      <motion.span style={{ opacity, position: "absolute", left: 0, top: 0 }}>
        {char === " " ? "\u00A0" : char}
      </motion.span>
    </span>
  );
}
