import re
import json

log_path = r"C:\Users\x\.gemini\antigravity-ide\brain\5d8011c1-691e-4280-9436-92778ba29bb4\.system_generated\logs\transcript.jsonl"

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        # Search for step index
        step_match = re.search(r'"step_index":\s*(\d+)', line)
        if not step_match:
            continue
        step_idx = int(step_match.group(1))
        
        # We only care about edits on panel-client.tsx
        if 'panel-client.tsx' not in line.lower():
            continue
            
        print(f"--- STEP {step_idx} ---")
        
        # Check if it contains replace_file_content or multi_replace_file_content
        if 'replace_file_content' in line:
            # Try to find TargetContent and ReplacementContent using regex
            target_match = re.search(r'"TargetContent":\s*"(.*?)"\s*,\s*"ReplacementContent"', line)
            if not target_match:
                # try alternative order
                target_match = re.search(r'"TargetContent":\s*"(.*?)"', line)
            
            repl_match = re.search(r'"ReplacementContent":\s*"(.*?)"', line)
            
            if target_match:
                print("TargetContent len:", len(target_match.group(1)))
            if repl_match:
                print("ReplacementContent len:", len(repl_match.group(1)))
                
        if 'multi_replace_file_content' in line:
            # Find ReplacementChunks string
            chunks_match = re.search(r'"ReplacementChunks":\s*"(.*?)"', line)
            if chunks_match:
                print("ReplacementChunks len:", len(chunks_match.group(1)))
            else:
                # Maybe it is not a string but an array
                chunks_match_arr = re.search(r'"ReplacementChunks":\s*\[(.*?)\]', line)
                if chunks_match_arr:
                    print("ReplacementChunks array len:", len(chunks_match_arr.group(1)))
