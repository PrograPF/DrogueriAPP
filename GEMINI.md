# Reglas Globales del Proyecto

## Regla de Comunicación y Planificación
Frente a una solicitud, primero se analizará lo pedido y se elaborará un plan detallado y resumido en lenguaje accesible (para un usuario con pocos conocimientos informáticos y de código). 

Se esperará la respuesta aprobatoria del usuario para proceder a ejecutar los cambios, o una respuesta correctiva para ajustar el plan entregado. Frente a una situación correctiva, se volverá a crear un plan nuevo con los cambios solicitados antes de ejecutar cualquier modificación en el código.

## Regla de Testing Autónomo y Reporte de Resultados
Cuando el usuario solicite probar o testear (ej: "testea", "haz las pruebas", "prueba el sistema"), el asistente analizará automáticamente los módulos y tablas modificadas recientemente sin que el usuario tenga que especificar qué probar. Diseñará los casos de prueba (flujo normal, retrocesos, casos de borde), ejecutará las pruebas con datos de prueba temporales, realizará la limpieza total de datos en la base de datos y entregará un reporte de resultados claro, detallado y resumido con el estado de cada validación.

## Regla de Verificación de Componentes Visuales e Importaciones JSX
Cada vez que se creen o modifiquen componentes visuales, botones, modales o vistas en React (JSX), el asistente realizará obligatoriamente una auditoría estática de todos los identificadores, íconos (ej: `lucide-react`), hooks y variables utilizados en el archivo modificado para asegurar que estén debidamente importados y declarados, previniendo errores de renderizado en tiempo de ejecución (pantallas negras o caídas de componentes al interactuar).

## Tareas Pendientes para la Próxima Sesión
*(Actualizado: 15-08-2026)*

Al iniciar una nueva conversación, recordar al usuario que quedan las siguientes tareas pendientes antes de comenzar cualquier nueva solicitud:

1. **Revisión pendiente en Módulo Recepción / Seguimiento OC** — Revisar y completar los pendientes del módulo de Recepción de Productos en conjunto con el módulo de Seguimiento OC.
2. **Análisis CENABAST** — Analizar qué funcionalidades se requieren para integrar o gestionar pedidos/productos de CENABAST dentro del sistema.
3. **Módulo de Salidas** — Comenzar el diseño e implementación del módulo de salidas de productos desde bodega.
