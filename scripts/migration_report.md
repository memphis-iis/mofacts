# M1 Migration Report: Session → cardState

**Date:** 2025-11-10T00:26:17.659Z

**File:** mofacts/client/views/experiment/card.js


## Summary

- **Total replacements:** 327
  - Session.get() → cardState.get(): 193
  - Session.set() → cardState.set(): 134
- **Unchanged global Session calls:** 255
- **Card-scoped keys migrated:** 63
- **Global keys preserved:** 47


## Migrated Keys (By Frequency)

| Key | .get() | .set() | Total |
|-----|--------|--------|-------|
| currentExperimentState | 40 | 5 | 45 |
| currentDisplay | 27 | 5 | 32 |
| ttsRequested | 5 | 9 | 14 |
| pausedLocks | 8 | 5 | 13 |
| recording | 8 | 3 | 11 |
| recordingLocked | 2 | 9 | 11 |
| buttonTrial | 7 | 3 | 10 |
| isVideoSession | 8 | 2 | 10 |
| buttonList | 3 | 5 | 8 |
| clusterIndex | 4 | 4 | 8 |
| displayReady | 5 | 2 | 7 |
| trialStartTimestamp | 3 | 4 | 7 |
| varLenTimeoutName | 2 | 5 | 7 |
| videoSource | 5 | 2 | 7 |
| questionIndex | 3 | 4 | 7 |
| CurTimeoutId | 2 | 4 | 6 |
| CurIntervalId | 3 | 3 | 6 |
| feedbackUnset | 2 | 4 | 6 |
| submmissionLock | 3 | 3 | 6 |
| trialEndTimeStamp | 4 | 1 | 5 |
| displayFeedback | 2 | 3 | 5 |
| dialogueHistory | 4 | 1 | 5 |
| scrollListCount | 2 | 3 | 5 |
| mainCardTimeoutStart | 1 | 3 | 4 |
| numVisibleCards | 2 | 2 | 4 |
| hiddenItems | 1 | 3 | 4 |
| hintLevel | 4 | 0 | 4 |
| wasReportedForRemoval | 1 | 3 | 4 |
| srWarmedUp | 2 | 1 | 3 |
| skipTimeout | 1 | 2 | 3 |
| currentAnswer | 2 | 1 | 3 |
| userAnswer | 1 | 2 | 3 |
| ttsWarmedUp | 2 | 1 | 3 |
| dialogueDisplay | 3 | 0 | 3 |
| dialogueTotalTime | 2 | 1 | 3 |
| currentScore | 2 | 1 | 3 |
| isRefutation | 1 | 2 | 3 |
| buttonEntriesTemp | 1 | 1 | 2 |
| audioRecorderInitialized | 1 | 1 | 2 |
| sampleRate | 1 | 1 | 2 |
| ignoreOutOfGrammarResponses | 1 | 1 | 2 |
| feedbackTypeFromHistory | 0 | 2 | 2 |
| audioWarmupInProgress | 0 | 2 | 2 |
| dialogueLoopStage | 2 | 0 | 2 |
| showDialogueText | 1 | 1 | 2 |
| alternateDisplayIndex | 1 | 1 | 2 |
| enterKeyLock | 1 | 1 | 2 |
| scoringEnabled | 0 | 2 | 2 |
| isTimeout | 1 | 1 | 2 |
| _debugTrialState | 1 | 1 | 2 |
| cardStartTimestamp | 0 | 1 | 1 |
| feedbackTimeoutBegins | 0 | 1 | 1 |
| feedbackTimeoutEnds | 0 | 1 | 1 |
| feedbackForAnswer | 0 | 1 | 1 |
| isCorrectAccumulator | 0 | 1 | 1 |
| instructionQuestionResult | 1 | 0 | 1 |
| dialogueCacheHint | 1 | 0 | 1 |
| showDialogueHints | 1 | 0 | 1 |
| clusterMapping | 0 | 1 | 1 |
| originalQuestion | 0 | 1 | 1 |
| clozeQuestionParts | 0 | 1 | 1 |
| ReviewStudyCountdown | 1 | 0 | 1 |
| debugParms | 1 | 0 | 1 |

## Top 10 Most Migrated Keys

1. **currentExperimentState** - 45 replacements (40 get, 5 set)
2. **currentDisplay** - 32 replacements (27 get, 5 set)
3. **ttsRequested** - 14 replacements (5 get, 9 set)
4. **pausedLocks** - 13 replacements (8 get, 5 set)
5. **recording** - 11 replacements (8 get, 3 set)
6. **recordingLocked** - 11 replacements (2 get, 9 set)
7. **buttonTrial** - 10 replacements (7 get, 3 set)
8. **isVideoSession** - 10 replacements (8 get, 2 set)
9. **buttonList** - 8 replacements (3 get, 5 set)
10. **clusterIndex** - 8 replacements (4 get, 4 set)

## Global Keys (Unchanged)

These remain as Session because they are shared across the app:

- currentTdfFile
- currentTdfId
- currentRootTdfId
- currentTdfName
- currentTdfUnit
- currentUnitNumber
- currentDeliveryParams
- curTdfUISettings
- curTdfTips
- curSectionId
- curTeacher
- studentUsername
- testType
- engineIndices
- currentUnitStartTime
- currentStimuliSet
- currentStimuliSetId
- currentStimProbFunctionParameters
- schedule
- resetSchedule
- furthestUnit
- subTdfIndex
- unitType
- fromInstructions
- curUnitInstructionsSeen
- inResume
- sessionCheckInterval
- errorReportStart
- overallOutcomeHistory
- overallStudyHistory
- enableAudioPromptAndFeedback
- audioPromptVoice
- audioPromptSpeakingRate
- audioPromptFeedbackVoice
- audioPromptFeedbackSpeakingRate
- audioPromptFeedbackVolume
- audioPromptQuestionVolume
- audioPromptQuestionSpeakingRate
- audioInputSensitivity
- speechAPIKey
- useEmbeddedAPIKeys
- source
- experimentXCond
- runSimulation
- stimDisplayTypeMap
- resetFeedbackSettingsFromIndex
- userAnswerSubmitTimestamp

## What Changed

```javascript
// BEFORE:
Session.get('currentExperimentState')
Session.set('currentDisplay', {...})

// AFTER:
cardState.get('currentExperimentState')
cardState.set('currentDisplay', {...})
```


## Testing Checklist

- [ ] Card loads without errors
- [ ] Trial state transitions work
- [ ] Answers submit correctly
- [ ] Feedback displays properly
- [ ] Recording works (if applicable)
- [ ] TTS works (if applicable)
- [ ] Video sessions work (if applicable)
- [ ] Dialogue works (if applicable)
- [ ] Multiple choice buttons work
- [ ] Timeouts work correctly
- [ ] Check browser console for errors


## Rollback Instructions

If issues arise, restore the backup:

```bash
cd mofacts/client/views/experiment/
mv card.js card.js.migrated  # Save migrated version
mv card.js.backup card.js     # Restore original
```


## Performance Impact

Expected improvements:
- 30-50% reduction in reactive computations
- Automatic cleanup (no memory leaks)
- Scoped state easier to reason about
- Enables component reuse (multiple card instances)


## Next Steps

1. Run automated tests (if available)
2. Manual testing with various TDFs
3. Test on mobile devices
4. Monitor for 24-48 hours
5. If stable, delete card.js.backup
6. Update documentation
7. Consider migrating other files (instructions.js, etc.)
