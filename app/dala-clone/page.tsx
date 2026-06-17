import React from 'react';
import './dala-theme.css';
import CloneNavbar from '../components/dala-clone/CloneNavbar';
import CloneHero from '../components/dala-clone/CloneHero';
import CloneScrollShowcase from '../components/dala-clone/CloneScrollShowcase';
import CloneCardsGrid from '../components/dala-clone/CloneCardsGrid';

export const metadata = {
  title: 'Dala Visual Clone | Rifx Marketing',
  description: '1:1 Visual Clone Study based on provided DESIGN.md',
};

export default function DalaClonePage() {
  return (
    <div className="dala-theme min-h-screen bg-[var(--color-void)] font-[var(--font-acronym)] text-[var(--color-bone)] selection:bg-[var(--color-plum-voltage)]/30 selection:text-[var(--color-bone)]">
      <CloneNavbar />
      
      <main className="flex flex-col">
        <CloneHero />
        <CloneScrollShowcase />
        <CloneCardsGrid />
      </main>

      {/* Footer Minimal */}
      <footer className="w-full bg-[var(--color-void)] border-t border-[var(--color-bone)]/10 py-12 text-center text-[var(--color-smoke)]"
        style={{ fontSize: 'var(--text-caption)', letterSpacing: 'var(--tracking-caption)' }}>
        <p>© 2026 Rifx Marketing. Sistema de Escalamiento V2.</p>
      </footer>
    </div>
  );
}
