"""Servicio para el envío de correos electrónicos vía Mailjet."""

from __future__ import annotations

import logging
from uuid import UUID
import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)


class EmailService:
    @staticmethod
    def _system_link_text() -> str:
        return settings.app_url.rstrip("/")

    @staticmethod
    def _append_system_link(text_content: str, html_content: str) -> tuple[str, str]:
        system_link = EmailService._system_link_text()
        if system_link in text_content and system_link in html_content:
            return text_content, html_content
        text = (
            f"{text_content.rstrip()}\n\n"
            f"Enlace del sistema: {system_link}\n"
        )
        html = (
            f"{html_content}"
            f"<p><strong>Enlace del sistema:</strong> "
            f'<a href="{system_link}">{system_link}</a></p>'
        )
        return text, html

    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        text_content: str,
        html_content: str,
        to_name: str | None = None,
    ) -> bool:
        """
        Envía un correo electrónico usando la API v3.1 de Mailjet.
        Si no se configuran las claves, realiza fallback a logger (para desarrollo).
        """
        text_content, html_content = EmailService._append_system_link(
            text_content,
            html_content,
        )

        api_key = settings.mailjet_api_key
        api_secret = settings.mailjet_api_secret
        from_email = settings.mailjet_from_email
        from_name = settings.mailjet_from_name

        if not api_key or not api_secret:
            logger.warning(
                f"[MOCK EMAIL] Mailjet no configurado. Simulación de correo:\n"
                f"  De: {from_name} <{from_email}>\n"
                f"  Para: {to_name or ''} <{to_email}>\n"
                f"  Asunto: {subject}\n"
                f"  Contenido: {text_content}\n"
            )
            return True

        url = "https://api.mailjet.com/v3.1/send"
        auth = (api_key, api_secret)

        payload = {
            "Messages": [
                {
                    "From": {
                        "Email": from_email,
                        "Name": from_name
                    },
                    "To": [
                        {
                            "Email": to_email,
                            "Name": to_name or to_email
                        }
                    ],
                    "Subject": subject,
                    "TextPart": text_content,
                    "HTMLPart": html_content
                }
            ]
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, auth=auth, timeout=10.0)
                if response.status_code >= 400:
                    logger.error(
                        f"Error al enviar correo vía Mailjet: {response.status_code} - {response.text}"
                    )
                    return False
                logger.info(f"Correo enviado exitosamente a {to_email}")
                return True
        except Exception as e:
            logger.error(f"Excepción al enviar correo vía Mailjet: {str(e)}")
            return False

    @staticmethod
    async def send_user_created_email(user_email: str, temp_password: str, role_name: str) -> bool:
        """Envía correo de bienvenida con la contraseña temporal."""
        subject = "Bienvenido a HabitaUIO - Tu cuenta ha sido creada"
        text_content = (
            f"Hola,\n\n"
            f"Tu cuenta ha sido creada en HabitaUIO con el rol de {role_name}.\n\n"
            f"Tus credenciales de acceso temporal son:\n"
            f"  Usuario: {user_email}\n"
            f"  Contraseña Temporal: {temp_password}\n\n"
            f"Por seguridad, se te solicitará cambiar tu contraseña en tu primer inicio de sesión.\n\n"
            f"Saludos,\nEl equipo de HabitaUIO"
        )
        html_content = (
            f"<h3>Bienvenido a HabitaUIO</h3>"
            f"<p>Tu cuenta ha sido creada con el rol de <strong>{role_name}</strong>.</p>"
            f"<p>Tus credenciales de acceso temporal son:</p>"
            f"<ul>"
            f"  <li><strong>Usuario (Email):</strong> {user_email}</li>"
            f"  <li><strong>Contraseña Temporal:</strong> {temp_password}</li>"
            f"</ul>"
            f"<p>Por seguridad, deberás cambiar tu contraseña al ingresar por primera vez.</p>"
            f"<br/><p>Saludos,<br/>El equipo de HabitaUIO</p>"
        )
        text_content, html_content = EmailService._append_system_link(
            text_content,
            html_content,
        )
        return await EmailService.send_email(user_email, subject, text_content, html_content)

    @staticmethod
    async def send_password_recovery_email(user_email: str, temp_password: str) -> bool:
        """Envía correo con código temporal para recuperación de contraseña."""
        subject = "Recuperación de contraseña - HabitaUIO"
        text_content = (
            f"Hola,\n\n"
            f"Hemos recibido una solicitud para recuperar tu contraseña en HabitaUIO.\n\n"
            f"Tu nueva contraseña temporal es:\n"
            f"  {temp_password}\n\n"
            f"Al iniciar sesión con esta contraseña, se te pedirá que crees una nueva contraseña definitiva.\n\n"
            f"Si no solicitaste este cambio, por favor contacta a la administración de inmediato.\n\n"
            f"Saludos,\nEl equipo de HabitaUIO"
        )
        html_content = (
            f"<h3>Recuperación de contraseña</h3>"
            f"<p>Hola,</p>"
            f"<p>Hemos recibido una solicitud para recuperar tu contraseña en HabitaUIO.</p>"
            f"<p>Tu nueva contraseña temporal es:</p>"
            f"<ul>"
            f"  <li><strong>Contraseña Temporal:</strong> {temp_password}</li>"
            f"</ul>"
            f"<p>Al iniciar sesión con esta contraseña, se te pedirá que crees una nueva contraseña definitiva.</p>"
            f"<p>Si no solicitaste este cambio, por favor contacta a la administración de inmediato.</p>"
            f"<br/><p>Saludos,<br/>El equipo de HabitaUIO</p>"
        )
        text_content, html_content = EmailService._append_system_link(
            text_content,
            html_content,
        )
        return await EmailService.send_email(user_email, subject, text_content, html_content)

    @staticmethod
    async def send_payment_uploaded_emails(
        owner_email: str | None,
        owner_name: str,
        amount: float,
        period: str,
        payment_id: UUID,
    ) -> None:
        """Envía notificaciones de pago subido al admin y al propietario."""
        # 1. Notificar al Admin
        admin_email = settings.admin_notification_email
        if admin_email:
            admin_subject = f"Nuevo pago por revisar — Período {period}"
            admin_text = (
                f"El propietario {owner_name} ({owner_email or 'Sin email'}) ha subido un comprobante de pago.\n\n"
                f"Detalles del pago:\n"
                f"  - Período: {period}\n"
                f"  - Monto: USD {amount}\n"
                f"  - ID de Pago: {payment_id}\n\n"
                f"Por favor ingresa al portal de administración para revisar y aprobar este pago.\n"
            )
            admin_html = (
                f"<h3>Nuevo pago registrado</h3>"
                f"<p>El propietario <strong>{owner_name}</strong> ({owner_email or 'Sin email'}) ha cargado un nuevo comprobante de pago.</p>"
                f"<h4>Detalles del pago:</h4>"
                f"<ul>"
                f"  <li><strong>Período:</strong> {period}</li>"
                f"  <li><strong>Monto:</strong> USD {amount}</li>"
                f"  <li><strong>ID de Pago:</strong> {payment_id}</li>"
                f"</ul>"
                f"<p>Por favor, ingresa al módulo de revisión de pagos en el portal de administración para gestionarlo.</p>"
            )
            admin_text, admin_html = EmailService._append_system_link(
                admin_text,
                admin_html,
            )
            await EmailService.send_email(admin_email, admin_subject, admin_text, admin_html, "Administrador")

        # 2. Confirmación al Propietario
        if owner_email:
            owner_subject = f"Comprobante recibido — Período {period}"
            owner_text = (
                f"Hola {owner_name},\n\n"
                f"Hemos recibido tu comprobante de pago por un monto de USD {amount} para el período {period}.\n\n"
                f"El pago se encuentra actualmente en revisión por la administración. Te notificaremos una vez sea aprobado.\n\n"
                f"Saludos,\nAdministración de HabitaUIO"
            )
            owner_html = (
                f"<h3>Comprobante de pago recibido</h3>"
                f"<p>Hola {owner_name},</p>"
                f"<p>Hemos recibido el comprobante de pago cargado para el período <strong>{period}</strong> por un monto de <strong>USD {amount}</strong>.</p>"
                f"<p>Tu pago está pendiente de revisión por parte de la administración. Te enviaremos un correo tan pronto sea aprobado.</p>"
                f"<br/><p>Saludos,<br/>Administración de HabitaUIO</p>"
            )
            owner_text, owner_html = EmailService._append_system_link(
                owner_text,
                owner_html,
            )
            await EmailService.send_email(owner_email, owner_subject, owner_text, owner_html, owner_name)

    @staticmethod
    async def send_payment_approved_email(
        owner_email: str | None,
        owner_name: str,
        amount: float,
        period: str,
    ) -> bool:
        """Notifica al propietario que su pago fue aprobado."""
        if not owner_email:
            return False
        subject = f"Pago Aprobado — Período {period}"
        text_content = (
            f"Hola {owner_name},\n\n"
            f"Te informamos que tu pago por un monto de USD {amount} para el período {period} ha sido APROBADO por la administración.\n\n"
            f"Ya puedes descargar tu recibo de pago oficial desde el portal en el módulo 'Mis Pagos'.\n\n"
            f"Saludos,\nAdministración de HabitaUIO"
        )
        html_content = (
            f"<h3>Tu pago ha sido aprobado</h3>"
            f"<p>Hola {owner_name},</p>"
            f"<p>Te notificamos que tu pago por un monto de <strong>USD {amount}</strong> para el período <strong>{period}</strong> fue aprobado con éxito.</p>"
            f"<p>Tu recibo oficial ya se encuentra disponible para su descarga en el portal dentro del módulo 'Mis Pagos'.</p>"
            f"<br/><p>Saludos,<br/>Administración de HabitaUIO</p>"
        )
        text_content, html_content = EmailService._append_system_link(
            text_content,
            html_content,
        )
        return await EmailService.send_email(owner_email, subject, text_content, html_content, owner_name)
