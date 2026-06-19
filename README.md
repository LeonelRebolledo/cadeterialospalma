# Cadeteria Los Palmas

Aplicacion web estatica pensada para celular para:

- pedir permiso de ubicacion
- cargar empresa en mayusculas
- elegir `DESPACHO` o `ENTREGA`
- tomar foto de `PRODUCTO`
- tomar foto de `REMITO`
- avanzar con `SIGUIENTE` para sumar otra parada
- generar un PDF final con `FIN`

## Archivos

- `index.html`
- `styles.css`
- `app.js`

## Uso rapido

Para probarla en la PC, abre `index.html`.

Para usar ubicacion y camara en el celular, conviene servirla por `https` o `localhost`. Si la abres como archivo `file://`, algunos navegadores pueden bloquear permisos.

## Opcion simple de servidor local

Con el Python incluido en Codex:

```powershell
& 'C:\Users\Rejede\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8080
```

Luego abre:

- `http://localhost:8080` en la misma PC

## Nota para celular real

Si la vas a usar directamente desde el telefono, lo ideal es subir estos archivos a un hosting con `https` para que permisos de ubicacion y experiencia de camara funcionen mejor.
