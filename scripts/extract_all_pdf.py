import pdfplumber
import json, re

files = [
    ('Easy Rich Corporation Ltd', 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/Easy Rich/NAR1 - Easy Rich Corporation Ltd 2026.pdf'),
    ('Zhong An Travel Ltd', 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/Zhong An Travel/NAR1- Zhong An Travel Ltd 2026.pdf'),
    ('Huijun (International) Holdings Ltd', 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/Huijun/NAR1 - HuiJun (International) Holdings Ltd 2026.pdf'),
    ('HK Time Honour Property Ltd', 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/HK Time Honour Property Limited/NAR1 - Hong Kong Time Honour Property Ltd 2025.pdf'),
    ('Pannix Industrial (Hong Kong) Ltd', 'D:/BaiduSyncdisk/CNC接收文件/HK Companies/Pannix Industrial/NAR1 - Pannix Industrial (Hong Kong) Limited 2025.pdf'),
]

out_dir = 'c:/Users/Vincent/WorkBuddy/Claw/scripts/pdf_extracts'
import os
os.makedirs(out_dir, exist_ok=True)

for name, path in files:
    safe = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    print(f'\n{"="*60}')
    print(f'EXTRACTING: {name}')
    print(f'{"="*60}')
    try:
        with pdfplumber.open(path) as pdf:
            full_text = ''
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    full_text += t + '\n'
            # Save raw text
            txt_path = f'{out_dir}/{safe}.txt'
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(full_text)
            print(f'Saved: {txt_path}')
            # Print full text for parsing
            print(full_text[:5000])
    except Exception as e:
        print(f'ERROR: {e}')
