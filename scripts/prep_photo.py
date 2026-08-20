import sys
import os
import cv2
import numpy as np
from PIL import Image
from rembg import remove

def preprocess_image(input_path, output_path):
    print(f"Loading image from: {input_path}")
    try:
        input_image = Image.open(input_path)
    except Exception as e:
        print(f"Error loading image: {e}")
        return

    print("Removing background...")
    # rembg expects PIL image and returns PIL image when given PIL image.
    no_bg_image = remove(input_image)
    
    print("Converting to grayscale and applying CLAHE...")
    # Convert to numpy array
    no_bg_np = np.array(no_bg_image)
    
    # Handle RGBA from rembg
    if len(no_bg_np.shape) == 3 and no_bg_np.shape[2] == 4:
        # Split channels
        r, g, b, a = cv2.split(no_bg_np)
        
        # Convert RGB to Grayscale
        rgb_img = cv2.merge((r, g, b))
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)
        
        # Apply CLAHE
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        cl_gray = clahe.apply(gray)
        
        # Re-merge with Alpha channel
        clahe_rgba = cv2.merge((cl_gray, cl_gray, cl_gray, a))
        processed_image = Image.fromarray(clahe_rgba, 'RGBA')
    else:
        # If no alpha, just convert to gray and apply CLAHE
        if len(no_bg_np.shape) == 3:
            gray = cv2.cvtColor(no_bg_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = no_bg_np
            
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        cl_gray = clahe.apply(gray)
        processed_image = Image.fromarray(cl_gray, 'L')
    
    print("Compositing onto white background...")
    # Create white background
    white_bg = Image.new("RGBA", processed_image.size, "WHITE")
    
    # Paste processed image using alpha channel as mask if present
    if processed_image.mode == 'RGBA':
        white_bg.paste(processed_image, (0, 0), processed_image)
    else:
        white_bg.paste(processed_image, (0, 0))
    
    # Convert to RGB to remove alpha channel before saving as final image
    final_image = white_bg.convert("RGB")
    
    print(f"Saving output to: {output_path}")
    final_image.save(output_path)
    print("Done!")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
        if not os.path.isabs(input_file):
             input_file = os.path.join(os.getcwd(), input_file)
    else:
        input_file = os.path.join(repo_root, "source-photo.jpg")
        
    output_file = os.path.join(repo_root, "source-prepped.png")
    
    preprocess_image(input_file, output_file)
