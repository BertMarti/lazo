# Seguridad y privacidad

## Avisar de un fallo

Si encuentras un fallo de seguridad, **no abras una issue pública**. Usa [«Report a vulnerability»](https://github.com/BertMarti/lazo/security/advisories/new) en la pestaña Security del repo. Respondemos en menos de 7 días.

Interesan sobre todo:

- cualquier forma de ver el estado de la **propia** lista (reservas, compras o aportaciones), por la interfaz o por la API;
- ver listas o sorteos de un grupo al que no perteneces, o la asignación del amigo invisible de otra persona;
- reutilizar, adivinar o forzar invitaciones y códigos de dispositivo;
- SSRF o descargas abusivas a través del extractor de enlaces;
- exposición de datos de menores.

## Cómo protege Lazo

| Riesgo | Medida |
|---|---|
| Spoilers de la propia lista | Reglas de API por colección (`item.list.user != @request.auth.id`), que se aplican también a `expand`, filtros y tiempo real; `items` no lleva estado |
| Gente ajena al grupo | Toda lectura exige pertenecer al grupo |
| Invitaciones | Token de 128 bits del que solo se guarda el hash SHA-256; caduca en 14 días; 30 usos; revocable; límite de peticiones |
| SSRF | Solo `http` y `https` en los puertos 80 y 443; IP privadas, loopback, link-local, CGNAT y metadatos bloqueadas en cada redirección; 6 s; 1,5 MB; servicio aislado en la red interna |
| Menores | Sin cuenta, sin foto, nombre de pila y año opcional; la IA solo recibe una franja de edad |
| Claves de IA | Solo en el dispositivo; el servidor nunca las ve |
| Navegador | CSP estricta y nada de HTML inyectado |
| Android | `allowBackup=false` y WebView no depurable en las versiones publicadas |

La auditoría detallada está en `docs/security/AUDIT.md` (desde la 0.2).

## Versiones con soporte

Solo la última versión publicada.

## Modelos y su función

- **Claude Fable 5.1** hace la revisión de seguridad antes de cada versión con servidor.
- **Claude Opus 5.5** aplica los arreglos con pruebas.
- **Los modelos de IA del producto** nunca reciben datos de autenticación, nombres de niños ni el contenido de las listas de otros: solo lo que el usuario pide procesar (cabeceras y 3 filas de ejemplo de un Excel, o gustos y una franja de edad).
