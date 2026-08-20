import os
import json
from datetime import datetime

# Configuration
CELL_SIZE = 11
CELL_GAP = 3
STEP = CELL_SIZE + CELL_GAP
PAD_LEFT = 40
PAD_TOP = 30
PAD_BOTTOM = 40
WIDTH = 860
HEIGHT = PAD_TOP + (7 * STEP) + PAD_BOTTOM

COLORS = {
    0: "#161b22",
    1: "#0e4429",
    2: "#006d32",
    3: "#26a641",
    4: "#39d353"
}

def render_heatmap():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    data_path = os.path.join(repo_root, 'data', 'contributions.json')
    out_path = os.path.join(repo_root, 'contrib-heatmap.svg')

    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Data file not found: {data_path}")
        return

    days = data.get('days', [])
    total_contribs = data.get('stats', {}).get('total', 0)

    # Group into columns
    columns = []
    current_col = []
    
    for day in days:
        dt = datetime.strptime(day['date'], '%Y-%m-%d')
        row_idx = (dt.weekday() + 1) % 7  # Sunday = 0
        if row_idx == 0 and current_col:
            columns.append(current_col)
            current_col = []
        current_col.append((row_idx, day, dt))
    
    if current_col:
        columns.append(current_col)

    # SVG generation
    svg_elements = [
        f'<svg width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" xmlns="http://www.w3.org/2000/svg">',
        '  <style>',
        '    :root {',
        '      --color-bg: #0d1117;',
        '      --color-text: #8b949e;',
        '      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", monospace;',
        '    }',
        '    svg {',
        '      background-color: var(--color-bg);',
        '      font-family: var(--font-family);',
        '    }',
        '    text {',
        '      fill: var(--color-text);',
        '      font-size: 12px;',
        '    }',
        '    .day-label {',
        '      font-size: 9px;',
        '    }',
        '    .month-label {',
        '      font-size: 10px;',
        '    }',
        '    .col {',
        '      opacity: 0;',
        '      animation: fadeInSlideUp 0.8s forwards;',
        '    }',
        '    @keyframes fadeInSlideUp {',
        '      0% { opacity: 0; transform: translateY(10px); }',
        '      100% { opacity: 1; transform: translateY(0); }',
        '    }',
        '  </style>',
        '  <rect width="100%" height="100%" fill="#0d1117" />'
    ]

    # Day labels (Mon, Wed, Fri) -> rows 1, 3, 5
    day_labels = {1: "Mon", 3: "Wed", 5: "Fri"}
    for r, label in day_labels.items():
        y = PAD_TOP + r * STEP + 10
        svg_elements.append(f'  <text x="10" y="{y}" class="day-label">{label}</text>')

    months_seen = set()
    grid_svg = []
    
    for col_idx, col in enumerate(columns):
        x = PAD_LEFT + col_idx * STEP
        delay = col_idx * 0.03
        
        # Check for month label
        if col:
            first_day_dt = col[0][2]
            month_name = first_day_dt.strftime("%b")
            if month_name not in months_seen:
                months_seen.add(month_name)
                # Only add if we have enough space (e.g. not the very first column if it's end of month)
                # For simplicity, just add at this column
                if col_idx < len(columns) - 2 or len(months_seen) == 1:
                    svg_elements.append(f'  <text x="{x}" y="{PAD_TOP - 8}" class="month-label">{month_name}</text>')

        grid_svg.append(f'  <g class="col" style="animation-delay: {delay}s;">')
        for row_idx, day, dt in col:
            y = PAD_TOP + row_idx * STEP
            level = day.get('level', 0)
            color = COLORS.get(level, COLORS[0])
            title = f"{day.get('count', 0)} contributions on {day['date']}"
            
            rect = f'    <rect x="{x}" y="{y}" width="{CELL_SIZE}" height="{CELL_SIZE}" rx="2" fill="{color}"><title>{title}</title></rect>'
            grid_svg.append(rect)
        grid_svg.append('  </g>')

    svg_elements.extend(grid_svg)

    # Footer and Legend
    footer_y = PAD_TOP + (7 * STEP) + 20
    svg_elements.append(f'  <text x="{PAD_LEFT}" y="{footer_y}" style="font-size: 11px;">{total_contribs} contributions in the last year</text>')

    # Legend
    legend_x = WIDTH - 150
    legend_y = footer_y - 10
    svg_elements.append(f'  <g transform="translate({legend_x}, {legend_y})">')
    svg_elements.append('    <text x="0" y="9" style="font-size: 11px;">Less</text>')
    
    for i in range(5):
        lx = 30 + i * STEP
        color = COLORS[i]
        svg_elements.append(f'    <rect x="{lx}" y="0" width="{CELL_SIZE}" height="{CELL_SIZE}" rx="2" fill="{color}" />')
    
    svg_elements.append(f'    <text x="{30 + 5 * STEP + 5}" y="9" style="font-size: 11px;">More</text>')
    svg_elements.append('  </g>')

    svg_elements.append('</svg>')

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(svg_elements))
        
    print(f"Heatmap SVG rendered at {out_path}")

if __name__ == "__main__":
    render_heatmap()
