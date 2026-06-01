# Requerimiento: Balance mensual del edificio

## Objetivo

Permitir que ADMIN y PROPIETARIO consulten el balance mensual del edificio con ingresos, gastos y balance neto del mes, usando la misma base contable del sistema.

## Alcance

- El sistema debe consolidar ingresos mensuales confirmados.
- El sistema debe consolidar gastos mensuales registrados.
- El sistema debe calcular el balance neto del mes.
- El ADMIN debe ver el balance completo por mes con desglose.
- El PROPIETARIO debe ver el balance mensual del edificio en una vista autorizada.
- La información debe poder reutilizar la infraestructura actual de reportes y dashboard.

## Reglas clave

- Los ingresos deben considerar solo pagos aprobados/confirmados.
- Los gastos deben considerar solo registros activos/válidos.
- El balance neto mensual es ingresos menos gastos.
- El cálculo debe ser consistente entre dashboard y reportes.
- La visibilidad del PROPIETARIO no debe exponer acciones administrativas ni datos ajenos a la contabilidad del edificio.

## Dependencias

- Módulo de pagos y gastos existente.
- Reportes financieros existentes.
- Definición final de qué detalle puede ver el PROPIETARIO.