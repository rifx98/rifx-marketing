from PIL import Image

def get_char(r, g, b, a):
    if a < 50:
        return " "
    # White
    if r > 200 and g > 200 and b > 200:
        return "W"
    # Dark blue
    if r < 100 and g < 100 and b > 100:
        return "B"
    # Orange
    if r > 180 and g > 80 and b < 100:
        return "O"
    return "."

try:
    img = Image.open('public/images/rifx-logo-user.png').convert('RGBA')
    img = img.resize((120, 60)) # Resize for console output
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        line = ""
        for x in range(w):
            c = pixels[x, y]
            line += get_char(c[0], c[1], c[2], c[3])
        if line.strip() != "":
            print(line)
except Exception as e:
    print("Error:", e)
