import json
import os

target_file = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"
edits_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\scratch\extracted_edits.json"

# Read using strict=False
with open(edits_path, 'r', encoding='utf-8') as f:
    edits = json.loads(f.read(), strict=False)

# Sort edits by step_index in ascending order
edits.sort(key=lambda x: x['step_index'])

# Read current content of target file
with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

applied_count = 0
skipped_count = 0

for edit in edits:
    step_idx = edit['step_index']
    name = edit['name']
    args = edit['args']
    
    if step_idx >= 1700:
        print(f"Step {step_idx}: Skipping current turn edits")
        continue

    if name == 'replace_file_content':
        target = args.get('TargetContent')
        replacement = args.get('ReplacementContent')
        
        if not target or not replacement:
            continue
            
        if target in content:
            content = content.replace(target, replacement)
            print(f"Step {step_idx}: Applied replace_file_content")
            applied_count += 1
        else:
            target_lf = target.replace('\r\n', '\n')
            content_lf = content.replace('\r\n', '\n')
            if target_lf in content_lf:
                content_lf = content_lf.replace(target_lf, replacement.replace('\r\n', '\n'))
                content = content_lf.replace('\n', '\r\n')
                print(f"Step {step_idx}: Applied replace_file_content after LF normalization")
                applied_count += 1
            else:
                # print(f"Step {step_idx}: TargetContent not found, skipping")
                skipped_count += 1
                
    elif name == 'multi_replace_file_content':
        chunks = args.get('ReplacementChunks', [])
        if isinstance(chunks, str):
            try:
                chunks = json.loads(chunks, strict=False)
            except Exception as e:
                print(f"Step {step_idx}: Failed to parse chunks string: {e}")
                continue
                
        if not chunks:
            continue
            
        temp_content = content
        all_chunks_applied = True
        
        for i, chunk in enumerate(chunks):
            if isinstance(chunk, str):
                try:
                    chunk = json.loads(chunk, strict=False)
                except Exception as e:
                    all_chunks_applied = False
                    break
            target = chunk.get('TargetContent')
            replacement = chunk.get('ReplacementContent')
            if not target or not replacement:
                all_chunks_applied = False
                break
                
            if target in temp_content:
                temp_content = temp_content.replace(target, replacement)
            else:
                target_lf = target.replace('\r\n', '\n')
                temp_content_lf = temp_content.replace('\r\n', '\n')
                if target_lf in temp_content_lf:
                    temp_content_lf = temp_content_lf.replace(target_lf, replacement.replace('\r\n', '\n'))
                    temp_content = temp_content_lf.replace('\n', '\r\n')
                else:
                    all_chunks_applied = False
                    break
                    
        if all_chunks_applied:
            content = temp_content
            print(f"Step {step_idx}: Applied multi_replace_file_content")
            applied_count += 1
        else:
            skipped_count += 1

# Write back the restored content
with open(target_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone! Applied: {applied_count}, Skipped: {skipped_count}")
