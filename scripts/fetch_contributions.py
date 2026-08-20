import os
import json
import re
import requests
from bs4 import BeautifulSoup

def parse_count(text):
    if not text or "No contributions" in text:
        return 0
    match = re.search(r'^(\d+)\s+contribution', text)
    if match:
        return int(match.group(1))
    return 0

def fetch_contributions(username):
    url = f"https://github.com/users/{username}/contributions"
    response = requests.get(url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    
    days = []
    
    tooltips = {}
    for tt in soup.find_all('tool-tip'):
        target_id = tt.get('for', '')
        if target_id:
            tooltips[target_id] = tt.get_text(strip=True)
            
    cells = soup.find_all('td', attrs={"data-date": True})
    for cell in cells:
        date = cell.get('data-date')
        level = int(cell.get('data-level', 0))
        
        count = 0
        cell_id = cell.get('id')
        if cell_id and cell_id in tooltips:
            count = parse_count(tooltips[cell_id])
        else:
            sr_text = cell.find('span', class_='sr-only')
            if sr_text:
                count = parse_count(sr_text.get_text(strip=True))
        
        days.append({
            "date": date,
            "level": level,
            "count": count
        })
        
    return days

def compute_stats(days):
    total = sum(d['count'] for d in days)
    
    days.sort(key=lambda x: x['date'])
    
    longest_streak = 0
    best_day = {"date": None, "count": 0}
    
    streak = 0
    for d in days:
        if d['count'] > 0:
            streak += 1
            if streak > longest_streak:
                longest_streak = streak
        else:
            streak = 0
            
        if d['count'] > best_day['count']:
            best_day = {"date": d['date'], "count": d['count']}
            
    current_streak = 0
    for d in reversed(days):
        if d['count'] > 0:
            current_streak += 1
        else:
            break
            
    return {
        "total": total,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "best_day": best_day
    }

def main():
    username = "Aamirbadar07"
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    data_dir = os.path.join(repo_root, "data")
    os.makedirs(data_dir, exist_ok=True)
    out_file = os.path.join(data_dir, "contributions.json")
    
    print(f"Fetching contributions for {username}...")
    days = fetch_contributions(username)
    
    if not days:
        print("No contribution data found. Please check the markup or username.")
        return
        
    stats = compute_stats(days)
    
    output = {
        "days": days,
        "stats": stats
    }
    
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
        
    print(f"Saved data to {out_file}")
    print(f"Total Contributions: {stats['total']}")
    print(f"Current Streak: {stats['current_streak']}")
    print(f"Longest Streak: {stats['longest_streak']}")
    print(f"Best Day: {stats['best_day']['date']} with {stats['best_day']['count']} contributions")

if __name__ == "__main__":
    main()
