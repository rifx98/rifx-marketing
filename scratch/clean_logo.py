from PIL import Image

def clean_logo():
    img = Image.open('public/images/rifx-logo-user.png').convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        # Check if it's the dark blue background
        r, g, b, a = item
        if a > 10 and r < 15 and g > 15 and g < 60 and b > 50 and b < 100:
            new_data.append((255, 255, 255, 0)) # transparent
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save('public/images/rifx-logo-clean.png', "PNG")
    print("Cleaned logo saved.")

if __name__ == '__main__':
    clean_logo()
