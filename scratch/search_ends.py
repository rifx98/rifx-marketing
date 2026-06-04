# -*- coding: utf-8 -*-
with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Let's write a simple script to check where the IIFE or brackets are opened/closed.
# We'll print the first 5 instances of `(() => {` and their line numbers.
for idx, line in enumerate(lines, 1):
    if "(() =>" in line or "(() => {" in line:
        print(f"Line {idx}: {line.strip()}")
