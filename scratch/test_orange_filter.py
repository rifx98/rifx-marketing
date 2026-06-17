from PIL import Image

try:
    img = Image.open('public/images/rifx-logo-user-broken.png').convert('RGBA')
    img = img.resize((120, 60))
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        line = ""
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 50:
                line += " "
            elif r > 150 and g > 70 and g < 190 and b < 120:
                line += " " # Filtered orange
            else:
                line += "P" # Particle
        if line.strip() != "":
            print(line)
except Exception as e:
    print("Error:", e)
