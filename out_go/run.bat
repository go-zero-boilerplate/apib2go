@echo off
cls
SET ERRORLEVEL=0

::——————————————————— This will make it quit immediately upon pressing Ctrl+C instead of first asking yes/no
IF "%~1"=="–FIX_CTRL_C" (
SHIFT
) ELSE (
CALL <NUL %0 –FIX_CTRL_C %*
GOTO EOF
)
::———————————————————

echo build & go build -o "tmp.exe"  & if errorlevel 1 goto ERROR
echo run   & tmp.exe                & if errorlevel 1 goto ERROR

goto SUCCESS

:SUCCESS
echo Success!!
goto EOF

:ERROR
echo ERROR!!! See the last ran command
pause
goto EOF

:EOF