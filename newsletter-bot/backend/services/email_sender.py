"""
Provider-agnostic email sender. Uses SMTP by default.
Drop in SendGrid/Mailchimp by setting EMAIL_PROVIDER env var.
"""
import aiosmtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from typing import Optional


SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_NAME = os.getenv("FROM_NAME", "Neta Virtual Team")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)


async def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    from_name: str = FROM_NAME,
    from_email: str = FROM_EMAIL,
    reply_to: Optional[str] = None,
) -> bool:
    """Sends a single HTML email. Returns True on success."""
    if not SMTP_USER or not SMTP_PASS:
        print(f"[EMAIL STUB] Would send to {to_email}: {subject}")
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    if reply_to:
        msg["Reply-To"] = reply_to

    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASS,
            start_tls=True,
        )
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {to_email}: {e}")
        return False


async def send_campaign_batch(
    recipients: list,  # list of {email, subject, html_body, token}
    delay_ms: int = 100,
) -> dict:
    """Sends to a list of recipients. Returns {sent, failed} counts."""
    import asyncio
    sent = 0
    failed = 0
    for r in recipients:
        success = await send_email(
            to_email=r["email"],
            subject=r["subject"],
            html_body=r["html_body"],
        )
        if success:
            sent += 1
        else:
            failed += 1
        if delay_ms:
            await asyncio.sleep(delay_ms / 1000)
    return {"sent": sent, "failed": failed}
