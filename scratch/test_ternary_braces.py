# -*- coding: utf-8 -*-
with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

block = lines[5454:5484] # lines 5455 to 5484
print("Block content:")
for i, line in enumerate(block, 5455):
    print(f"{i}: {line.strip()}")

# Paren matching stack
stack = []
for i, line in enumerate(block, 5455):
    for col, char in enumerate(line, 1):
        if char == '(':
            stack.append((i, col, '('))
        elif char == ')':
            if stack:
                stack.pop()
            else:
                print(f"Mismatched ')' at line {i}, col {col}")
        elif char == '{':
            stack.append((i, col, '{'))
        elif char == '}':
            if stack:
                stack.pop()
            else:
                print(f"Mismatched '}}' at line {i}, col {col}")

if stack:
    print("Unclosed structures in this block:")
    for i, col, char in stack:
        print(f"  Unclosed '{char}' opened at line {i}, col {col}")
