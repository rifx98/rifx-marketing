# -*- coding: utf-8 -*-
import sys

file_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Let's tokenize manually to ignore strings, single-line comments, multi-line comments, and template strings.
i = 0
n = len(content)

braces = []
parens = []
brackets = []

line_num = 1
col_num = 1

while i < n:
    char = content[i]
    
    # Handle line/col counting
    if char == '\n':
        line_num += 1
        col_num = 1
        i += 1
        continue
    
    # Handle single-line comment
    if char == '/' and i + 1 < n and content[i+1] == '/':
        while i < n and content[i] != '\n':
            i += 1
        continue
        
    # Handle multi-line comment
    if char == '/' and i + 1 < n and content[i+1] == '*':
        i += 2
        while i + 1 < n and not (content[i] == '*' and content[i+1] == '/'):
            if content[i] == '\n':
                line_num += 1
            i += 1
        i += 2
        continue
        
    # Handle string literal single-quotes
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
        
    # Handle string literal double-quotes
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
        
    # Handle template string backticks
    if char == '`':
        i += 1
        while i < n and content[i] != '`':
            # Handle interpolation inside template string
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
        
    # Standard delimiters
    if char == '{':
        braces.append((line_num, col_num, '{'))
    elif char == '}':
        if braces:
            braces.pop()
        else:
            print(f"Excess '}}' at line {line_num}, col {col_num}")
    elif char == '(':
        parens.append((line_num, col_num, '('))
    elif char == ')':
        if parens:
            parens.pop()
        else:
            print(f"Excess ')' at line {line_num}, col {col_num}")
    elif char == '[':
        brackets.append((line_num, col_num, '['))
    elif char == ']':
        if brackets:
            brackets.pop()
        else:
            print(f"Excess ']' at line {line_num}, col {col_num}")
            
    col_num += 1
    i += 1

print(f"Finished. Unclosed: Braces={len(braces)}, Parens={len(parens)}, Brackets={len(brackets)}")
if braces:
    print("Top 10 unclosed braces:")
    for l, c, t in braces[-10:]:
        print(f"  Line {l}, col {c}: {t}")
if parens:
    print("Top 10 unclosed parens:")
    for l, c, t in parens[-10:]:
        print(f"  Line {l}, col {c}: {t}")
if brackets:
    print("Top 10 unclosed brackets:")
    for l, c, t in brackets[-10:]:
        print(f"  Line {l}, col {c}: {t}")
