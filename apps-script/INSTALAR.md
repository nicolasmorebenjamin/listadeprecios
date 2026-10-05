# Activar la sincronización de Google Docs

El proyecto consulta la versión publicada del documento cada minuto, copia los productos y precios a una planilla privada de Google Sheets y ofrece los datos a la página.

1. Abrí [script.google.com](https://script.google.com/) con la cuenta que administra el documento y creá un proyecto nuevo.
2. Copiá el contenido de `Code.gs` en el editor y guardalo.
3. Elegí `iniciarSincronizacion` y ejecutala una vez. Aceptá los permisos solicitados. Se creará la planilla y se instalará la revisión cada minuto. En el registro de ejecución aparece el enlace de la planilla.
4. En **Implementar → Nueva implementación**, elegí **Aplicación web**, ejecutá como tu cuenta y habilitá el acceso para cualquier persona. Implementá y copiá la URL que termina en `/exec`.
5. Enviame esa URL para conectarla a la página y publicar el cambio final.

La primera ejecución requiere acceso al documento publicado y crea la planilla en la cuenta que ejecuta el script. La página usa JSONP para leer el endpoint público sin depender de proxies de terceros.
