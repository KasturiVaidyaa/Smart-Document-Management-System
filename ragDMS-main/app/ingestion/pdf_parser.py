"""PDF parsing via pdfplumber — extract text blocks and tables.

Falls back to Gemini Vision OCR when pdfplumber finds no text
(scanned / image-based PDFs).
"""
from __future__ import annotations
import logging
import re
import statistics
from pathlib import Path
from typing import Any

import pdfplumber

logger = logging.getLogger("ragdms.pdf_parser")

LINE_TOL = 3.0
PARA_GAP_TOL = 14.0


def parse_pdf(pdf_path: Path, *, gemini_api_key: str = "", gemini_ocr_model: str = "gemini-3.6-flash") -> list[dict]:
    """Extract blocks from a PDF file.

    If pdfplumber yields 0 text blocks, falls back to Gemini Vision OCR.
    """
    line_blocks: list[dict] = []
    table_blocks: list[dict] = []
    
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            page_num = page.page_number
            
            # Extract tables and track their bounding boxes
            page_table_bboxes: list[tuple[float, float, float, float]] = []
            try:
                tables = page.find_tables()
                for table in tables:
                    try:
                        rows = table.extract()
                    except Exception:
                        continue
                    if not rows:
                        continue
                    bbox = (float(table.bbox[0]), float(table.bbox[1]),
                            float(table.bbox[2]), float(table.bbox[3]))
                    page_table_bboxes.append(bbox)
                    
                    # Clean and format table rows
                    cleaned = _clean_table_rows(rows)
                    if cleaned:
                        header = cleaned[0]
                        for row in cleaned[1:]:
                            text = " | ".join(row)
                            if text.strip():
                                table_blocks.append({
                                    "text": text,
                                    "page": page_num,
                                    "kind": "table_row",
                                    "heading": None,
                                    "_bbox": bbox,
                                    "_table_header": header,
                                })
            except Exception:
                pass
            
            # Extract words with font sizes
            words = page.extract_words(extra_attrs=["size"]) or []
            page_lines = _words_to_lines(words, page_num)
            
            # Filter out lines inside table regions
            for lb in page_lines:
                lb_bbox = lb.get("_bbox")
                if lb_bbox and any(_is_inside(lb_bbox, tb) for tb in page_table_bboxes):
                    continue
                line_blocks.append(lb)
    
    # ── OCR Fallback ──────────────────────────────────────────────
    # If pdfplumber found no text at all, the PDF is likely scanned /
    # image-based.  Use Gemini Vision to OCR the content.
    if not line_blocks and not table_blocks:
        logger.info("pdfplumber extracted 0 blocks — attempting Gemini OCR fallback")
        if gemini_api_key:
            ocr_blocks = _ocr_with_gemini(pdf_path, gemini_api_key, gemini_ocr_model)
            if ocr_blocks:
                logger.info("Gemini OCR extracted %d blocks", len(ocr_blocks))
                return ocr_blocks
            else:
                logger.warning("Gemini OCR also returned 0 blocks for %s", pdf_path.name)
        else:
            logger.warning("No GEMINI_API_KEY configured — cannot OCR image-based PDF %s", pdf_path.name)
        return []
    
    # Classify blocks by font size
    _classify_by_font_size(line_blocks)
    
    # Merge all blocks and sort by reading order
    all_blocks = line_blocks + table_blocks
    all_blocks.sort(key=lambda b: (
        b["page"],
        round(b.get("_bbox", (0, 0, 0, 0))[1], 1),
        b.get("_bbox", (0, 0, 0, 0))[0],
    ))
    
    # Merge consecutive body lines into paragraphs
    all_blocks = _merge_paragraphs(all_blocks)
    
    # Track current heading and clean output
    current_heading: str | None = None
    result: list[dict] = []
    for b in all_blocks:
        text = b.get("text", "").strip()
        if not text:
            continue
        kind = b.get("kind", "body")
        if kind == "heading":
            current_heading = text
        b["heading"] = current_heading
        result.append({
            "text": text,
            "page": b["page"],
            "kind": kind,
            "heading": current_heading,
        })
    
    logger.info("Parsed PDF: %d blocks", len(result))
    return result


# ---------------------------------------------------------------------------
# Gemini Vision OCR fallback
# ---------------------------------------------------------------------------

def _ocr_with_gemini(pdf_path: Path, api_key: str, model: str) -> list[dict]:
    """Send PDF to Gemini Vision for OCR text extraction.

    Uses the synchronous genai client because this runs inside the
    sync `parse_pdf` call chain.  The PDF bytes are sent inline as
    base64 — fine for typical documents (< 20 MB).
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        logger.error("google-genai not installed — cannot use OCR fallback")
        return []

    try:
        pdf_bytes = pdf_path.read_bytes()

        client = genai.Client(api_key=api_key)

        prompt = (
            "Extract ALL text from this PDF document exactly as it appears, "
            "preserving the structure. Output the text page by page. "
            "Before each page's content, write a marker line: "
            "--- PAGE <number> ---\n"
            "Include every piece of text you can see: headings, paragraphs, "
            "table data, labels, numbers, dates, and fine print. "
            "Do NOT summarize or paraphrase. Output raw extracted text only."
        )

        response = client.models.generate_content(
            model=model,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                        types.Part(text=prompt),
                    ],
                )
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=8000,
            ),
        )

        raw_text = response.text or ""
        if not raw_text.strip():
            return []

        logger.info("Gemini OCR returned %d chars of text", len(raw_text))
        return _parse_ocr_output(raw_text)

    except Exception:
        logger.exception("Gemini OCR failed for %s", pdf_path.name)
        return []


def _parse_ocr_output(text: str) -> list[dict]:
    """Parse the OCR output into structured blocks.

    Expected format from Gemini:
        --- PAGE 1 ---
        <text for page 1>
        --- PAGE 2 ---
        <text for page 2>

    Falls back to treating everything as page 1 if no markers found.
    """
    page_marker = re.compile(r"^-{2,}\s*PAGE\s+(\d+)\s*-{2,}$", re.MULTILINE | re.IGNORECASE)

    splits = page_marker.split(text)
    # splits is: [before_first_marker, page_num_1, page_text_1, page_num_2, page_text_2, ...]

    pages: list[tuple[int, str]] = []
    if len(splits) >= 3:
        # We have page markers
        for i in range(1, len(splits), 2):
            try:
                page_num = int(splits[i])
            except (ValueError, IndexError):
                page_num = (len(pages) + 1)
            page_text = splits[i + 1] if i + 1 < len(splits) else ""
            if page_text.strip():
                pages.append((page_num, page_text.strip()))
        # Also check text before the first marker
        preamble = splits[0].strip()
        if preamble and not pages:
            pages.insert(0, (1, preamble))
    else:
        # No page markers — treat entire text as page 1
        if text.strip():
            pages.append((1, text.strip()))

    blocks: list[dict] = []
    current_heading: str | None = None

    for page_num, page_text in pages:
        for line in page_text.splitlines():
            stripped = line.strip()
            if not stripped:
                continue

            # Detect headings: ALL CAPS short lines or lines that look like titles
            is_heading = (
                (len(stripped) <= 80 and stripped.upper() == stripped
                 and any(c.isalpha() for c in stripped) and len(stripped) > 2)
            )

            if is_heading:
                current_heading = stripped
                blocks.append({
                    "text": stripped,
                    "page": page_num,
                    "kind": "heading",
                    "heading": current_heading,
                })
            else:
                blocks.append({
                    "text": stripped,
                    "page": page_num,
                    "kind": "body",
                    "heading": current_heading,
                })

    return blocks


# ---------------------------------------------------------------------------
# pdfplumber text extraction helpers
# ---------------------------------------------------------------------------

def _words_to_lines(words: list[dict[str, Any]], page_num: int) -> list[dict]:
    """Group words into visual lines."""
    if not words:
        return []
    words = sorted(words, key=lambda w: (round(float(w["top"]), 1), float(w["x0"])))
    lines: list[list[dict]] = []
    for w in words:
        wt = float(w["top"])
        placed = False
        for line in lines:
            if abs(float(line[0]["top"]) - wt) <= LINE_TOL:
                line.append(w)
                placed = True
                break
        if not placed:
            lines.append([w])
    
    blocks: list[dict] = []
    for line in lines:
        line_sorted = sorted(line, key=lambda w: float(w["x0"]))
        text = " ".join(w["text"] for w in line_sorted).strip()
        if not text:
            continue
        sizes = [float(w.get("size", 0)) for w in line_sorted if w.get("size")]
        avg_size = sum(sizes) / len(sizes) if sizes else 0.0
        x0 = min(float(w["x0"]) for w in line_sorted)
        top = min(float(w["top"]) for w in line_sorted)
        x1 = max(float(w["x1"]) for w in line_sorted)
        bottom = max(float(w["bottom"]) for w in line_sorted)
        blocks.append({
            "text": text,
            "page": page_num,
            "kind": "body",  # classified later
            "heading": None,
            "_bbox": (x0, top, x1, bottom),
            "_avg_size": avg_size,
        })
    return blocks


def _classify_by_font_size(blocks: list[dict]) -> None:
    """Classify line blocks as heading/body/footnote using modal font size."""
    sizes = [round(b["_avg_size"], 1) for b in blocks if b.get("_avg_size")]
    if not sizes:
        return
    try:
        modal = statistics.mode(sizes)
    except statistics.StatisticsError:
        modal = statistics.median(sizes)
    for b in blocks:
        s = b.get("_avg_size", 0.0)
        if modal and s >= modal + 1.0:
            b["kind"] = "heading"
        elif modal and s <= modal - 1.0:
            b["kind"] = "footnote"
        else:
            b["kind"] = "body"


def _merge_paragraphs(blocks: list[dict]) -> list[dict]:
    """Merge consecutive body/footnote lines into paragraph blocks."""
    if not blocks:
        return []
    merged: list[dict] = []
    buf: list[dict] = []
    
    def flush():
        if not buf:
            return
        if len(buf) == 1:
            merged.append(buf[0])
        else:
            text = "\n".join(b["text"] for b in buf)
            merged.append({**buf[0], "text": text})
        buf.clear()
    
    for b in blocks:
        kind = b.get("kind", "body")
        if kind in ("heading", "table_row"):
            flush()
            merged.append(b)
            continue
        if buf:
            prev = buf[-1]
            prev_bbox = prev.get("_bbox", (0, 0, 0, 0))
            curr_bbox = b.get("_bbox", (0, 0, 0, 0))
            gap = curr_bbox[1] - prev_bbox[3]
            if b["page"] != prev["page"] or gap > PARA_GAP_TOL:
                flush()
        buf.append(b)
    flush()
    return merged


def _is_inside(block_bbox: tuple, table_bbox: tuple) -> bool:
    """Check if block center falls inside a table bounding box."""
    bx0, btop, bx1, bbot = block_bbox
    tx0, ttop, tx1, tbot = table_bbox
    cx = (bx0 + bx1) / 2.0
    cy = (btop + bbot) / 2.0
    return tx0 <= cx <= tx1 and ttop <= cy <= tbot


def _clean_table_rows(rows: list[list]) -> list[list[str]]:
    """Clean table rows: normalize whitespace, drop empty rows."""
    ws_re = re.compile(r"\s+")
    cleaned: list[list[str]] = []
    for row in rows:
        cells = [ws_re.sub(" ", str(c or "").replace("\n", " ")).strip() for c in row]
        if any(c for c in cells):
            cleaned.append(cells)
    return cleaned
