# -*- coding: utf-8 -*-
with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Starting at line 11368 (index 11367)
start_idx = 11367
paren_count = 0
brace_count = 0
found_end = False

for idx in range(start_idx, len(lines)):
    line = lines[idx]
    # Simple paren counting
    for char in line:
        if char == '(':
            paren_count += 1
        elif char == ')':
            paren_count -= 1
        elif char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
    
    if paren_count == 0 and "activeTab === 'admin'" in lines[start_idx]:
        print(f"End of activeTab === 'admin' block likely at line {idx + 1}: {line.strip()}")
        # print next few lines
        for j in range(1, 15):
            if idx + j < len(lines):
                print(f"  Line {idx + 1 + j}: {lines[idx + j].strip()}")
        break
