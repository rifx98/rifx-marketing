import os

def main():
    dir_path = 'app/api'
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith('.ts') or file.endswith('.js'):
                full_path = os.path.join(root, file)
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    for idx, line in enumerate(lines, 1):
                        if ".from('config')" in line or '.from("config")' in line:
                            print(f'=== File: {full_path} ===')
                            start = max(0, idx-3)
                            end = min(len(lines), idx+5)
                            for i in range(start, end):
                                print(f'{i+1}: {lines[i].strip()}')
                            print('---')
                except Exception as e:
                    print(f"Error reading {full_path}: {e}")

if __name__ == '__main__':
    main()
