import json

log_path = r"C:\Users\x\.gemini\antigravity-ide\brain\5d8011c1-691e-4280-9436-92778ba29bb4\.system_generated\logs\transcript.jsonl"

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line, strict=False)
            if step.get('step_index') == 73:
                print(json.dumps(step, indent=2))
                break
        except Exception as e:
            print("Err parsing line:", e)
