@echo off
title Sushi Lin - Agent d'impression automatique
color 0A
echo ====================================================================
echo   SUSHI LIN - LANCEMENT DE L'AGENT D'IMPRESSION AUTOMATIQUE
echo ====================================================================
echo.
echo Verification de Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Python n'est pas installe ou non detecte sur cet ordinateur.
    echo Veuillez installer Python depuis https://www.python.org/downloads/
    pause
    exit /b
)

echo Connexion au serveur et surveillance des commandes en direct...
echo (Laissez cette fenetre ouverte pendant tout le service)
echo.
python sushilin_imprimante.py
pause
