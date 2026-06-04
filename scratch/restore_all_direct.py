import json
import os

log_path = r"C:\Users\x\.gemini\antigravity-ide\brain\5d8011c1-691e-4280-9436-92778ba29bb4\.system_generated\logs\transcript.jsonl"
target_file = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"

# Read target file content
with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

edits = []

# Read lines from log
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line, strict=False)
            tool_calls = step.get('tool_calls', [])
            for tc in tool_calls:
                name = tc.get('name')
                args = tc.get('args', {})
                if name in ('replace_file_content', 'multi_replace_file_content'):
                    tf = args.get('TargetFile', '').replace('\\\\', '\\').replace('"', '').lower()
                    if 'panel-client.tsx' in tf:
                        edits.append({
                            'step_index': step.get('step_index'),
                            'name': name,
                            'args': args
                        })
        except Exception as e:
            pass

# Sort by step_index
edits.sort(key=lambda x: x['step_index'])

print(f"Found {len(edits)} edits in log.")

applied_count = 0
skipped_count = 0

for edit in edits:
    step_idx = edit['step_index']
    name = edit['name']
    args = edit['args']
    
    # Restoring everything before our current turn (which starts around step_index 1700)
    if step_idx >= 1700:
        continue

    if name == 'replace_file_content':
        target = args.get('TargetContent')
        replacement = args.get('ReplacementContent')
        if not target or not replacement:
            continue
            
        if target in content:
            content = content.replace(target, replacement)
            applied_count += 1
            print(f"Step {step_idx}: Applied replace_file_content")
        else:
            target_lf = target.replace('\r\n', '\n')
            content_lf = content.replace('\r\n', '\n')
            if target_lf in content_lf:
                content_lf = content_lf.replace(target_lf, replacement.replace('\r\n', '\n'))
                content = content_lf.replace('\n', '\r\n')
                applied_count += 1
                print(f"Step {step_idx}: Applied replace_file_content (LF normalized)")
            else:
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
            applied_count += 1
            print(f"Step {step_idx}: Applied multi_replace_file_content")
        else:
            skipped_count += 1

# Write back to file
with open(target_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nCompleted restoration. Applied: {applied_count}, Skipped: {skipped_count}")
