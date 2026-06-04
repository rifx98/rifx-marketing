# -*- coding: utf-8 -*-
import re

with open(r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Let's count matching braces, parentheses and JSX tags
# We will focus on lines 5500 to 7395

stack = []

def get_tags(line):
    # Very basic regex to find JSX opening/closing tags
    # matches like <motion.div or </motion.div> or <div or </div>
    # ignores self-closing tags like <img ... /> or <input ... />
    tags = []
    # Clean up strings and comments to avoid false matches
    # remove comments
    line = re.sub(r'{\s*/\*.*?\*/\s*}', '', line)
    line = re.sub(r'//.*', '', line)
    
    # Find tags
    for match in re.finditer(r'<(/?[a-zA-Z0-9\._\-]+)(?:\s+[^>]*?)?(/?)>', line):
        tag_name = match.group(1)
        is_close = tag_name.startswith('/')
        is_self_close = match.group(2) == '/'
        
        if is_self_close:
            continue
        
        if is_close:
            tags.append(('close', tag_name[1:]))
        else:
            tags.append(('open', tag_name))
    return tags

brace_level = 0
paren_level = 0

for idx in range(5499, 7395): # lines 5500 to 7395
    line_num = idx + 1
    line = lines[idx]
    
    # update brace and paren level
    for char in line:
        if char == '{':
            brace_level += 1
        elif char == '}':
            brace_level -= 1
        elif char == '(':
            paren_level += 1
        elif char == ')':
            paren_level -= 1
            
    # update tag stack
    tags = get_tags(line)
    for action, tag_name in tags:
        if action == 'open':
            stack.append((line_num, tag_name))
        else:
            if stack:
                last_line, last_tag = stack.pop()
                if last_tag != tag_name:
                    print(f"Tag mismatch at line {line_num}: closed </{tag_name}> but expected </{last_tag}> (opened at line {last_line})")
            else:
                print(f"Mismatched closing tag </{tag_name}> at line {line_num}")

print(f"At line 7395: brace_level={brace_level}, paren_level={paren_level}")
if stack:
    print("Unclosed JSX tags at line 7395:")
    for line_num, tag_name in stack:
        print(f"  <{tag_name}> opened at line {line_num}")
