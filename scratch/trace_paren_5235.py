# -*- coding: utf-8 -*-
with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    content = f.read()

i = 0
n = len(content)

braces = []
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
                braces.append((line_num, col_num, '${'))
                i += 2
                continue
            if content[i] == '\\' and i + 1 < n:
                i += 1
            if content[i] == '\n':
                line_num += 1
            i += 1
        i += 1
        continue
        
    if char == '{':
        braces.append((line_num, col_num, '{'))
    elif char == '}':
        if braces:
            braces.pop()
    elif char == '(':
        parens.append((line_num, col_num, '('))
    elif char == ')':
        if parens:
            popped = parens.pop()
            if popped[0] == 5235:
                print(f"Parenthesis opened at line 5235, col 10 is POPPED at line {line_num}, col {col_num} by ')'")
                # Print the surrounding lines
                lines = content.split('\n')
                for idx in range(max(0, line_num-3), min(len(lines), line_num+2)):
                    print(f"  Line {idx+1}: {lines[idx]}")
        else:
            pass
            
    col_num += 1
    i += 1
