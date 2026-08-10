from __future__ import annotations

import io
from typing import Any

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas

TECHNIQUES = ("white_1pt", "off_page", "tiny_margin", "near_white")


def _overlay_page(
    width: float,
    height: float,
    items: list[tuple[str, str, int]],
) -> bytes:
    """Draw invisible injection text for one page; items = (text, technique, index)."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    for text, technique, index in items:
        snippet = text[:500]
        if technique == "white_1pt":
            c.setFillColor(Color(1, 1, 1))
            c.setFont("Helvetica", 1)
            c.drawString(36 + (index % 5) * 8, max(12, height - 40 - (index % 20) * 14), snippet)
        elif technique == "off_page":
            c.setFillColor(Color(0.95, 0.95, 0.95))
            c.setFont("Helvetica", 6)
            c.drawString(width + 20, height / 2 - (index % 10) * 6, snippet)
        elif technique == "tiny_margin":
            c.setFillColor(Color(0.98, 0.98, 0.98))
            c.setFont("Helvetica", 2)
            c.drawString(4, 4 + (index % 15) * 3, snippet)
        else:  # near_white
            c.setFillColor(Color(0.97, 0.97, 0.99))
            c.setFont("Helvetica", 3)
            c.drawString(72 + (index % 7) * 10, 24 + (index % 12) * 5, snippet)
    c.save()
    return buf.getvalue()


def inject_payloads(source_pdf: bytes, payloads: list[dict[str, Any]]) -> dict[str, Any]:
    """Embed N invisible / near-invisible prompt injections into a PDF."""
    reader = PdfReader(io.BytesIO(source_pdf))
    writer = PdfWriter()

    needed_pages = max(1, (len(payloads) + 24) // 25)
    page_count = max(len(reader.pages), needed_pages)

    # Clone existing pages; add blank pages if needed
    for i in range(page_count):
        if i < len(reader.pages):
            writer.add_page(reader.pages[i])
        else:
            # blank letter page
            blank = PdfReader(io.BytesIO(_blank_pdf())).pages[0]
            writer.add_page(blank)

    by_page: dict[int, list[tuple[str, str, int]]] = {}
    injected: list[dict[str, Any]] = []

    for index, payload in enumerate(payloads):
        page_index = index % page_count
        technique = TECHNIQUES[index % len(TECHNIQUES)]
        by_page.setdefault(page_index, []).append((payload["text"], technique, index))
        injected.append(
            {
                "id": payload["id"],
                "text": payload["text"],
                "page": page_index + 1,
                "technique": technique,
            }
        )

    for page_index, items in by_page.items():
        page = writer.pages[page_index]
        box = page.mediabox
        width = float(box.width)
        height = float(box.height)
        overlay_bytes = _overlay_page(width, height, items)
        overlay_page = PdfReader(io.BytesIO(overlay_bytes)).pages[0]
        page.merge_page(overlay_page)

    out = io.BytesIO()
    writer.write(out)
    return {"pdf_bytes": out.getvalue(), "injected": injected}


def _blank_pdf() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(612, 792))
    c.showPage()
    c.save()
    return buf.getvalue()


def build_resume_pdf(
    *,
    name: str,
    email: str = "",
    skills: str = "",
    experience: str = "",
    summary: str = "",
) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(612, 792))
    y = 740
    c.setFillColor(Color(0.05, 0.05, 0.05))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, name or "Candidate")
    y -= 28

    def block(label: str, value: str) -> None:
        nonlocal y
        if not value:
            return
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, label)
        y -= 16
        c.setFont("Helvetica", 10)
        for chunk in _wrap(value, 85):
            c.drawString(50, y, chunk)
            y -= 14
        y -= 10

    if email:
        block("Email", email)
    if summary:
        block("Summary", summary)
    if skills:
        block("Skills", skills)
    if experience:
        block("Experience", experience)

    c.save()
    return buf.getvalue()


def _wrap(text: str, max_len: int) -> list[str]:
    words = " ".join(text.split()).split(" ")
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if len(trial) > max_len:
            if cur:
                lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines or [""]
