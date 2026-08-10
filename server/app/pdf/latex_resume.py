from __future__ import annotations

import re
from typing import Any


def _esc(text: str) -> str:
    """Escape LaTeX special characters in visible resume text."""
    repl = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    out = []
    for ch in text:
        out.append(repl.get(ch, ch))
    return "".join(out)


def _invisible_payload(text: str, index: int) -> str:
    """
    Embed a payload that parsers/LLMs still read, but looks invisible when compiled.
    Use detokenize so underscores/@ survive extraction after PDF compile.
    """
    raw = text[:450].replace("\n", " ").replace("\x00", "")
    # Escape only what would break detokenize / braces
    safe = raw.replace("\\", "/").replace("{", "(").replace("}", ")")
    technique = index % 4
    if technique == 0:
        return rf"{{\color{{white}}\fontsize{{1pt}}{{1pt}}\selectfont \detokenize{{{safe}}}}}"
    if technique == 1:
        return rf"{{\color{{white}}\tiny \detokenize{{{safe}}}}}"
    if technique == 2:
        return rf"\hspace{{0pt}}\raisebox{{-20pt}}[0pt][0pt]{{\color{{white}}\fontsize{{2pt}}{{2pt}}\selectfont \detokenize{{{safe}}}}}"
    return rf"{{\color[gray]{{0.99}}\fontsize{{1.5pt}}{{1.5pt}}\selectfont \detokenize{{{safe}}}}}"


def build_resume_latex(
    *,
    name: str,
    email: str = "",
    skills: str = "",
    experience: str = "",
    summary: str = "",
    payloads: list[dict[str, Any]] | None = None,
) -> str:
    """
    Generate a professional-looking LaTeX resume.
    Visible content keeps normal typography; prompt injections are white/tiny
    so the compiled PDF keeps the same visual texture.
    """
    payloads = payloads or []
    inv = [_invisible_payload(p["text"], i) for i, p in enumerate(payloads)]

    # Scatter invisible blocks: header, mid sections, footer
    header_inv = " ".join(inv[0:2]) if inv else ""
    mid_inv = " ".join(inv[2:6]) if len(inv) > 2 else ""
    foot_inv = " ".join(inv[6:]) if len(inv) > 6 else " ".join(inv)

    skills_items = [s.strip() for s in re.split(r"[,;\n]+", skills) if s.strip()]
    skills_tex = (
        r"\begin{itemize}\setlength{\itemsep}{2pt}"
        + "".join(rf"\item {_esc(s)}" for s in skills_items)
        + r"\end{itemize}"
        if skills_items
        else r"\textit{—}"
    )

    exp_paras = [p.strip() for p in experience.split("\n") if p.strip()] or ["—"]
    exp_tex = "\n\n".join(_esc(p) for p in exp_paras)

    summary_tex = _esc(summary) if summary else ""

    return rf"""\documentclass[11pt,a4paper]{{article}}
\usepackage[margin=0.85in]{{geometry}}
\usepackage{{xcolor}}
\usepackage{{setspace}}
\usepackage{{titlesec}}
\usepackage[T1]{{fontenc}}
\usepackage{{lmodern}}
\pagestyle{{empty}}
\titleformat{{\section}}{{\large\bfseries\color{{black}}}}{{\thesection}}{{0em}}{{}}[\titlerule]
\titlespacing*{{\section}}{{0pt}}{{12pt}}{{6pt}}
\begin{{document}}
\begin{{center}}
{{\LARGE\bfseries {_esc(name or "Candidate")}}}\\[4pt]
{{\small {_esc(email) if email else ""}}}
\end{{center}}
{header_inv}

{f"\\section*{{Summary}}{_esc(summary)}" if summary_tex else ""}
{mid_inv}

\section*{{Skills}}
{skills_tex}

\section*{{Experience}}
{exp_tex}

\vspace{{8pt}}
{foot_inv}
\end{{document}}
"""


def latex_with_injections_from_plain(
    plain_resume: str,
    payloads: list[dict[str, Any]],
) -> str:
    """Wrap arbitrary pasted resume text in LaTeX + invisible injections."""
    body = _esc(plain_resume)
    inv = " ".join(_invisible_payload(p["text"], i) for i, p in enumerate(payloads))
    return rf"""\documentclass[11pt,a4paper]{{article}}
\usepackage[margin=0.9in]{{geometry}}
\usepackage{{xcolor}}
\usepackage[T1]{{fontenc}}
\usepackage{{lmodern}}
\pagestyle{{empty}}
\begin{{document}}
\begin{{flushleft}}
{body}
\end{{flushleft}}
\vspace{{6pt}}
{inv}
\end{{document}}
"""
