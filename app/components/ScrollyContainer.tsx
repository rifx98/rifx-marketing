import React, { useState, useEffect, Children } from 'react';

export function ScrollyContainer({ children }: { children: React.ReactNode }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const childArray = Children.toArray(children);
  const count = childArray.length;
  
  useEffect(() => {
    const handleScroll = () => {
      const vh = window.innerHeight;
      // scrollY.current gives us the exact number of screens scrolled
      const screensScrolled = window.scrollY / vh;
      setScrollProgress(screensScrolled);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative z-10 w-full" style={{ height: `${count * 100}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {childArray.map((child, index) => {
          // scrollProgress indicates how many screens we have scrolled.
          // child 0 is fully visible at 0.
          // child 1 is fully visible at 1.
          const dist = Math.abs(scrollProgress - index);
          // Fade window: when distance is 0, opacity is 1. When distance is 0.5, opacity is 0.
          let opacity = 1 - (dist * 2);
          if (opacity < 0) opacity = 0;
          if (opacity > 1) opacity = 1;
          
          return (
            <div 
              key={index} 
              className="absolute inset-0 transition-opacity duration-300 overflow-y-auto overflow-x-hidden flex flex-col justify-center"
              style={{ 
                opacity, 
                pointerEvents: opacity > 0.5 ? 'auto' : 'none',
                zIndex: opacity > 0.5 ? 10 : 0
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
