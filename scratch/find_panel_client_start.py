# -*- coding: utf-8 -*-
with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines, 1):
    if "export default function" in line or "function PanelClient" in line:
        print(f"Line {idx}: {line.strip()}")
        # print next 20 lines
        for j in range(1, 20):
            if idx + j < len(lines):
                print(f"  Line {idx + 1 + j}: {lines[idx + j].strip()}")
        break
