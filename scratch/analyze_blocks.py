# -*- coding: utf-8 -*-
import sys

file_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Let's count braces, brackets, parentheses and tags
# We will track them around lines 5230 to 7500 to see what is mismatching.

for line_num in range(5400, 7500):
    if line_num >= len(lines):
        break
    line = lines[line_num]
    # Look for tab conditions and rendering blocks
    if "activeTab ===" in line or "isTabLocked" in line or "return (" in line:
        print(f"Line {line_num + 1}: {line.strip()}")
