@echo off
rem Crea en el escritorio un acceso directo "Goles encajados" con el icono
rem de la app. Deja este archivo en la MISMA carpeta que goles-encajados.html
rem e icono-goles.ico y haz doble clic.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c='%~dp0'; $d=[Environment]::GetFolderPath('Desktop'); $h=Join-Path $c 'goles-encajados.html'; $i=Join-Path $c 'icono-goles.ico'; if(!(Test-Path $h)){Write-Host 'No encuentro goles-encajados.html en esta carpeta.'; exit 1}; $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'Goles encajados.lnk')); $s.TargetPath=$h; $s.WorkingDirectory=$c; if(Test-Path $i){$s.IconLocation=$i}; $s.Save(); Write-Host 'Listo: acceso directo creado en el escritorio con el icono.'"
pause
