from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.agents.naive_gemini import run_naive_gemini_safe
from app.catalog import sample_patterns
from app.pdf.extract import extract_text, highlight_injections
from app.pdf.inject import build_resume_pdf, inject_payloads
from app.pdf.latex_resume import build_resume_latex, latex_with_injections_from_plain
from app.store.runs import create_run, get_run, hash_bytes, push_event, update_run, uploads_dir

router = APIRouter(prefix="/api/red", tags=["red"])

ALLOWED_COUNTS = {3, 5, 10, 100}


def _parse_json_list(raw: str | None) -> list[Any]:
    if not raw:
        return []
    data = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(data, list):
        raise HTTPException(400, "expected JSON array")
    return data


@router.post("/inject")
async def inject(
    resume: UploadFile | None = File(None),
    count: int = Form(5),
    payloadIds: str | None = Form(None),
    customPayloads: str | None = Form(None),
    name: str | None = Form(None),
    email: str | None = Form(None),
    skills: str | None = Form(None),
    experience: str | None = Form(None),
    summary: str | None = Form(None),
    resumeText: str | None = Form(None),
):
    if count not in ALLOWED_COUNTS:
        raise HTTPException(400, "count must be one of 3, 5, 10, 100")

    payload_ids = _parse_json_list(payloadIds) if payloadIds else None
    custom_list = [str(x) for x in _parse_json_list(customPayloads)] if customPayloads else []

    if resume is not None:
        source_pdf = await resume.read()
        if not source_pdf:
            raise HTTPException(400, "empty resume upload")
        from_upload = True
        form_fields = {
            "name": name or "Candidate",
            "email": email or "",
            "skills": skills or "",
            "experience": experience or resumeText or "",
            "summary": summary or "",
        }
    elif name or resumeText:
        from_upload = False
        form_fields = {
            "name": name or "Candidate",
            "email": email or "",
            "skills": skills or "",
            "experience": experience or resumeText or "",
            "summary": summary or "",
        }
        source_pdf = build_resume_pdf(**form_fields)
    else:
        raise HTTPException(400, "Provide a resume PDF upload or form fields (name, skills, experience)")

    catalog = sample_patterns(count, payload_ids)
    custom = [{"id": f"custom-{i+1}", "text": t, "category": "custom"} for i, t in enumerate(custom_list)]
    payloads = catalog
    if custom:
        payloads = (custom + catalog)[:count]

    # Always produce LaTeX with the same visible content + invisible injections
    if from_upload and not (form_fields["skills"] or form_fields["experience"]):
        # Companion LaTeX listing injections (uploaded PDF texture stays in the PDF path)
        latex_src = latex_with_injections_from_plain(
            f"Uploaded resume PDF (visual layout preserved in poisoned PDF).\n"
            f"Candidate: {form_fields['name']}",
            payloads,
        )
    else:
        latex_src = build_resume_latex(**form_fields, payloads=payloads)

    result = inject_payloads(source_pdf, payloads)
    pdf_bytes = result["pdf_bytes"]
    injected = result["injected"]

    run = create_run(
        {
            "originalHash": hash_bytes(source_pdf),
            "injectionCount": len(injected),
            "injected": injected,
            "customPayloads": custom_list,
            "originalPdfPath": "",
            "poisonedPdfPath": "",
            "latexPath": "",
            "timeline": [
                {
                    "at": datetime.now(UTC).isoformat(),
                    "event": "injected",
                    "detail": {"count": len(injected), "fromUpload": from_upload},
                }
            ],
        }
    )

    up = uploads_dir()
    original_path = up / f"{run['id']}-original.pdf"
    poisoned_path = up / f"{run['id']}-poisoned.pdf"
    latex_path = up / f"{run['id']}-poisoned.tex"
    original_path.write_bytes(source_pdf)
    poisoned_path.write_bytes(pdf_bytes)
    latex_path.write_text(latex_src, encoding="utf-8")

    extracted = extract_text(pdf_bytes)
    highlights = highlight_injections(extracted["text"], injected)

    def mutate(r: dict[str, Any]) -> None:
        r["originalPdfPath"] = str(original_path)
        r["poisonedPdfPath"] = str(poisoned_path)
        r["latexPath"] = str(latex_path)
        r["extractedText"] = extracted["text"]
        r["highlights"] = highlights

    update_run(run["id"], mutate)

    return {
        "run_id": run["id"],
        "injectionCount": len(injected),
        "injected": [
            {"id": i["id"], "page": i["page"], "technique": i["technique"], "text": i["text"]}
            for i in injected
        ],
        "extractedText": extracted["text"],
        "highlights": highlights,
        "poisonedPdfUrl": f"/files/{run['id']}-poisoned.pdf",
        "latexUrl": f"/files/{run['id']}-poisoned.tex",
        "visualNote": (
            "Uploaded PDF layout preserved; injections are invisible overlays."
            if from_upload
            else "Form resume + matching LaTeX with white/tiny invisible injection text."
        ),
    }


@router.post("/attack")
async def attack(body: dict[str, Any]):
    run_id = body.get("run_id")
    if not run_id:
        raise HTTPException(400, "run_id required")
    run = get_run(run_id)
    if not run:
        raise HTTPException(404, "run not found")

    pdf = Path(run["poisonedPdfPath"]).read_bytes()
    extracted = extract_text(pdf)
    agent = await run_naive_gemini_safe(extracted["text"])

    def mutate(r: dict[str, Any]) -> None:
        r["extractedText"] = extracted["text"]
        r["highlights"] = highlight_injections(extracted["text"], r["injected"])
        r["red"] = {
            "completedAt": datetime.now(UTC).isoformat(),
            "agent": agent,
            "mail": agent["mailResults"],
        }
        push_event(
            r,
            "red_attack_complete",
            {"toolCalls": len(agent["toolCalls"]), "mailCount": len(agent["mailResults"])},
        )

    updated = update_run(run_id, mutate)

    return {
        "run_id": run_id,
        "mode": "red",
        "extractedText": extracted["text"],
        "highlights": updated.get("highlights"),
        "thoughts": agent["thoughts"],
        "modelText": agent["text"],
        "toolCalls": agent["toolCalls"],
        "mail": agent["mailResults"],
        "approvals": agent["approvals"],
        "timeline": updated.get("timeline"),
    }
