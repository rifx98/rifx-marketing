# -*- coding: utf-8 -*-
with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    content = f.read()

i = 0
n = len(content)

parens = []
line_num = 1
col_num = 1

while i < n:
    char = content[i]
    
    if char == '\n':
        line_num += 1
        col_num = 1
        i += 1
        continue
    
    # Skip comments and strings
    if char == '/' and i + 1 < n and content[i+1] == '/':
        while i < n and content[i] != '\n':
            i += 1
        continue
    if char == '/' and i + 1 < n and content[i+1] == '*':
        i += 2
        while i + 1 < n and not (content[i] == '*' and content[i+1] == '/'):
            if content[i] == '\n':
                line_num += 1
            i += 1
        i += 2
        continue
    if char == "'":
        i += 1
        while i < n and content[i] != "'":
            if content[i] == '\\' and i + 1 < n:
                i += 1
            if content[i] == '\n':
                line_num += 1
            i += 1
        i += 1
        continue
    if char == '"':
        i += 1
        while i < n and content[i] != '"':
            if content[i] == '\\' and i + 1 < n:
                i += 1
            if content[i] == '\n':
                line_num += 1
            i += 1
        i += 1
        continue
    if char == '`':
        i += 1
        while i < n and content[i] != '`':
            if content[i] == '$' and i + 1 < n and content[i+1] == '{':
                i += 2
                continue
            if content[i] == '\\' and i + 1 < n:
                i += 1
            if content[i] == '\n':
                line_num += 1
            i += 1
        i += 1
        continue
        
    if char == '(':
        parens.append((line_num, col_num))
    elif char == ')':
        if parens:
            popped = parens.pop()
            if popped[0] in [5431, 5498]:
                print(f"Parenthesis opened at line {popped[0]}, col {popped[1]} is popped by ')' at line {line_num}, col {col_num}")
                # Print 3 lines before and after
                lines = content.split('\n')
                for idx in range(max(0, line_num-4), min(len(lines), line_num+3)):
                    print(f"  Line {idx+1}: {lines[idx]}")
        else:
            pass
            
    col_num += 1
    i += 1
