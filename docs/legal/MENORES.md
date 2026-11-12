# Aviso sobre los datos de los niños

Última revisión: 12 de noviembre de 2026. Es un texto orientativo, no asesoramiento legal.

## En resumen

Los niños no usan Lazo directamente. Su lista la llevan sus padres. De cada niño se guarda lo mínimo.

## Qué se guarda de un niño

- **El nombre de pila.** Nada de apellidos.
- **El año de nacimiento, si quieres.** Sirve para sugerir regalos por edad. Puedes dejarlo vacío.
- **Su lista de regalos**, como la de cualquiera.

No se guarda foto, ni fecha completa de nacimiento, ni colegio, ni ningún otro dato.

## Los niños no tienen cuenta

Un niño no entra en Lazo ni recibe invitaciones. Su lista la crean y la cuidan sus padres o tutores, que figuran como quienes la llevan.

## Quién lo ve

- Las personas del grupo ven el nombre del niño y su lista.
- Los padres que llevan la lista ven lo mismo que el resto del grupo, también lo reservado. Así pueden coordinar los regalos sin que el niño lo vea, porque el niño no entra.
- Quien monta el servidor de casa puede verlo desde el panel de administración.
- **La IA, si está activada, nunca recibe el nombre ni el año.** Solo una franja de edad, por ejemplo «6–8 años».

Los datos están en el servidor de casa de quien organiza, no en el de una empresa. Más detalles en [PRIVACIDAD.md](PRIVACIDAD.md).

## Cómo borrarlo

Pide a quien organiza el grupo que borre la lista del niño. Lo hace desde el panel de administración del servidor. Las copias de seguridad la conservan hasta que rotan, unos 14 días.

## La edad de consentimiento digital

En España, la ley (LOPDGDD, artículo 7) dice que a partir de los **14 años** una persona puede, en general, consentir por sí misma el uso de sus datos. Por debajo de esa edad hace falta el consentimiento de sus padres o tutores.

Lazo no está pensado para que lo usen menores con su propia cuenta. Si un chico o una chica de 14 años o más quiere llevar su propia lista, lo prudente es que lo decida con su familia. En caso de duda, consulta la información de la [Agencia Española de Protección de Datos](https://www.aepd.es).

## Modelos y su función

- **Claude Opus 5.5:** redactó este aviso a partir de `PRODUCT.md`, `SECURITY.md` y el código de `src/ai/tasks.ts` (la función `ageBand`).
- **Modelos de IA del producto** (opcionales): solo reciben la franja de edad del niño, nunca su nombre ni su año de nacimiento.
