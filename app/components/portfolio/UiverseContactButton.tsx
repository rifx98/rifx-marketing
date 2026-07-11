"use client";

import React from "react";
import Link from "next/link";
import "./UiverseContactButton.css";

interface ButtonProps {
  href: string;
  className?: string;
}

export default function UiverseContactButton({ href, className = "" }: ButtonProps) {
  return (
    <div className={`btn-container ${className}`}>
      <div className="btn-drawer transition-top">despega...</div>
      <div className="btn-drawer transition-bottom">...con IA</div>

      <Link
        href={href}
        className="btn"
      >
        <span className="btn-text">INICIAR SESIÓN</span>
      </Link>

      <svg
        className="btn-corner"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-1 1 32 32"
      >
        <path d="M32,32C14.355,32,0,17.645,0,0h.985c0,17.102,13.913,31.015,31.015,31.015v.985Z"></path>
      </svg>
      <svg
        className="btn-corner"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-1 1 32 32"
      >
        <path d="M32,32C14.355,32,0,17.645,0,0h.985c0,17.102,13.913,31.015,31.015,31.015v.985Z"></path>
      </svg>
      <svg
        className="btn-corner"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-1 1 32 32"
      >
        <path d="M32,32C14.355,32,0,17.645,0,0h.985c0,17.102,13.913,31.015,31.015,31.015v.985Z"></path>
      </svg>
      <svg
        className="btn-corner"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-1 1 32 32"
      >
        <path d="M32,32C14.355,32,0,17.645,0,0h.985c0,17.102,13.913,31.015,31.015,31.015v.985Z"></path>
      </svg>
    </div>
  );
}
