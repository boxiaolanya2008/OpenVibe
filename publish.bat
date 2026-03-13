@echo off
echo ============================================
echo  OpenVibe Publish Script (Parallel)
echo ============================================
echo.

echo Step 1: Building...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)
echo Build success!
echo.

echo Step 2: Opening 4 windows for parallel publish...
echo.

set BASE=%CD%

:: Create temp batch files for each package
echo @echo off > %TEMP%\pub_ai.bat
echo cd /d %BASE%\packages\ai >> %TEMP%\pub_ai.bat
echo npm publish --access public --otp=19db811d4c48c9ab1074bf42188c66c4d7efaf9dbbf21d5d84625f81944b4191 >> %TEMP%\pub_ai.bat
echo if errorlevel 1 (pause) else (echo Success! ^& timeout /t 3) >> %TEMP%\pub_ai.bat

echo @echo off > %TEMP%\pub_tui.bat
echo cd /d %BASE%\packages\tui >> %TEMP%\pub_tui.bat
echo npm publish --access public --otp=3e74b8ceb15301d736071b36f21d1fbacc1d1fbba8cf545fbf7558455769dff5 >> %TEMP%\pub_tui.bat
echo if errorlevel 1 (pause) else (echo Success! ^& timeout /t 3) >> %TEMP%\pub_tui.bat

echo @echo off > %TEMP%\pub_agent.bat
echo cd /d %BASE%\packages\agent >> %TEMP%\pub_agent.bat
echo npm publish --access public --otp=ea09d8c898ad525fbcdef74a04fd3c7049bd8f435e56aef6a4eb6976b09291ad >> %TEMP%\pub_agent.bat
echo if errorlevel 1 (pause) else (echo Success! ^& timeout /t 3) >> %TEMP%\pub_agent.bat

echo @echo off > %TEMP%\pub_main.bat
echo cd /d %BASE%\packages\coding-agent >> %TEMP%\pub_main.bat
echo npm publish --access public --otp=3333ae656e88273adf0dd7e3b5c3cb5fe02b5f772291d2ed866fba01a9da5ed9 >> %TEMP%\pub_main.bat
echo if errorlevel 1 (pause) else (echo Success! ^& timeout /t 3) >> %TEMP%\pub_main.bat

:: Launch all 4 windows
start "[1/4] Publishing pi-ai" cmd /k "%TEMP%\pub_ai.bat"
start "[2/4] Publishing pi-tui" cmd /k "%TEMP%\pub_tui.bat"
start "[3/4] Publishing pi-agent-core" cmd /k "%TEMP%\pub_agent.bat"
start "[4/4] Publishing openvibe" cmd /k "%TEMP%\pub_main.bat"

echo.
echo 4 windows opened! Each will show the result.
echo.
pause
