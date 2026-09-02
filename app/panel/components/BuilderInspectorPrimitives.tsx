'use client';
import React from 'react';
import styles from './builder.module.css';

export function InspectorField({ label, help, children }: { label:string; help?:string; children:React.ReactNode }) { return <div className={styles.field}><label>{label}{help&&<span> · {help}</span>}</label>{children}</div>; }
export function InspectorDivider(){return <div className={styles.divider}/>;}
export function InspectorToggle({ checked, title, text, onChange }: {checked:boolean;title:string;text?:string;onChange?:(v:boolean)=>void}) {return <label className={styles.toggle}><input type="checkbox" checked={checked} onChange={(e)=>onChange?.(e.target.checked)}/><div><strong>{title}</strong>{text&&<small>{text}</small>}</div></label>}
