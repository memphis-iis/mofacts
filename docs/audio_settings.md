# Audio & Speech Settings

The tables below summarize every JSON tag that controls speech recognition (SR) or text-to-speech (TTS) behaviour in `mofacts_config` tutor files. All settings live inside the tutor `setspec` unless otherwise noted. Values are stored as strings in JSON (e.g. `"true"`).

## Speech Recognition (Microphone Input)
| Setting | Location | Options | Default | Description |
|---------|----------|---------|---------|-------------|
| `speechAPIKey` | `setspec` | Google Cloud Speech API key | _unset_ | Required for SR; without a key the microphone toggle is hidden. |
| `audioInputEnabled` | `setspec` | `"true"` \| `"false"` | `"false"` | Enables SR for the lesson. Must be `"true"` _and_ the user must toggle the mic on in the UI. |
| `audioInputSensitivity` | `setspec` | `0`-`60` (integer) | `20` | Microphone energy threshold presented on the profile slider. Higher values ignore quieter audio. |
| `speechIgnoreOutOfGrammarResponses` | `setspec` | `"true"` \| `"false"` | `"false"` | When `"true"`, SR ignores transcripts that are not in the current answer set. |
| `speechOutOfGrammarFeedback` | `setspec` | string | `"Response not in answer set"` | Message shown when an out-of-grammar transcript is discarded. |
| `autostopTranscriptionAttemptLimit` | `deliveryparams` | integer (count) | _unset_ | Maximum number of SR attempts before the system stops listening automatically. |

## Text-to-Speech & Audio Prompts
| Setting | Location | Options | Default | Description |
|---------|----------|---------|---------|-------------|
| `enableAudioPromptAndFeedback` | `setspec` | `"true"` \| `"false"` | `"false"` | Advertises that the lesson supports audio prompts/feedback (shows the headphone icon). |
| `textToSpeechAPIKey` | `setspec` | Google Cloud TTS key | _unset_ | If set, server-side TTS is used; otherwise the browser fallback voice handles prompts. |
| `audioPromptMode` | `setspec` | `"silent"` \| `"question"` \| `"feedback"` \| `"all"` | `"silent"` | Default prompt mode applied when a learner opens the lesson. Users can toggle modes in the Audio dialog. |
| `audioPromptVoice` | `setspec` | Google/SSML voice id | `"en-US-Standard-A"` | Voice used for question prompts (when TTS is available). |
| `audioPromptFeedbackVoice` | `setspec` | Google/SSML voice id | `"en-US-Standard-A"` | Voice used for feedback prompts. |
| `audioPromptQuestionSpeakingRate` | `setspec` | 0.25-4.0 (float) | `1` | Speed multiplier for question prompts. |
| `audioPromptFeedbackSpeakingRate` | `setspec` | 0.25-4.0 (float) | `1` | Speed multiplier for feedback prompts. |
| `audioPromptQuestionVolume` | `setspec` | -6 to 6 (dB) | `0` | Gain applied to question prompts. |
| `audioPromptFeedbackVolume` | `setspec` | -6 to 6 (dB) | `0` | Gain applied to feedback prompts. |
| `audioPromptSpeakingRate` | `setspec` | 0.25-4.0 (float) | `1` | Legacy overall speaking rate; used if voice-specific rates are omitted. |

## Delivery Timing & Feedback
| Setting | Location | Options | Default | Description |
|---------|----------|---------|---------|-------------|
| `timeuntilaudio` | `deliveryparams` | integer (ms) | `0` | Delay before playing question audio/TTS for a prompt. |
| `timeuntilaudiofeedback` | `deliveryparams` | integer (ms) | `0` | Delay before playing feedback audio after a response. |
| `prestimulusdisplaytime` | `deliveryparams` | integer (ms) | _unset_ | Optional pre-stimulus display period before SR/TTS begins. |

### API Key Usage
- In experiment logins (and other routes that set `useEmbeddedAPIKeys` to `true`), the lesson's embedded keys (`speechAPIKey`, `textToSpeechAPIKey`) are sent directly to Google for both SR and TTS.
- In the normal profile flow (`useEmbeddedAPIKeys` remains `false`), Text-to-Speech still uses the embedded `textToSpeechAPIKey` when present; if the call fails the browser's `speechSynthesis` API is used as a fallback.
- For Speech Recognition outside experiment mode, MoFaCTS first tries the learner's saved key (`Meteor.user().speechAPIKey`). If none is stored, prompt the learner to enter one or switch to a flow that enables `useEmbeddedAPIKeys`; otherwise SR requests only reach Google automatically during experiment sessions.

### Notes
- All settings are case-sensitive and must remain strings (`"true"`, not `true`).
- When no `textToSpeechAPIKey` is present, MoFaCTS falls back to the browser's built-in `speechSynthesis` for any enabled prompts.
- Learners can override prompt modes (`silent`, `question`, `feedback`, `all`) and mic use during a session; the values above only establish the starting configuration.
