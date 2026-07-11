"use client";

import React from "react";
import Link from "next/link";

interface ButtonProps {
  href: string;
  label: string;
  className?: string;
}

export function ContactButton({ href, label, className = "" }: ButtonProps) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (href === '#contacto') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('openConsultationModal'));
        }
      }}
      className={`
        inline-flex items-center justify-center rounded-full text-white font-medium uppercase tracking-widest
        px-8 py-3 sm:px-10 sm:py-3.5 md:px-12 md:py-4 text-xs sm:text-sm md:text-base
        hover:opacity-90 transition-opacity duration-300
        ${className}
      `}
      style={{
        background: "linear-gradient(123deg, #18011F 7%, #B600A8 37%, #7621B0 72%, #BE4C00 100%)",
        boxShadow: "0px 4px 4px rgba(181, 1, 167, 0.25), 4px 4px 12px #7721B1 inset",
        outline: "2px solid white",
        outlineOffset: "-3px",
      }}
    >
      {label}
    </Link>
  );
}

export function LiveProjectButton({ href, label, className = "" }: ButtonProps) {
  const isExternal = href.startsWith("http") || href.startsWith("//");
  
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`
          inline-flex items-center justify-center rounded-full border-2 border-[#D7E2EA] text-[#D7E2EA]
          font-medium uppercase tracking-widest px-8 py-3 sm:px-10 sm:py-3.5 text-sm sm:text-base
          hover:bg-[#D7E2EA]/10 transition-colors duration-300
          ${className}
        `}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={`
        inline-flex items-center justify-center rounded-full border-2 border-[#D7E2EA] text-[#D7E2EA]
        font-medium uppercase tracking-widest px-8 py-3 sm:px-10 sm:py-3.5 text-sm sm:text-base
        hover:bg-[#D7E2EA]/10 transition-colors duration-300
        ${className}
      `}
    >
      {label}
    </Link>
  );
}
