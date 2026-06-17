from PIL import Image

try:
    img = Image.open('public/images/rifx-logo-user.png').convert('RGBA')
    img = img.resize((120, 60)) # Resize for console output
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        line = ""
        for x in range(w):
            c = pixels[x, y]
            r, g, b, a = c
            if a < 50:
                line += " "
            elif r == 4 and g == 35 and b == 84:
                line += "#" # Background dark blue
            elif r < 50 and g < 50 and b > 50:
                line += "B" # Other dark blue
            elif r > 200 and g > 200 and b > 200:
                line += "W" # White
            else:
                line += "." # Other
        if line.strip() != "":
            print(line)
except Exception as e:
    print("Error:", e)
