import cv2
import numpy as np

img = cv2.imread('public/images/rifx-logo-particles-clean.png', cv2.IMREAD_UNCHANGED)
if img is None:
    print("Could not load image")
else:
    print(f"Image shape: {img.shape}")
    # Let's count how many pixels are completely white or glowing yellow
    # Image has B, G, R, A channels
    if img.shape[2] == 4:
        B, G, R, A = cv2.split(img)
        
        # Count total non-transparent pixels
        non_transparent = np.sum(A > 100)
        print(f"Non-transparent pixels (A>100): {non_transparent}")
        
        # Count pixels that are almost pure white
        white_pixels = np.sum((R > 240) & (G > 240) & (B > 240) & (A > 100))
        print(f"Almost pure white pixels (R,G,B>240, A>100): {white_pixels}")

        # Let's print a small ascii representation of the alpha channel to see if it's an oval!
        # Resize to 60x40
        small = cv2.resize(A, (60, 40))
        for y in range(small.shape[0]):
            line = ""
            for x in range(small.shape[1]):
                if small[y, x] > 200:
                    line += "@@"
                elif small[y, x] > 100:
                    line += ".."
                else:
                    line += "  "
            print(line)
    else:
        print("Image does not have alpha channel")
