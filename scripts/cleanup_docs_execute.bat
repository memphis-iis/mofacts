@echo off
REM Documentation Cleanup Script for Windows
REM Generated: 2025-11-09
REM Run from project root: scripts\cleanup_docs_execute.bat

echo ========================================
echo MoFaCTS Documentation Cleanup
echo ========================================
echo.

REM Change to docs_dev directory
cd "c:\Users\ppavl\OneDrive\Active projects\mofacts\docs_dev"

echo Phase 1: Delete Empty/Redundant Files
echo --------------------------------------
if exist "main_developement_plan.md" (
    del "main_developement_plan.md"
    echo [DELETED] main_developement_plan.md ^(0 bytes^)
)
if exist "WARMUP_IMPLEMENTATION_CODE.md" (
    del "WARMUP_IMPLEMENTATION_CODE.md"
    echo [DELETED] WARMUP_IMPLEMENTATION_CODE.md ^(26 lines^)
)
echo.

echo Phase 2: Create Archive Directories
echo ------------------------------------
mkdir "archive\completed_tts_fixes" 2>nul
echo [CREATED] archive\completed_tts_fixes\
mkdir "archive\completed_input_fixes" 2>nul
echo [CREATED] archive\completed_input_fixes\
mkdir "archive\completed_phase1" 2>nul
echo [CREATED] archive\completed_phase1\
mkdir "archive\completed_features" 2>nul
echo [CREATED] archive\completed_features\
echo.

echo Phase 3: Archive Completed Work
echo --------------------------------
echo.
echo 3A. TTS Fixes ^(6 files^) -^> archive\completed_tts_fixes\
if exist "TTS_SESSION_FIXES_SUMMARY.md" (
    move "TTS_SESSION_FIXES_SUMMARY.md" "archive\completed_tts_fixes\"
    echo [MOVED] TTS_SESSION_FIXES_SUMMARY.md
)
if exist "TTS_REVIEWSTUDY_TIMEOUT_FIX.md" (
    move "TTS_REVIEWSTUDY_TIMEOUT_FIX.md" "archive\completed_tts_fixes\"
    echo [MOVED] TTS_REVIEWSTUDY_TIMEOUT_FIX.md
)
if exist "TTS_WARMUP_HOT_RELOAD_FIX.md" (
    move "TTS_WARMUP_HOT_RELOAD_FIX.md" "archive\completed_tts_fixes\"
    echo [MOVED] TTS_WARMUP_HOT_RELOAD_FIX.md
)
if exist "TTS_RECORDING_LOCK_FIX.md" (
    move "TTS_RECORDING_LOCK_FIX.md" "archive\completed_tts_fixes\"
    echo [MOVED] TTS_RECORDING_LOCK_FIX.md
)
if exist "TTS_SPECIFIC_RACE_CONDITION.md" (
    move "TTS_SPECIFIC_RACE_CONDITION.md" "archive\completed_tts_fixes\"
    echo [MOVED] TTS_SPECIFIC_RACE_CONDITION.md
)
if exist "DUPLICATE_TTS_FEEDBACK_RACE_CONDITION.md" (
    move "DUPLICATE_TTS_FEEDBACK_RACE_CONDITION.md" "archive\completed_tts_fixes\"
    echo [MOVED] DUPLICATE_TTS_FEEDBACK_RACE_CONDITION.md
)
echo.

echo 3B. Input Fixes ^(2 files^) -^> archive\completed_input_fixes\
if exist "INPUT_LIFECYCLE_AUDIT.md" (
    move "INPUT_LIFECYCLE_AUDIT.md" "archive\completed_input_fixes\"
    echo [MOVED] INPUT_LIFECYCLE_AUDIT.md
)
if exist "INPUT_FLICKER_INVESTIGATION.md" (
    move "INPUT_FLICKER_INVESTIGATION.md" "archive\completed_input_fixes\"
    echo [MOVED] INPUT_FLICKER_INVESTIGATION.md
)
echo.

echo 3C. Phase 1 Optimization ^(1 file^) -^> archive\completed_phase1\
if exist "SERVER_OPTIMIZATION_PHASE1.md" (
    move "SERVER_OPTIMIZATION_PHASE1.md" "archive\completed_phase1\"
    echo [MOVED] SERVER_OPTIMIZATION_PHASE1.md
)
echo.

echo ========================================
echo Cleanup Complete!
echo ========================================
echo.
echo Files deleted: 2
echo Files archived: 9
echo.
echo Next steps:
echo 1. Review archive directories
echo 2. Create README.md files in archive dirs
echo 3. Update docs_dev\README.md
echo 4. Commit changes
echo.
echo To restore archived files:
echo   move archive\completed_tts_fixes\*.md .
echo.
pause
