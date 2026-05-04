#!/usr/bin/env python3
"""
Book build script for Nanofabrication: Principles, Techniques, and Practice.
Markdown chapters -> Jinja2 HTML -> WeasyPrint PDF
"""

from __future__ import annotations

import base64
import html
import mimetypes
import os
import re
import shutil
import subprocess

# Ensure Homebrew libraries are available (macOS, for WeasyPrint/pango/gobject)
_homebrew_lib = "/opt/homebrew/lib"
if os.path.isdir(_homebrew_lib):
    os.environ.setdefault("DYLD_LIBRARY_PATH", _homebrew_lib)
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote

from jinja2 import Environment, FileSystemLoader
from markdown_it import MarkdownIt
from mdit_py_plugins.footnote import footnote_plugin
from weasyprint import HTML

try:
    import latex2mathml.converter
    HAS_LATEX2MATHML = True
except ImportError:
    HAS_LATEX2MATHML = False

# Project paths
PROJECT_ROOT = Path(__file__).parent
CONTENT_DIR = PROJECT_ROOT / "content"
TEMPLATE_DIR = PROJECT_ROOT / "templates"
STYLES_DIR = PROJECT_ROOT / "styles"
OUTPUT_DIR = PROJECT_ROOT / "output"
DIAGRAMS_DIR = PROJECT_ROOT / "diagrams" / "svg"
IMAGES_DIR = PROJECT_ROOT / "images"

# Local PDF source mapping for citation links
# These are local-only file:// links — they only work when the PDFs exist on disk
_PROJECT_DIR = Path(__file__).resolve().parent.parent
SOURCE_PDF_MAP = {
    "Cui 2025": _PROJECT_DIR / "2025-Zheng Cui-Nanofabrication Principles, Capabilities and Limits.pdf",
    "Campbell 2008": _PROJECT_DIR / "2008-Stephen A. Campbell-Fabrication Engineering at the Micro and Nanoscale Ed3.pdf",
    "De Teresa 2020": _PROJECT_DIR / "2020-Teresa-Nanofabrication Nanolithography techniques and their applications.pdf",
}

# Mermaid CLI
MMDC_PATH = PROJECT_ROOT / "node_modules" / ".bin" / "mmdc"

# Ensure Homebrew paths are available (macOS)
_homebrew_bin = "/opt/homebrew/bin"
if os.path.isdir(_homebrew_bin) and _homebrew_bin not in os.environ.get("PATH", ""):
    os.environ["PATH"] = _homebrew_bin + ":" + os.environ.get("PATH", "")

# ============================================================
# BOOK METADATA
# ============================================================
BOOK_TITLE = "纳米制造技术"
BOOK_SUBTITLE = "原理、工艺与实践"
BOOK_AUTHOR = "基于 Cui (2025)、Campbell (2008)、De Teresa (2020) 及 Georgia Tech EBL Facility 编译"

# Citation pattern — Chinese format: （参见：...）
CITATION_PATTERN = re.compile(r'（参见：(.*?)）')
CITATION_SEPARATOR = '；'
CITATION_LABEL_STRIP = re.compile(r'^[^[\]<]*参见：')
FOOTNOTES_TITLE = "参考文献"

# Part definitions
PARTS = [
    {
        "number": "第一篇",
        "title": "光刻技术基础",
        "dir": "part1",
        "chapters": [
            ("ch01_introduction.md", "第一章", "纳米制造技术概论"),
            ("ch02_optical_lithography.md", "第二章", "光学光刻"),
            ("ch03_electron_beam_lithography.md", "第三章", "电子束光刻"),
        ],
    },
    {
        "number": "第二篇",
        "title": "直写与压印技术",
        "dir": "part2",
        "chapters": [
            ("ch04_focused_ion_beam.md", "第四章", "聚焦离子束加工"),
            ("ch05_scanning_probe_lithography.md", "第五章", "扫描探针光刻"),
            ("ch06_nanoimprint_lithography.md", "第六章", "纳米压印光刻"),
        ],
    },
    {
        "number": "第三篇",
        "title": "图形转移与自组装",
        "dir": "part3",
        "chapters": [
            ("ch07_etching.md", "第七章", "刻蚀与图形转移"),
            ("ch08_deposition.md", "第八章", "薄膜沉积技术"),
            ("ch09_self_assembly.md", "第九章", "自组装与间接纳米制造"),
        ],
    },
    {
        "number": "第四篇",
        "title": "工艺实践与应用",
        "dir": "part4",
        "chapters": [
            ("ch10_substrates.md", "第十章", "半导体衬底与热处理工艺"),
            ("ch11_process_recipes.md", "第十一章", "工艺配方手册"),
            ("ch12_applications.md", "第十二章", "应用前景与发展趋势"),
        ],
    },
]
# ============================================================


def find_mmdc() -> str | None:
    """Find the mmdc executable."""
    if MMDC_PATH.exists():
        return str(MMDC_PATH)
    global_mmdc = shutil.which("mmdc")
    if global_mmdc:
        return global_mmdc
    if shutil.which("npx"):
        try:
            result = subprocess.run(
                ["npx", "mmdc", "--version"],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0:
                return "npx mmdc"
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
    return None


def render_mermaid_svg(mermaid_source: str, mmdc_cmd: str) -> str | None:
    """Render a mermaid diagram to SVG string using mmdc."""
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / "diagram.mmd"
        output_path = Path(tmpdir) / "diagram.svg"
        input_path.write_text(mermaid_source, encoding="utf-8")

        cmd_parts = mmdc_cmd.split()
        config_path = PROJECT_ROOT / "mermaid.config.json"
        cmd = cmd_parts + [
            "-i", str(input_path),
            "-o", str(output_path),
            "-b", "transparent",
            "--quiet",
        ]
        if config_path.exists():
            cmd += ["--configFile", str(config_path)]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                timeout=30, cwd=str(PROJECT_ROOT),
            )
            if result.returncode != 0:
                print(f"    mmdc error: {result.stderr.strip()}")
                return None
            if output_path.exists():
                svg_content = output_path.read_text(encoding="utf-8")
                svg_content = re.sub(r'^<\?xml[^>]*\?>\s*', '', svg_content)
                svg_content = re.sub(r'<!DOCTYPE[^>]*>\s*', '', svg_content)
                return svg_content.strip()
        except subprocess.TimeoutExpired:
            print("    mmdc timed out")
        except FileNotFoundError:
            print(f"    mmdc not found: {mmdc_cmd}")
    return None


def render_mermaid_blocks(html_content: str, mmdc_cmd: str | None) -> tuple[str, bool]:
    """Replace mermaid code blocks with rendered SVGs."""
    pattern = re.compile(
        r'<pre><code class="language-mermaid">(.*?)</code></pre>',
        re.DOTALL,
    )
    diagram_count = 0
    rendered_count = 0

    def replace_block(match):
        nonlocal diagram_count, rendered_count
        diagram_count += 1
        mermaid_source = html.unescape(match.group(1)).strip()

        if mmdc_cmd:
            svg = render_mermaid_svg(mermaid_source, mmdc_cmd)
            if svg:
                rendered_count += 1
                return f'<div class="mermaid-diagram">\n{svg}\n</div>'

        escaped = html.escape(mermaid_source)
        return f'<pre class="mermaid">{escaped}</pre>'

    result = pattern.sub(replace_block, html_content)
    has_fallback = False
    if diagram_count > 0:
        if mmdc_cmd:
            print(f"  Mermaid: {rendered_count}/{diagram_count} diagrams rendered to SVG")
            if rendered_count < diagram_count:
                has_fallback = True
        else:
            print(f"  Mermaid: {diagram_count} diagrams left for client-side rendering")
            has_fallback = True
    return result, has_fallback


# URL-safe keys for the /pdf/<key> route
SOURCE_URL_KEYS = {
    "Cui 2025": "cui2025",
    "Campbell 2008": "campbell2008",
    "De Teresa 2020": "teresa2020",
}

# GT EBL: citation section keywords → website page URLs
_GT_BASE = "https://nanolithography.gatech.edu/"
GT_EBL_URL_MAP = {
    "Facility Overview":        f"{_GT_BASE}about.html",
    "Equipment Specifications": f"{_GT_BASE}about.html",
    "Equipment Vendors":        f"{_GT_BASE}links.html",
    "Software Tools":           f"{_GT_BASE}links.html",
    "Resist Materials Overview": f"{_GT_BASE}processes.html",
    "Process Comparison":       f"{_GT_BASE}processes.html",
    "Development Conditions":   f"{_GT_BASE}processes.html",
    "Quick Reference":          f"{_GT_BASE}processes.html",
    "PMMA Process":             f"{_GT_BASE}pmma.html",
    "PMMA Removal":             f"{_GT_BASE}pmma.html",
    "Metal Liftoff Methods":    f"{_GT_BASE}pmma.html",
    "ZEP520A Process":          f"{_GT_BASE}zep520a.html",
    "HSQ Process":              f"{_GT_BASE}HSQ.html",
    "HSQ Removal":              f"{_GT_BASE}HSQ.html",
    "ma-N 2403":                f"{_GT_BASE}ma-N_2403.html",
    "Etching":                  f"{_GT_BASE}etching.html",
    "Evaporation":              f"{_GT_BASE}evaporation.html",
    "Liftoff":                  f"{_GT_BASE}evaporation.html",
    "Reflectometry":            f"{_GT_BASE}reflectometry.html",
    "Current Research":         f"{_GT_BASE}current.html",
    "Proximity Effect":         f"{_GT_BASE}proximity_effect.html",
}


def _make_source_link(citation_text: str) -> str:
    """Convert citation text to a clickable link.

    - PDF sources (Cui/Campbell/De Teresa) → /pdf/<key>#page=N (local serve)
    - GT EBL → matching Georgia Tech website page (public URL)
    """
    # --- Check PDF sources first ---
    matched_source = None
    for source_key in SOURCE_PDF_MAP:
        if source_key in citation_text:
            matched_source = source_key
            break

    if matched_source:
        url_key = SOURCE_URL_KEYS.get(matched_source, "")
        if not url_key:
            return citation_text
        page_match = re.search(r'pp?\.(\d+)', citation_text)
        page_fragment = f'#page={page_match.group(1)}' if page_match else ''
        return (
            f'<a href="/pdf/{url_key}{page_fragment}" target="_blank" '
            f'title="在浏览器中打开源PDF" '
            f'class="fn-pdf-link">{citation_text}</a>'
        )

    # --- Check GT EBL ---
    if "GT EBL" in citation_text:
        # Find the best matching section keyword
        best_url = _GT_BASE  # fallback to homepage
        best_len = 0
        for keyword, url in GT_EBL_URL_MAP.items():
            if keyword in citation_text and len(keyword) > best_len:
                best_url = url
                best_len = len(keyword)
        return (
            f'<a href="{best_url}" target="_blank" '
            f'title="Georgia Tech EBL Facility" '
            f'class="fn-pdf-link">{citation_text}</a>'
        )

    return citation_text


def process_citations(raw_md: str, chapter_id: str) -> str:
    """Convert inline source citations to superscript footnotes."""
    footnotes: list[tuple[str, str | None]] = []
    md_link_re = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    html_link_re = re.compile(r'<a\s+href="([^"]+)"[^>]*>([^<]+)</a>')

    def _parse_citation_entries(inner: str) -> list[tuple[str, str | None]]:
        entries: list[tuple[str, str | None]] = []
        parts = inner.split(CITATION_SEPARATOR)
        for part in parts:
            part = part.strip()
            if not part:
                continue
            label_stripped = CITATION_LABEL_STRIP.sub('', part)
            if label_stripped.strip():
                part = label_stripped.strip()
            md_match = md_link_re.search(part)
            if md_match:
                entries.append((md_match.group(1), md_match.group(2)))
                continue
            html_match = html_link_re.search(part)
            if html_match:
                entries.append((html_match.group(2), html_match.group(1)))
                continue
            entries.append((part, None))
        return entries

    def _replace_in_segment(segment: str) -> str:
        def replacer(match):
            inner = match.group(1)
            entries = _parse_citation_entries(inner)
            if not entries:
                return match.group(0)
            sup_refs = []
            for display_text, url in entries:
                footnotes.append((display_text, url))
                n = len(footnotes)
                sup_refs.append(
                    f'<span id="fnref-{chapter_id}-{n}">'
                    f'<sup class="fn-ref">'
                    f'<a href="#fn-{chapter_id}-{n}">[{n}]</a>'
                    f'</sup></span>'
                )
            return ''.join(sup_refs)
        return CITATION_PATTERN.sub(replacer, segment)

    comment_pattern = re.compile(r'(<!--.*?-->)', re.DOTALL)
    parts = comment_pattern.split(raw_md)
    processed_parts = []
    for i, part in enumerate(parts):
        if i % 2 == 1:
            processed_parts.append(part)
        else:
            processed_parts.append(_replace_in_segment(part))
    result = ''.join(processed_parts)

    if footnotes:
        lines = [
            '', '---', '',
            '<div class="chapter-footnotes">',
            f'<div class="footnotes-title">{FOOTNOTES_TITLE}</div>',
            '<ol class="footnotes-list">',
        ]
        for i, (link_text, url) in enumerate(footnotes, start=1):
            if url:
                lines.append(
                    f'<li id="fn-{chapter_id}-{i}">'
                    f'<a href="{url}" target="_blank">{link_text}</a> '
                    f'<a href="#fnref-{chapter_id}-{i}" class="fn-back">&#8617;</a>'
                    f'</li>'
                )
            else:
                lines.append(
                    f'<li id="fn-{chapter_id}-{i}">'
                    f'{_make_source_link(link_text)} '
                    f'<a href="#fnref-{chapter_id}-{i}" class="fn-back">&#8617;</a>'
                    f'</li>'
                )
        lines.append('</ol>')
        lines.append('</div>')
        result = result + '\n'.join(lines)
    return result


def init_markdown():
    """Initialize markdown parser with plugins."""
    md = MarkdownIt("commonmark", {"html": True, "typographer": True})
    md.enable("table")
    footnote_plugin(md)
    return md


def read_chapter(part_dir: str, filename: str) -> str:
    """Read a chapter markdown file."""
    filepath = CONTENT_DIR / part_dir / filename
    if filepath.exists():
        return filepath.read_text(encoding="utf-8")
    print(f"  Warning: {filepath} not found, skipping.")
    return ""


def embed_images(html_content: str) -> str:
    """Replace image src references with base64 data URIs for self-contained HTML."""
    img_pattern = re.compile(r'(<img\s[^>]*?)src="(images/[^"]+)"', re.IGNORECASE)
    count = 0

    def replace_img(match):
        nonlocal count
        prefix = match.group(1)
        rel_path = match.group(2)
        img_path = PROJECT_ROOT / rel_path
        if not img_path.exists():
            # Also check IMAGES_DIR directly
            img_path = IMAGES_DIR / Path(rel_path).name
        if img_path.exists():
            mime_type, _ = mimetypes.guess_type(str(img_path))
            if mime_type is None:
                mime_type = "image/png"
            data = img_path.read_bytes()
            b64 = base64.b64encode(data).decode("ascii")
            count += 1
            return f'{prefix}src="data:{mime_type};base64,{b64}"'
        print(f"  Warning: Image {rel_path} not found, keeping reference as-is.")
        return match.group(0)

    result = img_pattern.sub(replace_img, html_content)
    if count > 0:
        print(f"  Images: {count} embedded as base64")
    return result


def process_diagram_refs(html_content: str) -> str:
    """Replace diagram references with inline SVG content."""
    def replace_diagram(match):
        diagram_name = match.group(1)
        svg_path = DIAGRAMS_DIR / f"{diagram_name}.svg"
        if svg_path.exists():
            svg_content = svg_path.read_text(encoding="utf-8")
            svg_content = re.sub(r'^<\?xml[^>]*\?>\s*', '', svg_content)
            svg_content = re.sub(r'<!DOCTYPE[^>]*>\s*', '', svg_content)
            return f'<div class="diagram">{svg_content.strip()}</div>'
        print(f"  Warning: Diagram {svg_path} not found.")
        return match.group(0)
    return re.sub(r'!\[diagram:([^\]]+)\]\([^)]*\)', replace_diagram, html_content)


def prerender_math(html_content: str) -> str:
    """Pre-render LaTeX math to MathML for PDF generation (WeasyPrint can't run JS).

    Finds $$...$$ (display math) and $...$ (inline math) in the HTML and
    converts them to MathML using latex2mathml.  Skips content inside
    <code>, <pre>, and <script> tags.
    """
    if not HAS_LATEX2MATHML:
        print("  Warning: latex2mathml not installed — math will appear as raw LaTeX in PDF")
        return html_content

    converted = 0
    errors = 0

    def _convert(latex: str, display: bool) -> str:
        nonlocal converted, errors
        try:
            mathml = latex2mathml.converter.convert(latex.strip())
            if display:
                # Change display attribute and wrap in a block div
                mathml = mathml.replace('display="inline"', 'display="block"')
                converted += 1
                return f'<div class="math-display">{mathml}</div>'
            else:
                converted += 1
                return f'<span class="math-inline">{mathml}</span>'
        except Exception as exc:
            errors += 1
            # Fall back to raw LaTeX so nothing is lost
            escaped = html.escape(latex)
            if display:
                return f'<div class="math-display math-error">$${escaped}$$</div>'
            return f'<span class="math-inline math-error">${escaped}$</span>'

    # Strategy: split the HTML into "protected" zones (tags where we must NOT
    # touch the content) and "text" zones (where math delimiters live).
    # Protected zones: <code>...</code>, <pre>...</pre>, <script>...</script>,
    # and HTML tags themselves (< ... >).
    protected_re = re.compile(
        r'(<pre[\s>].*?</pre>|<code[\s>].*?</code>|<script[\s>].*?</script>|<[^>]+>)',
        re.DOTALL,
    )

    # Math patterns — applied only to text segments
    # Display math first (greedy on the delimiters, non-greedy inside)
    display_re = re.compile(r'\$\$(.+?)\$\$', re.DOTALL)
    # Inline math: single $, but not preceded/followed by $ or digit
    # Negative look-behind for $ or digit, negative look-ahead for $ or digit
    inline_re = re.compile(r'(?<!\$)(?<!\d)\$(?!\$)(.+?)(?<!\$)\$(?!\$)(?!\d)', re.DOTALL)

    parts = protected_re.split(html_content)
    result_parts = []
    for i, part in enumerate(parts):
        if i % 2 == 1:
            # This is a protected zone — pass through unchanged
            result_parts.append(part)
        else:
            # Text zone — convert math
            part = display_re.sub(lambda m: _convert(m.group(1), display=True), part)
            part = inline_re.sub(lambda m: _convert(m.group(1), display=False), part)
            result_parts.append(part)

    result = ''.join(result_parts)
    if converted > 0 or errors > 0:
        print(f"  Math pre-render: {converted} converted, {errors} errors")
    return result


def build_html():
    """Build the complete HTML book."""
    print("Building HTML...")
    md = init_markdown()

    mmdc_cmd = find_mmdc()
    if mmdc_cmd:
        print(f"  Mermaid CLI found: {mmdc_cmd}")
    else:
        print("  Mermaid CLI (mmdc) not found — diagrams will use client-side rendering")

    needs_mermaid_js = False

    # Process front matter
    front_matter_html = ""
    front_matter_path = CONTENT_DIR / "00_front_matter.md"
    if front_matter_path.exists():
        raw_md = front_matter_path.read_text(encoding="utf-8")
        raw_md = process_citations(raw_md, "front_matter")
        front_matter_html = md.render(raw_md)
        front_matter_html = process_diagram_refs(front_matter_html)
        front_matter_html, has_fallback = render_mermaid_blocks(front_matter_html, mmdc_cmd)
        if has_fallback:
            needs_mermaid_js = True
        print("  Front matter processed.")

    # Process back matter
    back_matter_html = ""
    back_matter_path = CONTENT_DIR / "99_back_matter.md"
    if back_matter_path.exists():
        raw_md = back_matter_path.read_text(encoding="utf-8")
        raw_md = process_citations(raw_md, "back_matter")
        back_matter_html = md.render(raw_md)
        back_matter_html = process_diagram_refs(back_matter_html)
        back_matter_html, has_fallback = render_mermaid_blocks(back_matter_html, mmdc_cmd)
        if has_fallback:
            needs_mermaid_js = True
        print("  Back matter processed.")

    # Process all parts and chapters
    parts_data = []
    for part in PARTS:
        chapters_data = []
        for filename, ch_num, ch_title in part["chapters"]:
            raw_md = read_chapter(part["dir"], filename)
            if raw_md:
                chapter_id = filename.replace(".md", "")
                raw_md = process_citations(raw_md, chapter_id)
                html_content = md.render(raw_md)
                html_content = process_diagram_refs(html_content)
                html_content, has_fallback = render_mermaid_blocks(html_content, mmdc_cmd)
                if has_fallback:
                    needs_mermaid_js = True
                chapter_html = (
                    f'<h2><span class="chapter-number">{ch_num}</span>'
                    f'{ch_title}</h2>\n{html_content}'
                )
                chapters_data.append({
                    "id": chapter_id,
                    "title": f"{ch_num} {ch_title}",
                    "content": chapter_html,
                })
        parts_data.append({
            "number": part["number"],
            "title": part["title"],
            "chapters": chapters_data,
        })

    css_content = (STYLES_DIR / "book.css").read_text(encoding="utf-8")

    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("book.html")

    html_output = template.render(
        title=BOOK_TITLE,
        subtitle=BOOK_SUBTITLE,
        author=BOOK_AUTHOR,
        parts=parts_data,
        front_matter=front_matter_html,
        back_matter=back_matter_html,
        css_content=css_content,
        mermaid_fallback=needs_mermaid_js,
    )

    # Embed images as base64 for self-contained HTML
    html_output = embed_images(html_output)

    OUTPUT_DIR.mkdir(exist_ok=True)
    html_path = OUTPUT_DIR / "book.html"
    html_path.write_text(html_output, encoding="utf-8")
    print(f"  HTML written to {html_path}")
    return html_path


def build_pdf(html_path: Path):
    """Build PDF from HTML using WeasyPrint.

    Applies prerender_math() to convert LaTeX math delimiters into MathML
    so that WeasyPrint (which cannot execute client-side JavaScript / KaTeX)
    renders the formulas correctly.
    """
    print("Building PDF...")
    css_path = STYLES_DIR / "book.css"
    pdf_path = OUTPUT_DIR / "book.pdf"

    # Read the browser-oriented HTML and pre-render math for PDF
    html_content = html_path.read_text(encoding="utf-8")
    html_content = prerender_math(html_content)

    html_doc = HTML(string=html_content, base_url=str(PROJECT_ROOT))
    html_doc.write_pdf(str(pdf_path), stylesheets=[str(css_path)])

    print(f"  PDF written to {pdf_path}")
    return pdf_path


def main():
    """Main build pipeline."""
    print(f"{'='*50}")
    print(f"Building: {BOOK_TITLE}")
    print(f"{'='*50}")

    html_path = build_html()

    if "--html-only" in sys.argv:
        print("Skipping PDF (--html-only flag)")
    else:
        build_pdf(html_path)

    print(f"\n{'='*50}")
    print("Build complete!")
    print(f"{'='*50}")


BOOK_DIR = PROJECT_ROOT


def serve(port: int = 8765):
    """Start a dev server with PDF-open API endpoint."""
    import http.server
    import json

    serve_dir = str(BOOK_DIR)

    class BookHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=serve_dir, **kwargs)

        def do_GET(self):
            if self.path.startswith('/pdf/'):
                self._serve_pdf()
            else:
                super().do_GET()

        def _serve_pdf(self):
            """Serve a local PDF file via HTTP so browser can display it with #page= nav."""
            from urllib.parse import urlparse
            # Extract key: /pdf/cui2025 or /pdf/cui2025#page=130
            url_key = urlparse(self.path).path.removeprefix('/pdf/')

            # Reverse lookup: url_key -> source name -> pdf path
            key_to_source = {v: k for k, v in SOURCE_URL_KEYS.items()}
            source_name = key_to_source.get(url_key)
            if not source_name or source_name not in SOURCE_PDF_MAP:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'Unknown source key')
                return

            pdf_path = SOURCE_PDF_MAP[source_name]
            if not pdf_path.exists():
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'PDF file not found')
                return

            # Stream the PDF file to the browser
            pdf_size = pdf_path.stat().st_size
            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Length', str(pdf_size))
            self.send_header('Content-Disposition', f'inline; filename="{pdf_path.name}"')
            self.end_headers()
            with open(pdf_path, 'rb') as f:
                shutil.copyfileobj(f, self.wfile)

        def log_message(self, format, *args):
            if args and '/open-pdf' in str(args[0]):
                print(f"  📄 Opening: {args[0]}")

    with http.server.HTTPServer(("", port), BookHandler) as httpd:
        print(f"\n📚 Book server at http://localhost:{port}/output/book.html")
        print(f"   PDF links open in Preview.app")
        print(f"   Press Ctrl+C to stop\n")
        httpd.serve_forever()


if __name__ == "__main__":
    if "--serve" in sys.argv:
        port = 8765
        for i, arg in enumerate(sys.argv):
            if arg == "--port" and i + 1 < len(sys.argv):
                port = int(sys.argv[i + 1])
        serve(port)
    else:
        main()
