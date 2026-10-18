"""
EmailService — Transactional email delivery service using Google Gmail SMTP.

Responsibilities:
  - Deliver transactional emails to ANY recipient using standard SMTP
  - Asynchronous dispatch via asyncio.to_thread and standard library smtplib
  - Support TLS (port 587) and SSL (port 465)
  - Auto-format high-contrast, minimalist ResearchTube HTML password reset emails
"""

from __future__ import annotations

import asyncio
from pathlib import Path
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import jinja2
import structlog

from app.core.config import settings

logger = structlog.get_logger("email_service")

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

_jinja_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=jinja2.select_autoescape(["html", "xml"]),
)


class EmailService:
    """
    Singleton service managing outbound transactional emails via SMTP.
    """

    _instance: "EmailService | None" = None

    def __new__(cls) -> "EmailService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _send_smtp_sync(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
    ) -> bool:
        """
        Synchronous SMTP email delivery using Python's standard library smtplib.
        """
        if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            raise ValueError(
                "SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be configured in environment."
            )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM or f"ResearchTubeAI <{settings.SMTP_USER}>"
        msg["To"] = to_email.strip()

        if text_content:
            msg.attach(MIMEText(text_content, "plain", "utf-8"))
        if html_content:
            msg.attach(MIMEText(html_content, "html", "utf-8"))

        clean_password = settings.SMTP_PASSWORD.replace(" ", "").strip()
        smtp_user = settings.SMTP_USER.strip()
        port = int(settings.SMTP_PORT or 587)

        logger.info(
            "email.smtp.connecting",
            host=settings.SMTP_HOST,
            port=port,
            user=smtp_user,
            to=to_email,
        )

        if port == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, port, timeout=20)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, port, timeout=20)
            if settings.SMTP_USE_TLS:
                server.starttls()

        try:
            server.login(smtp_user, clean_password)
            server.sendmail(smtp_user, [to_email.strip()], msg.as_string())
            logger.info("email.smtp.sent_successfully", to=to_email, subject=subject)
            print(f"[EMAIL SERVICE] Successfully sent email to {to_email} via Google SMTP.")
            return True
        finally:
            try:
                server.quit()
            except Exception:
                pass

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
    ) -> bool:
        """
        Send an email asynchronously via SMTP.
        """
        provider = (settings.EMAIL_PROVIDER or "smtp").lower().strip()

        # Dev / Mock Mode Fallback if explicitly specified
        if provider == "mock":
            logger.info("email.mock_dispatched", to=to_email, subject=subject)
            print("\n" + "=" * 70)
            print(f"[MOCK EMAIL DISPATCH] TO: {to_email}")
            print(f"SUBJECT: {subject}")
            print("-" * 70)
            print(text_content or html_content)
            print("=" * 70 + "\n")
            return True

        # SMTP Delivery
        try:
            return await asyncio.to_thread(
                self._send_smtp_sync,
                to_email,
                subject,
                html_content,
                text_content,
            )
        except Exception as exc:
            logger.error("email.smtp.failed", error=str(exc), to=to_email)
            print(f"[ERROR] SMTP email delivery failed: {exc}")
            print(f"[FALLBACK LOG] Email for {to_email}:")
            print(text_content or html_content)
            return False

    def render_template(self, template_name: str, **context) -> str:
        """Render a template from the external_services/templates directory."""
        template = _jinja_env.get_template(template_name)
        return template.render(**context)

    async def send_password_reset_email(
        self,
        to_email: str,
        username: str | None,
        reset_url: str,
        expire_minutes: int = 15,
    ) -> bool:
        """
        Render and dispatch a password reset email for ResearchTube via Jinja2 template.
        """
        greeting_name = username or to_email.split("@")[0]
        subject = "Reset your ResearchTube password"

        context = {
            "greeting_name": greeting_name,
            "reset_url": reset_url,
            "expire_minutes": expire_minutes,
        }

        html_content = self.render_template("forgot_password.html", **context)
        try:
            plain_text = self.render_template("forgot_password.txt", **context)
        except Exception:
            plain_text = (
                f"Hello {greeting_name},\n\n"
                f"We received a request to reset your ResearchTube password.\n\n"
                f"To reset your password, visit this link within {expire_minutes} minutes:\n"
                f"{reset_url}\n\n"
                f"If you did not request a password reset, you can safely ignore this email.\n"
                f"Your password will not be changed.\n\n"
                f"— The ResearchTube Team"
            )

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=plain_text,
        )



email_service = EmailService()
