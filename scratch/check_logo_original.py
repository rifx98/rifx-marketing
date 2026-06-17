from PIL import Image
img = Image.open('public/images/rifx-logo-user.png')
pixels = img.load()
w, h = img.size

min_x = w
for y in range(h):
    for x in range(w):
        if pixels[x, y][3] > 50:
            min_x = min(min_x, x)

print("Min X is:", min_x)

lines = []
for y in range(0, h, 2):
    line = ''
    has_pixel = False
    for x in range(min_x, min_x + 60, 2):
        if pixels[x, y][3] > 50:
            line += '#'
            has_pixel = True
        else:
            line += ' '
    if has_pixel:
        lines.append(f"{y:03d} " + line)

print('\n'.join(lines))
