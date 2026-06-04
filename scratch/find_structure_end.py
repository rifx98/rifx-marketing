# -*- coding: utf-8 -*-
with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx in range(12700, 13800):
    if idx >= len(lines):
        break
    line = lines[idx]
    # Print lines that look like they close major blocks or open modal blocks
    if "show" in line and "&&" in line and "(" in line:
        print(f"Line {idx + 1}: {line.strip()}")
    elif "activeTab ===" in line:
        print(f"Line {idx + 1}: {line.strip()}")
    elif line.strip() in ["</> )", "</> )}", "</>}", ")}", "</motion.div>"]:
        print(f"Line {idx + 1}: {line.strip()}")
