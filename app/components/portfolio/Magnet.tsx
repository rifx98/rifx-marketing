"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useSpring } from "framer-motion";

interface MagnetProps {
  children: React.ReactNode;
  padding?: number;
  strength?: number;
  activeTransition?: string;
  inactiveTransition?: string;
  className?: string;
}

export default function Magnet({
  children,
  padding = 150,
  strength = 3,
  activeTransition = "transform 0.3s ease-out",
  inactiveTransition = "transform 0.6s ease-in-out",
  className = "",
}: MagnetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  const x = useSpring(0, { stiffness: 150, damping: 15, mass: 0.1 });
  const y = useSpring(0, { stiffness: 150, damping: 15, mass: 0.1 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const { left, top, width, height } = ref.current.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      
      const distanceX = Math.abs(e.clientX - centerX);
      const distanceY = Math.abs(e.clientY - centerY);

      if (distanceX < width / 2 + padding && distanceY < height / 2 + padding) {
        setIsActive(true);
        x.set((e.clientX - centerX) / strength);
        y.set((e.clientY - centerY) / strength);
      } else {
        setIsActive(false);
        x.set(0);
        y.set(0);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [padding, strength, x, y]);

  return (
    <motion.div
      ref={ref}
      style={{ x, y, willChange: "transform" }}
      className={className}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
    >
      {children}
    </motion.div>
  );
}
