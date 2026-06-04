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
    
    # Simple comment/string skipping (copied from previous script)
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
        if line_num >= 12900 and line_num <= 13000:
            print(f"Pushed '(' at line {line_num}, col {col_num}")
    elif char == ')':
        if parens:
            popped = parens.pop()
            if line_num >= 12900 and line_num <= 13000:
                print(f"Popped '(' from line {popped[0]}, col {popped[1]} by ')' at line {line_num}, col {col_num}")
        else:
            if line_num >= 12900 and line_num <= 13000:
                print(f"Excess ')' at line {line_num}, col {col_num}")
            
    col_num += 1
    i += 1
