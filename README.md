# Cadeteria Los Palma

Aplicacion web estatica pensada para celular para registrar paradas, sacar fotos desde camara, tomar ubicacion y generar un PDF final.

## Flujo actual

- pedir permiso de ubicacion
- cargar `EMPRESA` en mayusculas
- elegir `DESPACHO` o `ENTREGA`
- subir `DOCUMENTO` obligatorio
- subir `IMAGEN 1` obligatoria
- subir `IMAGEN 2`, `IMAGEN 3` e `IMAGEN 4` de forma opcional
- avanzar con `SIGUIENTE` para sumar otra parada
- generar el PDF final con `FIN`

## Archivos

- `index.html`
- `styles.css`
- `app.js`
- `partner-2026-06-18.png`

## Uso rapido

Para probarla en la PC, abre `index.html`.

Para usar ubicacion y camara en el celular, conviene servirla por `https` o `localhost`. Si se abre como `file://`, algunos navegadores pueden bloquear permisos.

## Servidor local simple

Con el Python incluido en Codex:

```powershell
& 'C:\Users\Rejede\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8080
```

Luego abre `http://localhost:8080`.

## Subir a GitHub

Comandos basicos:

```powershell
git init
git add .
git commit -m "App web de ruteo para Cadeteria Los Palma"
```

Si ya tienes un repositorio remoto:

```powershell
git remote add origin TU_URL
git branch -M main
git push -u origin main
```
