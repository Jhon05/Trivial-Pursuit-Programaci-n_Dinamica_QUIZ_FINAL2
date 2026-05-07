# Trivial Pursuit · Economía Matemática · v29

Proyecto listo para GitHub Pages.

## Características principales

- Tablero circular estilo Trivial Pursuit, con fichas solapadas sobre las casillas.
- Preguntas, opciones, pistas, retroalimentaciones e informe con LaTeX visible mediante MathJax.
- Informe final pedagógico en PDF, con gráficas, plan de mejora, registro de seguridad y detalle por pregunta.
- Contraseña docente sin mostrar pistas al estudiante.
- Botones de finalizar partida, regresar al menú principal y volver a ventana docente.
- Diseño adaptable a la resolución del dispositivo.

## Actualización v29

- Si una pregunta numérica de cálculo se responde en menos de 15 segundos, el quiz se anula automáticamente.
- Se registra en el informe como **respuesta numérica enviada en menos de 15 segundos** y la nota queda en **0/50**.
- Se agregaron controles preventivos para detectar navegación externa durante preguntas, atajos de cambio de página, apertura de ventanas externas y uso de la API `getDisplayMedia` para compartir pantalla desde el navegador.
- El informe incluye filas separadas para compartir pantalla detectado desde el navegador, página/ventana externa y respuestas demasiado rápidas.

> Nota técnica: por seguridad del navegador, una página web no puede detectar con certeza absoluta todas las capturas o comparticiones de pantalla iniciadas por aplicaciones externas o extensiones fuera de la página. El proyecto implementa las detecciones disponibles desde JavaScript del navegador.

## Publicación en GitHub Pages

Sube todos los archivos del proyecto a un repositorio y activa GitHub Pages desde la rama principal.


## Correcciones v30

- Bloqueo de clic derecho durante la partida.
- Bloqueo de atajos comunes para ver código fuente, inspeccionar elemento o abrir consola: F12, Ctrl/Cmd+U, Ctrl/Cmd+Shift+I, Ctrl/Cmd+Shift+J, Ctrl/Cmd+Shift+C y combinaciones equivalentes.
- Registro en el informe de intentos de clic derecho e inspección/código fuente.
- Anulación automática del quiz ante intentos críticos de inspección o apertura de consola durante la partida.

Nota técnica: en una página web estática ningún código puede impedir al 100% que un usuario avanzado acceda a archivos ya descargados por el navegador o use herramientas externas del sistema. Esta versión bloquea y registra los intentos detectables desde JavaScript durante la sesión del quiz.
