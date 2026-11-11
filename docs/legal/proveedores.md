# Proveedores de IA: qué se puede usar en producción en la UE

Revisado el 2026-11-11 en las fuentes oficiales (enlaces abajo). **No es asesoramiento legal.** Las condiciones cambian, así que conviene revisarlas antes de cada versión.

## Decisión para Lazo

1. **La IA es un extra, no el núcleo.** Lazo funciona entero sin IA:
   - el Excel se mapea por sinónimos y se corrige a mano en la vista previa;
   - las ideas salen de un catálogo local por edades;
   - los enlaces se leen con metadatos públicos, sin IA.

   **Por defecto la IA está apagada.**
2. **En producción** (usuarios reales, de la UE), solo dos opciones:
   - **Ollama**: autoalojado en casa, junto a PocketBase. Nada sale de tu red.
   - **Una clave de pago** del propio usuario: Claude o Gemini con facturación activa en Google Cloud.
3. **Groq, OpenRouter (`:free`), NVIDIA y la capa gratuita de Gemini**: solo para desarrollo y pruebas. En Ajustes se marcan así.
4. Las claves de `.env.local` son de desarrollo, para `npm run test:live`. Nunca se usan en la demo ni en builds.

## Por proveedor

| Proveedor | Producción UE con clave gratuita | Por qué |
|---|---|---|
| **Google Gemini** (capa gratuita) | **No** | Las condiciones adicionales de la API exigen, para apps con usuarios del EEE, Suiza o Reino Unido, «use only Paid Services when making API Clients available to users». En la capa gratuita Google puede usar las entradas para mejorar sus productos y «human reviewers may read, annotate, and process» las peticiones |
| Google Gemini (de pago: proyecto de Cloud con facturación) | Sí | En los servicios de pago Google no usa prompts ni respuestas para mejorar productos; solo los registra un tiempo por seguridad |
| **NVIDIA** (build.nvidia.com) | Dudoso: **no** | El servicio se llama «trial» y lo rigen los *NVIDIA API Trial Terms of Service*, un PDF que no se pudo leer en texto. La licencia comercial del modelo no cubre el servicio de API. Hasta leer esos términos, solo pruebas |
| **Groq** (GroqCloud) | Dudoso | El Services Agreement contempla uso «for preview or production use» y para el EEE contrata Groq UK Limited con cláusulas tipo UE. Groq no usa entradas ni salidas para entrenar. Pero el uso gratuito tiene límites y prohíbe usarlo «in a manner intended to avoid incurring Fees». Solo pruebas |
| **OpenRouter** (`:free`) | Dudoso | Cada modelo se rige por las condiciones de su proveedor. «Some Models may store or train on your Inputs» y la residencia en la UE solo existe en los planes Business y Enterprise. No hay condiciones específicas de los modelos `:free`. Solo pruebas |
| **Ollama** (autoalojado) | Sí | Corre en tu máquina; no hay tercero. Cuidado con exponerlo a Internet: debe quedarse en la LAN o la VPN |
| **Claude** (Anthropic, de pago) | Sí, con tu clave | De pago y elegido por el usuario. Lazo no envía nombres de niños ni datos de otras listas |

## Qué se envía a la IA (cualquier proveedor)

- **Excel:** solo las cabeceras y 3 filas de muestra.
- **Ideas:** la franja de edad, los gustos que escribas y el presupuesto. Nunca nombres ni años de nacimiento.
- **Nunca:** reservas, presupuestos, listas de otras personas ni datos de sesión.

## Fuentes

- Gemini: https://ai.google.dev/gemini-api/terms (redirige a https://aistudio.google.com/docs/terms, en vigor desde el 23 de marzo de 2026).
- NVIDIA: https://build.nvidia.com/ y https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf (PDF no legible en texto: **pendiente de revisión manual**).
- Groq:
  - https://console.groq.com/docs/legal/services-agreement (modificado el 22 de junio de 2026);
  - https://console.groq.com/docs/legal/customer-data-processing-addendum.
- OpenRouter (actualizadas el 31 de agosto de 2026):
  - https://openrouter.ai/terms;
  - https://openrouter.ai/privacy;
  - https://openrouter.ai/docs/guides/privacy/data-collection;
  - https://openrouter.ai/docs/features/provider-routing.

## Modelos y su función

- Esta revisión la ha hecho Claude Opus 5.5 con un agente que leyó las fuentes web y citó el texto literal.
- En el producto, la IA es opcional. Uso de cada modelo:
  - **Ollama** (`gemma3` u otro local): producción en casa.
  - **Claude Haiku 5.5** o **Gemini de pago**: producción con la clave del usuario.
  - **Gemini gratuito, Groq, OpenRouter y NVIDIA**: solo desarrollo y pruebas.
