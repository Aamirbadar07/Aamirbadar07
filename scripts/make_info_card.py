import os
import html

def generate_svg(static=False):
    width = 490
    height = 220
    bg_color = "#0d1117"
    value_color = "#ffffff"
    font_family = "Consolas, monospace"
    
    rows = [
        {"key": "Role", "value": "Cloud & AI Infrastructure Enthusiast", "color": "#f97583"},
        {"key": "Focus", "value": "Agentic AI + Cloud-Native Systems", "color": "#79c0ff"},
        {"key": "Stack", "value": "Python · AWS · GCP · LangChain · Docker", "color": "#56d364"},
        {"key": "OS", "value": "Linux / macOS", "color": "#d2a8ff"},
        {"key": "Editor", "value": "VS Code", "color": "#e3b341"}
    ]
    
    style = f"""
    .card {{
        font-family: {font_family};
        font-size: 14px;
        fill: {value_color};
    }}
    .title {{
        font-weight: bold;
        fill: #58a6ff;
    }}
"""
    if not static:
        style += """
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .anim {
        opacity: 0;
        animation: slideIn 0.4s forwards;
    }
"""
    else:
        style += """
    .anim {
        opacity: 1;
    }
"""

    elements = []
    
    # Title and separator
    title_delay = 0.5
    sep_delay = title_delay + 0.3
    
    delay_attr_title = f' style="animation-delay: {title_delay}s;"' if not static else ''
    delay_attr_sep = f' style="animation-delay: {sep_delay}s;"' if not static else ''
    
    elements.append(f'  <text x="20" y="40" class="card title anim"{delay_attr_title}>aamir@github</text>')
    elements.append(f'  <text x="20" y="55" class="card anim"{delay_attr_sep}>------------</text>')
    
    y_offset = 80
    current_delay = sep_delay + 0.3
    
    for row in rows:
        key_escaped = html.escape(row["key"])
        val_escaped = html.escape(row["value"])
        
        delay_attr = f' style="animation-delay: {current_delay}s;"' if not static else ''
        
        line = f'  <text x="20" y="{y_offset}" class="card anim"{delay_attr}><tspan fill="{row["color"]}" font-weight="bold">{key_escaped}</tspan>: {val_escaped}</text>'
        elements.append(line)
        
        y_offset += 25
        current_delay += 0.3
        
    elements_str = "\n".join(elements)
    
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <rect width="{width}" height="{height}" fill="{bg_color}" rx="8"/>
  <style>
{style}  </style>
{elements_str}
</svg>"""
    return svg

def main():
    static = os.environ.get('STATIC', '0') == '1'
    svg_content = generate_svg(static)
    
    # Determine output path relative to script location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(script_dir)
    output_path = os.path.join(parent_dir, "info-card.svg")
    
    # Ensure parent directory exists
    os.makedirs(parent_dir, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
        
    print(f"Generated info card at: {output_path}")

if __name__ == "__main__":
    main()
