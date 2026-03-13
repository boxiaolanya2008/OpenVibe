@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ============================================
echo  OpenVibe 一键发布到 npm
echo ============================================
echo.

set BASE_DIR=%~dp0
set OTP1=19db811d4c48c9ab1074bf42188c66c4d7efaf9dbbf21d5d84625f81944b4191
set OTP2=3e74b8ceb15301d736071b36f21d1fbacc1d1fbba8cf545fbf7558455769dff5
set OTP3=ea09d8c898ad525fbcdef74a04fd3c7049bd8f435e56aef6a4eb6976b09291ad
set OTP4=3333ae656e88273adf0dd7e3b5c3cb5fe02b5f772291d2ed866fba01a9da5ed9
set OTP5=94da50e433d6d5dd13cb9264cb5c351915e50a5b2e1ffab5d4dbbf9a969dcaa3

:menu
echo 请选择操作：
echo.
echo  [1] 仅发布（跳过构建）
echo  [2] 先构建，再发布
echo  [3] 仅构建
echo  [4] 退出
echo.
set /p choice="输入数字 (1-4): "

if "%choice%"=="1" goto publish_only
if "%choice%"=="2" goto build_and_publish
if "%choice%"=="3" goto build_only
if "%choice%"=="4" exit /b 0
goto menu

:build_only
echo.
echo ============================================
echo  开始构建...
echo ============================================
cd /d %BASE_DIR%
npm run build
if errorlevel 1 (
    echo ❌ 构建失败!
    pause
    goto menu
)
echo ✅ 构建成功!
pause
goto menu

:build_and_publish
echo.
echo ============================================
echo  开始构建...
echo ============================================
cd /d %BASE_DIR%
npm run build
if errorlevel 1 (
    echo ❌ 构建失败!
    pause
    goto menu
)
echo ✅ 构建成功!
echo.

:publish_only
echo ============================================
echo  开始并行发布...
echo ============================================
echo.
echo 将打开 4 个命令窗口同时发布：
echo   1. @boxiaolanya2008/pi-ai
echo   2. @boxiaolanya2008/pi-tui  
echo   3. @boxiaolanya2008/pi-agent-core
echo   4. openvibe
echo.
echo 备用 OTP: %OTP5%
echo.

:: 窗口1: pi-ai
start "[1/4] 发布 pi-ai" cmd /c "cd /d %BASE_DIR%packages\ai ^&^& echo ======================================== ^&^& echo  发布 @boxiaolanya2008/pi-ai ^&^& echo ======================================== ^&^& npm publish --access public --otp=%OTP1% ^&^& if errorlevel 1 (echo. ^&^& echo ❌ 发布失败，请重试 ^&^& pause) else (echo. ^&^& echo ✅ pi-ai 发布成功! ^&^& timeout /t 3)"

:: 窗口2: pi-tui  
start "[2/4] 发布 pi-tui" cmd /c "cd /d %BASE_DIR%packages\tui ^&^& echo ======================================== ^&^& echo  发布 @boxiaolanya2008/pi-tui ^&^& echo ======================================== ^&^& npm publish --access public --otp=%OTP2% ^&^& if errorlevel 1 (echo. ^&^& echo ❌ 发布失败，请重试 ^&^& pause) else (echo. ^&^& echo ✅ pi-tui 发布成功! ^&^& timeout /t 3)"

:: 窗口3: pi-agent-core
start "[3/4] 发布 pi-agent-core" cmd /c "cd /d %BASE_DIR%packages\agent ^&^& echo ======================================== ^&^& echo  发布 @boxiaolanya2008/pi-agent-core ^&^& echo ======================================== ^&^& npm publish --access public --otp=%OTP3% ^&^& if errorlevel 1 (echo. ^&^& echo ❌ 发布失败，请重试 ^&^& pause) else (echo. ^&^& echo ✅ pi-agent-core 发布成功! ^&^& timeout /t 3)"

:: 窗口4: openvibe
start "[4/4] 发布 openvibe" cmd /c "cd /d %BASE_DIR%packages\coding-agent ^&^& echo ======================================== ^&^& echo  发布 openvibe ^&^& echo ======================================== ^&^& npm publish --access public --otp=%OTP4% ^&^& if errorlevel 1 (echo. ^&^& echo ❌ 发布失败，请重试 ^&^& pause) else (echo. ^&^& echo ✅ openvibe 发布成功! ^&^& timeout /t 3)"

echo ✅ 已打开 4 个发布窗口
echo.
echo 提示：
echo   - 每个窗口会显示发布结果
echo   - 如果失败会暂停等待
echo   - 成功后会自动关闭（3秒）
echo   - 备用 OTP: %OTP5%
echo.
pause
goto menu
