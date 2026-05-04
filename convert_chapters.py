import re
import os

def process_inline(text):
    # Bold
    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'__(.*?)__', r'<strong>\1</strong>', text)
    # Italic
    text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
    text = re.sub(r'_(.*?)_', r'<em>\1</em>', text)
    # Inline code
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    return text

def md_to_html(md_content):
    # Remove citation references like （参见：Cui 2025, §1.1, pp.1-3）
    md_content = re.sub(r'（参见：[^）]+）', '', md_content)
    md_content = re.sub(r'\(参见：[^\)]+\)', '', md_content)
    
    lines = md_content.split('\n')
    html_lines = []
    in_table = False
    table_rows = []
    in_code_block = False
    code_lines = []
    in_div = False
    div_depth = 0
    in_list = False
    list_type = None
    
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Handle HTML divs (preserve as-is)
        if stripped.startswith('<div'):
            in_div = True
            div_depth += 1
            html_lines.append(line)
            i += 1
            continue
        
        if stripped.startswith('</div>'):
            div_depth -= 1
            if div_depth == 0:
                in_div = False
            html_lines.append(line)
            i += 1
            continue
        
        if in_div:
            html_lines.append(line)
            i += 1
            continue
        
        # Handle code blocks
        if stripped.startswith('```'):
            if in_code_block:
                in_code_block = False
                html_lines.append('<pre><code>' + '\n'.join(code_lines) + '</code></pre>')
                code_lines = []
            else:
                in_code_block = True
            i += 1
            continue
        
        if in_code_block:
            code_lines.append(line)
            i += 1
            continue
        
        # Handle tables
        if '|' in stripped and not stripped.startswith('#') and not stripped.startswith('*') and not stripped.startswith('-'):
            if not in_table:
                in_table = True
                table_rows = []
            # Skip separator lines
            if not re.match(r'^\|[\s\-\:=|]+\|$', stripped) and not re.match(r'^[\s\-\:=|]+$', stripped.replace('|', '')):
                table_rows.append(stripped)
            i += 1
            continue
        else:
            if in_table:
                if table_rows:
                    html_lines.append('<table>')
                    for j, row in enumerate(table_rows):
                        cells = [c.strip() for c in row.split('|')]
                        cells = [c for c in cells if c]
                        if j == 0:
                            html_lines.append('  <thead>')
                            html_lines.append('    <tr>' + ''.join(['<th>' + c + '</th>' for c in cells]) + '</tr>')
                            html_lines.append('  </thead>')
                            html_lines.append('  <tbody>')
                        else:
                            html_lines.append('    <tr>' + ''.join(['<td>' + c + '</td>' for c in cells]) + '</tr>')
                    html_lines.append('  </tbody>')
                    html_lines.append('</table>')
                in_table = False
                table_rows = []
        
        # Handle headings
        if stripped.startswith('# '):
            title = stripped[2:]
            html_lines.append(f'<h1>{title}</h1>')
        elif stripped.startswith('## '):
            title = stripped[3:]
            html_lines.append(f'<h2>{title}</h2>')
        elif stripped.startswith('### '):
            title = stripped[4:]
            html_lines.append(f'<h3>{title}</h3>')
        elif stripped.startswith('#### '):
            title = stripped[5:]
            html_lines.append(f'<h4>{title}</h4>')
        elif stripped == '---' or stripped == '***':
            html_lines.append('<hr>')
        elif stripped == '':
            html_lines.append('')
        elif re.match(r'^(\d+)\.\s', stripped):
            match = re.match(r'^(\d+)\.\s+(.*)', stripped)
            if match:
                content = process_inline(match.group(2))
                html_lines.append(f'<li>{content}</li>')
        elif stripped.startswith('- ') or stripped.startswith('* '):
            content = process_inline(stripped[2:])
            html_lines.append(f'<li>{content}</li>')
        else:
            content = process_inline(stripped)
            html_lines.append(f'<p>{content}</p>')
        
        i += 1
    
    if in_table and table_rows:
        html_lines.append('<table>')
        for j, row in enumerate(table_rows):
            cells = [c.strip() for c in row.split('|')]
            cells = [c for c in cells if c]
            if j == 0:
                html_lines.append('  <thead>')
                html_lines.append('    <tr>' + ''.join(['<th>' + c + '</th>' for c in cells]) + '</tr>')
                html_lines.append('  </thead>')
                html_lines.append('  <tbody>')
            else:
                html_lines.append('    <tr>' + ''.join(['<td>' + c + '</td>' for c in cells]) + '</tr>')
        html_lines.append('  </tbody>')
        html_lines.append('</table>')
    
    return '\n'.join(html_lines)

chapters = [
    ('part1/ch01_introduction.md', 'ch01.html'),
    ('part1/ch02_optical_lithography.md', 'ch02.html'),
    ('part1/ch03_electron_beam_lithography.md', 'ch03.html'),
    ('part2/ch04_focused_ion_beam.md', 'ch04.html'),
    ('part2/ch05_scanning_probe_lithography.md', 'ch05.html'),
    ('part2/ch06_nanoimprint_lithography.md', 'ch06.html'),
    ('part3/ch07_etching.md', 'ch07.html'),
    ('part3/ch08_deposition.md', 'ch08.html'),
    ('part3/ch09_self_assembly.md', 'ch09.html'),
    ('part4/ch10_substrates.md', 'ch10.html'),
    ('part4/ch11_process_recipes.md', 'ch11.html'),
    ('part4/ch12_applications.md', 'ch12.html'),
]

base_input = '/Users/xh_tian/Workspaces/nanofab-web/nanofab_knowledge_book_v1/content'
base_output = '/Users/xh_tian/Workspaces/nanofab-web/content/chapters'

for input_file, output_file in chapters:
    input_path = os.path.join(base_input, input_file)
    output_path = os.path.join(base_output, output_file)
    
    with open(input_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    html_content = md_to_html(md_content)
    final_html = f'<div class="chapter-content">\n{html_content}\n</div>'
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_html)
    
    print(f'Converted {input_file} -> {output_file}')

print('\nAll chapters converted successfully!')
