#!/bin/bash
# Documentation Cleanup Script for Linux/Mac
# Generated: 2025-11-09
# Run from project root: bash scripts/cleanup_docs_execute.sh

set -e  # Exit on error

echo "========================================"
echo "MoFaCTS Documentation Cleanup"
echo "========================================"
echo

# Change to docs_dev directory
cd "$(dirname "$0")/../docs_dev" || exit 1

echo "Phase 1: Delete Empty/Redundant Files"
echo "--------------------------------------"
if [ -f "main_developement_plan.md" ]; then
    rm "main_developement_plan.md"
    echo "[DELETED] main_developement_plan.md (0 bytes)"
fi
if [ -f "WARMUP_IMPLEMENTATION_CODE.md" ]; then
    rm "WARMUP_IMPLEMENTATION_CODE.md"
    echo "[DELETED] WARMUP_IMPLEMENTATION_CODE.md (26 lines)"
fi
echo

echo "Phase 2: Create Archive Directories"
echo "------------------------------------"
mkdir -p "archive/completed_tts_fixes"
echo "[CREATED] archive/completed_tts_fixes/"
mkdir -p "archive/completed_input_fixes"
echo "[CREATED] archive/completed_input_fixes/"
mkdir -p "archive/completed_phase1"
echo "[CREATED] archive/completed_phase1/"
mkdir -p "archive/completed_features"
echo "[CREATED] archive/completed_features/"
echo

echo "Phase 3: Archive Completed Work"
echo "--------------------------------"
echo
echo "3A. TTS Fixes (6 files) -> archive/completed_tts_fixes/"
[ -f "TTS_SESSION_FIXES_SUMMARY.md" ] && mv "TTS_SESSION_FIXES_SUMMARY.md" "archive/completed_tts_fixes/" && echo "[MOVED] TTS_SESSION_FIXES_SUMMARY.md"
[ -f "TTS_REVIEWSTUDY_TIMEOUT_FIX.md" ] && mv "TTS_REVIEWSTUDY_TIMEOUT_FIX.md" "archive/completed_tts_fixes/" && echo "[MOVED] TTS_REVIEWSTUDY_TIMEOUT_FIX.md"
[ -f "TTS_WARMUP_HOT_RELOAD_FIX.md" ] && mv "TTS_WARMUP_HOT_RELOAD_FIX.md" "archive/completed_tts_fixes/" && echo "[MOVED] TTS_WARMUP_HOT_RELOAD_FIX.md"
[ -f "TTS_RECORDING_LOCK_FIX.md" ] && mv "TTS_RECORDING_LOCK_FIX.md" "archive/completed_tts_fixes/" && echo "[MOVED] TTS_RECORDING_LOCK_FIX.md"
[ -f "TTS_SPECIFIC_RACE_CONDITION.md" ] && mv "TTS_SPECIFIC_RACE_CONDITION.md" "archive/completed_tts_fixes/" && echo "[MOVED] TTS_SPECIFIC_RACE_CONDITION.md"
[ -f "DUPLICATE_TTS_FEEDBACK_RACE_CONDITION.md" ] && mv "DUPLICATE_TTS_FEEDBACK_RACE_CONDITION.md" "archive/completed_tts_fixes/" && echo "[MOVED] DUPLICATE_TTS_FEEDBACK_RACE_CONDITION.md"
echo

echo "3B. Input Fixes (2 files) -> archive/completed_input_fixes/"
[ -f "INPUT_LIFECYCLE_AUDIT.md" ] && mv "INPUT_LIFECYCLE_AUDIT.md" "archive/completed_input_fixes/" && echo "[MOVED] INPUT_LIFECYCLE_AUDIT.md"
[ -f "INPUT_FLICKER_INVESTIGATION.md" ] && mv "INPUT_FLICKER_INVESTIGATION.md" "archive/completed_input_fixes/" && echo "[MOVED] INPUT_FLICKER_INVESTIGATION.md"
echo

echo "3C. Phase 1 Optimization (1 file) -> archive/completed_phase1/"
[ -f "SERVER_OPTIMIZATION_PHASE1.md" ] && mv "SERVER_OPTIMIZATION_PHASE1.md" "archive/completed_phase1/" && echo "[MOVED] SERVER_OPTIMIZATION_PHASE1.md"
echo

echo "========================================"
echo "Cleanup Complete!"
echo "========================================"
echo
echo "Files deleted: 2"
echo "Files archived: 9"
echo
echo "Next steps:"
echo "1. Review archive directories"
echo "2. Create README.md files in archive dirs"
echo "3. Update docs_dev/README.md"
echo "4. Commit changes"
echo
echo "To restore archived files:"
echo "  mv archive/completed_tts_fixes/*.md ."
echo
