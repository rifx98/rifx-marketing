# -*- coding: utf-8 -*-
with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

brace_stack = []
paren_stack = []

for idx, line in enumerate(lines, 1):
    # We ignore contents of string literals if they contain braces, but let's do a simple count first
    # to see if any line has an obvious imbalance or where levels change.
    for col, char in enumerate(line, 1):
        if char == '{':
            brace_stack.append((idx, col))
        elif char == '}':
            if brace_stack:
                brace_stack.pop()
            else:
                print(f"Excess '}}' at line {idx}, col {col}")
        elif char == '(':
            paren_stack.append((idx, col))
        elif char == ')':
            if paren_stack:
                paren_stack.pop()
            else:
                print(f"Excess ')' at line {idx}, col {col}")

print(f"Scanning complete. Unclosed braces count: {len(brace_stack)}, Unclosed parens count: {len(paren_stack)}")
if brace_stack:
    print("Top 10 unclosed braces:")
    for idx, col in brace_stack[:10]:
        print(f"  Line {idx}, col {col}: {{")
if paren_stack:
    print("Top 10 unclosed parens:")
    for idx, col in paren_stack[:10]:
        print(f"  Line {idx}, col {col}: (")
