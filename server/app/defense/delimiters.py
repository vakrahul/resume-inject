UNTRUSTED_OPEN = "<untrusted_resume_data>"
UNTRUSTED_CLOSE = "</untrusted_resume_data>"


def wrap_untrusted(text: str) -> str:
    return f"{UNTRUSTED_OPEN}\n{text}\n{UNTRUSTED_CLOSE}"
