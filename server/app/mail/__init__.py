from app.mail.client import send_mail
from app.mail.interceptor import intercept_send_email, is_recipient_allowed

__all__ = ["send_mail", "intercept_send_email", "is_recipient_allowed"]
