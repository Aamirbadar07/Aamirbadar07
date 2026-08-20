import os
import sys
from PIL import Image
from xml.sax.saxutils import escape

# Constants
ASCII_RAMP = ' .`:-=+*cs#%@'
FONT_SIZE = 7
CHAR_WIDTH = 4.2  # Approximate width for monospace at 7px
LINE_HEIGHT = 7.5

def get_repo_root():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(current_dir)

def create_ascii_svg():
    repo_root = get_repo_root()
    input_path = os.path.join(repo_root, 'source-prepped.png')
    output_path = os.path.join(repo_root, 'aamir-ascii.svg')
    
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} not found.")
        return
        
    try:
        img = Image.open(input_path).convert('L')
    except Exception as e:
        print(f"Error loading image: {e}")
        return
        
    orig_width, orig_height = img.size
    
    # Resize to character grid: ~100 columns wide
    cols = 100
    aspect_ratio = orig_height / orig_width
    # Characters are ~0.55x as wide as tall
    rows = int(cols * aspect_ratio * 0.55)
    
    img = img.resize((cols, rows), Image.Resampling.LANCZOS)
    
    # Convert pixels to ASCII
    ascii_grid = []
    ramp_len = len(ASCII_RAMP) - 1
    
    for y in range(rows):
        row_chars = []
        for x in range(cols):
            pixel = img.getpixel((x, y))
            # 255 = white = space (bright), 0 = black = @ (dark)
            index = int((255 - pixel) / 255.0 * ramp_len)
            index = max(0, min(ramp_len, index))
            row_chars.append(ASCII_RAMP[index])
        ascii_grid.append("".join(row_chars))
        
    # Skip rows that are entirely spaces (blank rows at top/bottom)
    start_row = 0
    while start_row < rows and not ascii_grid[start_row].strip():
        start_row += 1
        
    end_row = rows - 1
    while end_row >= 0 and not ascii_grid[end_row].strip():
        end_row -= 1
        
    if start_row > end_row:
        print("Image is entirely blank/white.")
        return
        
    ascii_grid = ascii_grid[start_row:end_row + 1]
    rows = len(ascii_grid)
    
    # Calculate SVG dimensions
    width_px = cols * CHAR_WIDTH + 10  # small padding
    height_px = rows * LINE_HEIGHT + 10
    
    delay_per_row = 0.04  # 40ms stagger per row
    wipe_duration = 0.3   # each row wipe takes 0.3s
    
    # Build animation CSS — one class per row for staggered delay
    css_lines = []
    css_lines.append('<style>')
    css_lines.append('  text.ascii-row {')
    css_lines.append("    font-family: 'Consolas', 'Courier New', monospace;")
    css_lines.append(f'    font-size: {FONT_SIZE}px;')
    css_lines.append('    fill: #c9d1d9;')
    css_lines.append('    white-space: pre;')
    css_lines.append('    opacity: 0;')
    css_lines.append('    animation-name: wipe;')
    css_lines.append(f'    animation-duration: {wipe_duration}s;')
    css_lines.append('    animation-fill-mode: forwards;')
    css_lines.append('    animation-timing-function: linear;')
    css_lines.append('  }')
    css_lines.append('  @keyframes wipe {')
    css_lines.append('    0%   { clip-path: inset(0 100% 0 0); opacity: 1; }')
    css_lines.append('    100% { clip-path: inset(0 0% 0 0);   opacity: 1; }')
    css_lines.append('  }')
    # Per-row delay classes
    for i in range(rows):
        delay = i * delay_per_row
        css_lines.append(f'  .r{i} {{ animation-delay: {delay:.3f}s; }}')
    css_lines.append('</style>')
    
    # Build SVG
    svg_lines = []
    svg_lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width_px:.1f} {height_px:.1f}" width="{width_px:.0f}" height="{height_px:.0f}">')
    svg_lines.extend(css_lines)
    
    total_chars = 0
    for i, row_text in enumerate(ascii_grid):
        total_chars += len(row_text)
        y_pos = (i + 1) * LINE_HEIGHT
        escaped_text = escape(row_text)
        svg_lines.append(f'<text x="5" y="{y_pos:.1f}" class="ascii-row r{i}" xml:space="preserve">{escaped_text}</text>')
    
    svg_lines.append('</svg>')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(svg_lines))
        
    total_duration = rows * delay_per_row + wipe_duration
    print(f"ASCII SVG Stats:")
    print(f"  Grid: {cols} cols x {rows} rows")
    print(f"  Total chars: {total_chars}")
    print(f"  Animation duration: {total_duration:.2f}s")
    print(f"  Saved to {output_path}")

if __name__ == "__main__":
    create_ascii_svg()
