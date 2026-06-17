from PIL import Image

try:
    img = Image.open('public/images/rifx-logo-user-broken.png').convert('RGBA')
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            
            # Remove transparent pixels to speed up 3D later
            if a < 10:
                pixels[x, y] = (0, 0, 0, 0)
                continue
                
            # Filter orange planet
            # The planet has various shades of orange/brown/yellow
            # Orange is characterized by high Red, medium Green, low Blue
            if r > 100 and g > 40 and b < 160 and r > b and g < r:
                # Let's preserve the red tip of the rocket (high r, low g, low b)
                if r > 180 and g < 60 and b < 60:
                    continue # Keep red
                
                # Delete the orange pixel
                pixels[x, y] = (0, 0, 0, 0)

    img.save('public/images/rifx-logo-particles-clean.png')
    print("Successfully created rifx-logo-particles-clean.png")

except Exception as e:
    print("Error:", e)
