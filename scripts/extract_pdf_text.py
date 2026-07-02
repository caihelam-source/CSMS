import pdfplumber
import json
import re
import os

files = [
    ('D:/BaiduSyncdisk/CNC接收文件/HK Companies/Easy Rich/NAR1 - Easy Rich Corporation Ltd 2026.pdf', 'Easy Rich'),
    ('D:/BaiduSyncdisk/CNC接收文件/HK Companies/Zhong An Travel/NAR1- Zhong An Travel Ltd 2026.pdf', 'Zhong An Travel'),
    ('D:/BaiduSyncdisk/CNC接收文件/HK Companies/Huijun/NAR1 - HuiJun (International) Holdings Ltd 2026.pdf', 'Huijun'),
    ('D:/BaiduSyncdisk/CNC接收文件/HK Companies/HK Time Honour Property Limited/NAR1 - Hong Kong Time Honour Property Ltd 2025.pdf', 'HK Time Honour'),
    ('D:/BaiduSyncdisk/CNC接收文件/HK Companies/Pannix Industrial/NAR1 - Pannix Industrial (Hong Kong) Limited 2025.pdf', 'Pannix'),
]

output_dir = 'C:/Users/Vincent/WorkBuddy/Claw/scripts/pdf_extracts'
os.makedirs(output_dir, exist_ok=True)

for filepath, short_name in files:
    print(f'\n{"="*60}')
    print(f'Processing: {short_name}')
    print(f'File: {filepath.split("/")[-1]}')
    print(f'{"="*60}')
    
    try:
        with pdfplumber.open(filepath) as pdf:
            full_text = ''
            for i, page in enumerate(pdf.pages):
                t = page.extract_text()
                if t:
                    full_text += f'\n\n===== PAGE {i+1} =====\n'
                    full_text += t
            
            # Save full text
            txt_path = os.path.join(output_dir, f'{short_name.replace(" ", "_")}.txt')
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(full_text)
            print(f'Saved full text to: {txt_path}')
            print(f'Total pages: {len(pdf.pages)}')
            print(full_text[:500])
            print('...')
            
    except Exception as e:
        print(f'ERROR: {e}')
        import traceback
        traceback.print_exc()

print('\nDone! All texts saved to:', output_dir)
