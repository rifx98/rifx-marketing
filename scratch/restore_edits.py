import json
import os

log_path = r"C:\Users\x\.gemini\antigravity-ide\brain\5d8011c1-691e-4280-9436-92778ba29bb4\.system_generated\logs\transcript.jsonl"
target_file = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"

edits = []

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            # Find tool calls
            tool_calls = step.get('tool_calls', [])
            if not tool_calls and 'content' in step:
                # Sometimes it might be in different format depending on logs structure, 
                # let's look at the structure we got from Select-String earlier:
                # {"step_index":1716,"source":"MODEL","type":"PLANNER_RESPONSE","status":"DONE",... "tool_calls":[...]}
                pass
            
            for tc in tool_calls:
                name = tc.get('name')
                args = tc.get('args', {})
                # Check if it is a replace tool call on panel-client.tsx
                if name in ('replace_file_content', 'multi_replace_file_content'):
                    # normalize file path
                    tf = args.get('TargetFile', '').replace('\\\\', '\\').replace('"', '').lower()
                    if 'panel-client.tsx' in tf:
                        edits.append({
                            'step_index': step.get('step_index'),
                            'name': name,
                            'args': args
                        })
        except Exception as e:
            pass

print(f"Found {len(edits)} edits on panel-client.tsx")
# Save them to a file for review
output_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\scratch\extracted_edits.json"
with open(output_path, 'w', encoding='utf-8') as out:
    json.dump(edits, out, indent=2, ensure_ascii=False)
print(f"Saved to {output_path}")
