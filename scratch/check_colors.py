from PIL import Image
img = Image.open('public/images/rifx-logo-user.png').convert('RGBA')
pixels = img.load()
w, h = img.size

print("Colors in the top 10 rows:")
colors = set()
for y in range(500):
    for x in range(w):
        c = pixels[x, y]
        # Ignore exact black background
        if c[0] > 5 or c[1] > 5 or c[2] > 5:
            # We round colors to group them
            rounded = (round(c[0]/10)*10, round(c[1]/10)*10, round(c[2]/10)*10)
            colors.add(rounded)

for c in sorted(list(colors)):
    print(c)
