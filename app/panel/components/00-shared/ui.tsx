import React from 'react';
import styles from './ui.module.css';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function initials(name = '') {
  return (name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('') || '?').toUpperCase();
}

export function Avatar({ name, large = false }: { name?: string; large?: boolean }) {
  return <span className={cx(styles.avatar, large && styles.large)}>{initials(name)}</span>;
}

export function StatCard(props: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return <div className={styles.statCard}><div className={styles.statIcon}>{props.icon}</div><div><span>{props.label}</span><strong>{props.value}</strong>{props.sub && <small>{props.sub}</small>}</div></div>;
}

export function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'premium' }) {
  return <span className={cx(styles.statusPill, styles[tone])}>{children}</span>;
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className={styles.tag}>{children}</span>;
}

export function EmptyState({ icon = '💭', title, text }: { icon?: React.ReactNode; title: string; text?: string }) {
  return <div className={styles.empty}><span>{icon}</span><strong>{title}</strong>{text && <p>{text}</p>}</div>;
}
