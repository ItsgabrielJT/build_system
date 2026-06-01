# Requerimiento: Pagos del propietario con comprobante, aprobación y recibo

## Objetivo

Permitir que el PROPIETARIO registre un pago subiendo su comprobante, que el ADMIN reciba la notificación, revise y apruebe o rechace la solicitud, y que el sistema habilite la descarga del recibo oficial solo después de la aprobación.

## Alcance

- El PROPIETARIO debe poder seleccionar un departamento y período adeudado.
- El PROPIETARIO debe poder subir un comprobante de pago.
- El sistema debe registrar la solicitud con estado pendiente.
- El sistema debe generar una constancia inmediata de envío.
- El ADMIN debe recibir notificación en bandeja interna y por correo.
- El ADMIN debe poder aprobar o rechazar la solicitud.
- Si el pago es aprobado, el PROPIETARIO debe poder descargar el recibo oficial.
- Si el pago es rechazado, el PROPIETARIO debe ver el motivo y poder reenviar comprobante.

## Reglas clave

- La constancia inmediata no reemplaza el recibo oficial.
- El recibo oficial solo puede descargarse si el pago fue aprobado.
- El PROPIETARIO solo puede ver y operar sus propios pagos.
- El ADMIN puede ver y resolver todas las solicitudes pendientes.
- Toda acción de aprobación o rechazo debe quedar auditada.

## Dependencias

- Autenticación y roles vigentes con Firebase.
- Módulo de pagos existente.
- Servicio o abstracción para envío de correo.
- Estrategia de almacenamiento para archivos adjuntos.