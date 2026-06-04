# -*- coding: utf-8 -*-
with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

block = lines[4912:5233] # lines 4913 to 5233
print("Login Block content length:", len(block))

stack = []
for i, line in enumerate(block, 4913):
    for col, char in enumerate(line, 1):
        if char == '{':
            stack.append((i, col, '{'))
        elif char == '}':
            if stack and stack[-1][2] == '{':
                stack.pop()
            else:
                print(f"Mismatched '}}' at line {i}, col {col}")
        elif char == '(':
            stack.append((i, col, '('))
        elif char == ')':
            if stack and stack[-1][2] == '(':
                stack.pop()
            else:
                print(f"Mismatched ')' at line {i}, col {col}")

if stack:
    print("Unclosed structures in login block:")
    for i, col, char in stack:
        print(f"  Unclosed '{char}' opened at line {i}, col {col}")
else:
    print("All brackets match in login block!")
