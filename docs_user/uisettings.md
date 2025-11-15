# MoFaCTS UI Settings

MoFaCTS reads `uiSettings` from the tutor definition file. Most options can be supplied globally in `setspec.uiSettings` and overridden per unit; the login prompt text is lesson-only and comes strictly from `setspec`.

## Lesson-Level Only (setspec.uiSettings)
| uiSetting Name | Options | Default | Description |
|----------------|---------|---------|-------------|
| `experimentLoginText` | string | "Amazon Turk ID" | Supplies the prompt text shown on the experiment login screen before any units run. Retrieved exclusively from `setspec.uiSettings`. |

## Shared Lesson/Unit Settings
The following settings can be defined in `setspec.uiSettings` for a lesson-wide default or overridden within individual units via `unit.uiSettings`.

### Main Trial Interface (question on screen)
| uiSetting Name | Options | Default | Description |
|----------------|---------|---------|-------------|
| `displayCardTimeoutAsBarOrText` | "both" \| "bar" \| "text" \| "false" | "both" | Controls the countdown shown while the main prompt is visible. |
| `displayTimeOutDuringStudy` | true \| false | true | Shows or hides the main-prompt timer during study trials. |
| `displayPerformanceDuringStudy` | true \| false | false | Toggles live performance indicators during study trials. |
| `displayPerformanceDuringTrial` | true \| false | true | Toggles live performance indicators during drill/test trials. |
| `stimuliPosition` | "top" \| "left" | "top" | Sets the placement of the prompt relative to the response area. |
| `choiceButtonCols` | number | 1 | Sets the number of columns used for multiple-choice options. |
| `showStimuliBox` | true \| false | true | Adds or removes the background frame around the prompt. |
| `stimuliBoxColor` | CSS color \| Bootstrap class | "alert-bg" | Defines the color/class applied to the prompt frame. |
| `inputPlaceholderText` | string | "Type your answer here..." | Sets placeholder text inside open-response inputs. |

### Pre-Trial & Navigation Controls (before advancing)
| uiSetting Name | Options | Default | Description |
|----------------|---------|---------|-------------|
| `displayReadyPromptTimeoutAsBarOrText` | "text" \| "false" | "false" | Shows or hides the ready-prompt countdown text. (Progress bar support removed.) |
| `displayConfirmButton` | true \| false | false | Adds a confirm button that must be enabled before moving past the current prompt. |
| `continueButtonText` | string | "Continue" | Provides the label used on Continue/Confirm buttons. |
| `skipStudyButtonText` | string | "Skip" | Labels the optional Skip Study button when present. |
| `instructionsTitleDisplay` | "headerOnly" \| true \| false | "headerOnly" | Controls the header shown on instruction screens preceding units. |
| `lastVideoModalText` | string | "This is the last video, do not progress unless finished with this lesson." | Overrides the message that appears in the final video modal before returning to prompts. |

### Feedback & Review Interface (after answering)
| uiSetting Name | Options | Default | Description |
|----------------|---------|---------|-------------|
| `displayReviewTimeoutAsBarOrText` | "both" \| "bar" \| "text" \| "false" | "both" | Chooses how the review countdown is shown after incorrect answers. |
| `displayUserAnswerInFeedback` | "onCorrect" \| "onIncorrect" \| true \| false | "onIncorrect" | Appends the learner's submitted response to the feedback label for the specified outcomes. When combined with simple feedback, the learner answer only shows if another element (such as the centered answer panel) is visible. |
| `displayCorrectAnswerInCenter` | true \| false | false | Moves the correct answer into the dedicated panel between the prompt and response area; helpful when the feedback label itself is kept short. |
| `singleLineFeedback` | true \| false | false | Keeps the feedback label on one line by stripping extra line breaks; set to false when the answer should drop beneath the Correct/Incorrect text. |
| `feedbackDisplayPosition` | "top" \| "middle" \| "bottom" | "middle" | Chooses whether the feedback label renders in the top prompt area, the center overlay, or the lower panel, changing where the Correct/Incorrect text (and any appended answer) appears. |
| `onlyShowSimpleFeedback` | "onCorrect" \| "onIncorrect" \| true \| false | "onCorrect" | Replaces the full feedback sentence with a colorized 'Correct.'/'Incorrect.' label for the selected outcomes; combine with the centered answer panel if you still need the answer visible. |
| `suppressFeedbackDisplay` | true \| false | false | Hides the feedback interface entirely, immediately advancing after an answer. |
| `incorrectColor` | HTML color | "darkorange" | Color used for "Incorrect" labels in feedback. |
| `correctColor` | HTML color | "green" | Color used for "Correct" labels in feedback. |

#### Feedback Interactions
- Turning on `onlyShowSimpleFeedback` keeps the top/bottom label concise; enable `displayCorrectAnswerInCenter` if you still want the full answer visible beneath the prompt.
- `singleLineFeedback` = true keeps the label inline, while false adds a break so the answer text can appear on the next line inside the same container.
- `feedbackDisplayPosition` swaps which DOM container receives the label: top (`UserInteraction`), middle (`feedbackOverride` overlay), or bottom (`userLowerInteraction`).
- `displayUserAnswerInFeedback` appends the learner response unless simple feedback replaces the message; pair it with the centered answer panel when you want both.







