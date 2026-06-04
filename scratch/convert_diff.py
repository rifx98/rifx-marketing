import os

input_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\scratch\current_diff.txt"
output_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\scratch\current_diff_utf8.txt"

# Try reading as UTF-16
try:
    with open(input_path, 'r', encoding='utf-16') as f:
        content = f.read()
    print("Read successfully as UTF-16")
except Exception as e:
    print("Failed to read as UTF-16:", e)
    # Try reading as UTF-8
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()
        print("Read successfully as UTF-8")
    except Exception as e:
        print("Failed to read as UTF-8:", e)
        # Try reading as ISO-8859-1
        with open(input_path, 'r', encoding='iso-8859-1') as f:
            content = f.read()
        print("Read successfully as ISO-8859-1")

# Save as UTF-8
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Saved to {output_path}")
print("First 10 lines of converted file:")
print('\n'.join(content.split('\n')[:10]))
