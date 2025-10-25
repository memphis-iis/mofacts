@echo off
REM Meteor 2.0 Upgrade - Docker Image Backup Script (Windows)
REM Purpose: Create a backup of the current working Docker image before upgrade
REM Date: January 2025

echo ==========================================
echo Meteor 2.0 Upgrade - Docker Image Backup
echo ==========================================
echo.

REM Configuration
set CURRENT_IMAGE=ppavlikmemphis/mofacts-mini:upgrades
set BACKUP_TAG=ppavlikmemphis/mofacts-mini:pre-2.0-meteor-1.12-backup

echo Current image: %CURRENT_IMAGE%
echo Backup tag: %BACKUP_TAG%
echo.

REM Step 1: Pull current image
echo Step 1: Pulling current working image...
docker pull %CURRENT_IMAGE%

if %errorlevel% neq 0 (
    echo ERROR: Failed to pull current image
    pause
    exit /b 1
)
echo OK Current image pulled successfully
echo.

REM Step 2: Tag as backup
echo Step 2: Creating backup tag...
docker tag %CURRENT_IMAGE% %BACKUP_TAG%

if %errorlevel% neq 0 (
    echo ERROR: Failed to create backup tag
    pause
    exit /b 1
)
echo OK Backup tag created successfully
echo.

REM Step 3: Push backup to Docker Hub
echo Step 3: Pushing backup to Docker Hub...
echo (This may take a few minutes...)
docker push %BACKUP_TAG%

if %errorlevel% neq 0 (
    echo ERROR: Failed to push backup to Docker Hub
    echo Make sure you're logged in: docker login
    pause
    exit /b 1
)
echo OK Backup pushed to Docker Hub successfully
echo.

REM Verify
echo ==========================================
echo Backup Complete!
echo ==========================================
echo.
echo Backup image: %BACKUP_TAG%
echo.
echo To verify the backup exists:
echo   docker images ^| findstr "pre-2.0"
echo.
echo To rollback if needed (on server):
echo   1. Edit docker-compose.yml:
echo      image: %BACKUP_TAG%
echo   2. sudo docker compose pull
echo   3. sudo docker compose down
echo   4. sudo docker compose up -d
echo.
echo You can now proceed with the Meteor 2.0 upgrade!
echo See: docs_dev\METEOR_2.0_UPGRADE_GUIDE.md
echo.

pause
