export {getItem, getComponentState, getCourse, getHistory, getTdf, getHistoryForMongo, migrateTdf};

function getItem(stim) {
  return {
    itemId: stim.itemid,
    stimuliSetId: stim.stimulisetid,
    stimulusFileName: stim.stimulusfilename,
    parentStimulusFileName: stim.parentStimulusFileName,
    stimulusKC: stim.stimuluskc,
    clusterKC: stim.clusterkc,
    responseKC: stim.responsekc,
    params: stim.params,
    optimalProb: stim.optimalprob,
    correctResponse: stim.correctresponse,
    incorrectResponses: stim.incorrectresponses,
    itemResponseType: stim.itemresponsetype,
    speechHintExclusionList: stim.speechhintexclusionlist,
    clozeStimulus: stim.clozestimulus,
    textStimulus: stim.textstimulus,
    audioStimulus: stim.audiostimulus,
    imageStimulus: stim.imagestimulus,
    videoStimulus: stim.videostimulus,
    alternateDisplays: stim.alternatedisplays,
    tags: stim.tags,
    syllables: stim.syllables,
  };
}

function getComponentState(componentState) {
  const outputComponentState = {
    componentStateId: componentState.componentstateid,
    userId: componentState.userid,
    TDFId: componentState.tdfid,
    KCId: componentState.kcid,
    hintLevel: componentState.hintlevel,
    componentType: componentState.componenttype,
    firstSeen: parseInt(componentState.firstseen),
    lastSeen: parseInt(componentState.lastseen),
    priorCorrect: componentState.priorcorrect,
    priorIncorrect: componentState.priorincorrect,
    curSessionPriorCorrect: componentState.cursessionpriorcorrect,
    curSessionPriorIncorrect: componentState.cursessionpriorincorrect,
    priorStudy: componentState.priorstudy,
    totalPracticeDuration: componentState.totalpracticeduration,
    outcomeStack: componentState.outcomestack.split(',').filter((x) => x!=='').map((x) => parseInt(x)),
    showItem: componentState.showitem,
    instructionQuestionResult: componentState.instructionquestionresult
  };
  if(componentState.firstseen != outputComponentState.firstSeen.toString()){
    console.log("orm error? ", componentState, outputComponentState);
  }
  if (componentState.componenttype==='stimulus') {
    outputComponentState.probabilityEstimate = parseFloat(componentState.probabilityestimate);
  } else if (componentState.componenttype==='cluster') {
    outputComponentState.trialsSinceLastSeen = componentState.trialsSinceLastSeen;
  }
  return outputComponentState;
}

function getCourse(course) {
  return {
    courseId: course.courseid,
    courseName: course.coursename,
    teacherUserId: course.teacheruserid,
    semester: course.semester,
    beginDate: course.begindate,
    endDate: course.enddate,
  };
}

function getHistory(history) {
  const historyOutput = {
    eventId: history.eventId,
    'Selection': '',
    'Action': '',
    'KC Category(Default)': '',
    'KC Category(Cluster)': '',
    'CF (Overlearning)': false,
    'CF (Note)': '',
    'CF (Dialogue History)': JSON.stringify(history.dialogueHistory),
    'itemid': history.itemId,
    'useridtdfid': history.userIdTDFId,
    'kcid': history.KCId,
    'responseduration': history.responseDuration,
    'probabilityestimate': history.probabilityEstimate,
    'typeofresponse': history.typeOfResponse,
    'responsevalue': history.responseValue,
    'displayedstimulus': JSON.stringify(history.displayedStimulus),
    'Anon Student Id': history.anonStudentId,
    'Session ID': history.sessionID,
    'Condition Namea': history.conditionNameA,
    'Condition Typea': history.conditionTypeA,
    'Condition Nameb': history.conditionNameB,
    'Condition Typeb': history.conditionTypeB,
    'Condition Namec': history.conditionNameC,
    'Condition Typec': history.conditionTypeC,
    'Condition Named': history.conditionNameD,
    'Condition Typed': history.conditionTypeD,
    'Condition Namee': history.conditionNameE,
    'Condition Typee': history.conditionTypeE,
    'Level (Unit)': history.levelUnit,
    'Level (Unitname)': history.levelUnitName,
    'Level (Unittype)': history.levelUnitType,
    'Problem Name': JSON.stringify(history.problemName),
    'Step Name': JSON.stringify(history.stepName),
    'Time': history.time,
    'Input': history.input,
    'Outcome': history.outcome,
    'Student Response Type': history.studentResponseType,
    'Student Response Subtype': history.studentResponseSubtype,
    'Tutor Response Type': history.tutorResponseType,
    'Tutor Response Subtype': "",
    'KC (Cluster)': history.KCCluster,
    'CF (Audio Input Enabled)': history.CFAudioInputEnabled,
    'CF (Audio Output Enabled)': history.CFAudioOutputEnabled,
    'CF (Display Order)': history.CFDisplayOrder,
    'CF (Stim File Index)': history.CFStimFileIndex,
    'CF (Set Shuffled Index)': history.CFSetShuffledIndex,
    'CF (Alternate Display Index)': history.CFAlternateDisplayIndex,
    'CF (Stimulus Version)': history.CFStimulusVersion,
    'CF (Correct Answer)': history.CFCorrectAnswer,
    'CF (Correct Answer Syllables)': history.CFCorrectAnswerSyllables,
    'CF (Correct Answer Syllables Count)': history.CFCorrectAnswerSyllablesCount,
    'CF (Display Syllable Indices)': history.CFDisplaySyllableIndices,
    'CF (Displayed Hint Syllables)': history.CFDisplayedHintSyllables,
    'CF (Response Time)': history.CFResponseTime,
    'CF (Start Latency)': history.CFStartLatency,
    'CF (End Latency)': history.CFEndLatency,
    'CF (Feedback Latency)': history.CFFeedbackLatency,
    'CF (Review Entry)': history.CFReviewEntry,
    'CF (Button Order)': history.CFButtonOrder,
    'CF (Item Removed)': history.CFItemRemoved,
    'CF (Entry Point)': history.entryPoint,
    'CF (Video TimeStamp)': history.CFVideoTimeStamp,
    'CF (Video Seek Start)': history.CFVideoSeekStart,
    'CF (Video Seek End)': history.CFVideoSeekEnd,
    'CF (Video Current Speed)': history.CFVideoCurrentSpeed,
    'CF (Video Current Volume)': history.CFVideoCurrentVolume,
    'CF (Video Previous Speed)': history.CFVideoPreviousSpeed,
    'CF (Video Previous Volume)': history.CFVideoPreviousVolume,
    'CF (Video Is Playing)': history.CFVideoIsPlaying,
    'Feedback Text': history.feedbackText,
    'Feedback Type': history.feedbackType,
    'dynamicTagFields': history.dynamicTagFields,
    'recordedServerTime': history.recordedServerTime,
    'Hint Level':history.hintLevel,
  };
  return historyOutput;
}

function getHistoryForMongo(history) {
  if (history.cf_displayed_hint_syllables && history.cf_displayed_hint_syllables != '{}' && history.cf_displayed_hint_syllables.includes('{')
  && history.cf_displayed_hint_syllables.includes('}')){
    history.cf_displayed_hint_syllables = history.cf_displayed_hint_syllables.split('{')[1];
    history.cf_displayed_hint_syllables = history.cf_displayed_hint_syllables.split('}')[0];
    history.cf_displayed_hint_syllables = history.cf_displayed_hint_syllables.split(',');
  }
  else{
    history.cf_displayed_hint_syllables == null;
  }
  return {
    eventId: history.eventid,
    userId: history.userid,
    TDFId: history.tdfid,
    selection: '',
    action: '',
    KCCategoryDefault: '',
    KCCategoryCluster: '',
    CFOverlearning: false,
    CFNote: '',
    dialogueHistory: history.dialoguehistory,
    itemId: history.itemid,
    userIdTDFId: history.useridtdfid,
    KCId: history.kcid,
    responseDuration: history.responseduration,
    probabilityEstimate: parseFloat(history.probabilityestimate) || null,
    typeOfResponse: history.typeofresponse,
    responseValue: history.responsevalue,
    displayedStimulus: JSON.parse(history.displayedstimulus),
    anonStudentId: history.anon_student_id,
    sessionID: history.session_id,
    conditionNameA: history.condition_namea,
    conditionTypeA: history.condition_typea,
    conditionNameB: history.condition_nameb,
    conditionTypeB: history.condition_typeb,
    conditionNameC: history.condition_namec,
    conditionTypeC: history.condition_typec,
    conditionNameD: history.condition_named,
    conditionTypeD: history.condition_typed,
    conditionNameE: history.condition_namee,
    conditionTypeE: history.condition_typee,
    levelUnit: history.level_unit,
    levelUnitName: history.level_unitname,
    levelUnitType: history.level_unittype,
    problemName: JSON.parse(history.problem_name),
    stepName: JSON.parse(history.step_name),
    time: Number(history.time),
    input: history.input,
    outcome: history.outcome,
    studentResponseType: history.student_response_type,
    studentResponseSubtype: history.student_response_subtype,
    tutorResponseType: history.tutor_response_type,
    KCDefault: history.kc_default,
    KCCluster: history.kc_cluster,
    CFAudioInputEnabled: history.cf_audio_input_enabled,
    CFAudioOutputEnabled: history.cf_audio_output_enabled,
    CFDisplayOrder: history.cf_display_order,
    CFStimFileIndex: history.cf_stim_file_index,
    CFSetShuffledIndex: history.cf_set_shuffled_index,
    CFAlternateDisplayIndex: history.cf_alternate_display_index,
    CFStimulusVersion: history.cf_stimulus_version,
    CFCorrectAnswer: history.cf_correct_answer,
    CFCorrectAnswerSyllables: history.cf_correct_answer_syllables.split('{')[1].split('}')[0].split(','),
    CFCorrectAnswerSyllablesCount: history.cf_correct_answer_syllables_count,
    CFDisplaySyllableIndices: history.cf_display_syllable_indices ? history.cf_display_syllable_indices.split('{')[1].split('}')[0].split(',') : null,
    CFDisplayedHintSyllables: history.cf_displayed_hint_syllables,
    CFResponseTime: Number(history.cf_response_time),
    CFStartLatency: Number(history.cf_start_latency),
    CFEndLatency: Number(history.cf_end_latency),
    CFFeedbackLatency: Number(history.cf_feedback_latency),
    CFReviewEntry: history.cf_review_entry,
    CFButtonOrder: history.cf_button_order,
    CFItemRemoved: history.cf_item_removed,
    feedbackText: history.feedback_text,
    feedbackType: history.feedbacktype,
    dynamicTagFields: history.dynamictagfields,
    recordedServerTime: Number(history.recordedservertime),
    hintLevel:history.hintlevel,
    instructionQuestionResult: history.instructionquestionresult,
    entryPoint: history.entry_point
  };
}

function migrateTdf(tdf){
  return {
    TDFId: tdf.tdfid,
    ownerId: tdf.ownerid,
    stimuliSetId: tdf.stimulisetid,
    content: tdf.content,
    visibility: tdf.visibility,
  };
}

function getTdf(tdf) {
  if(tdf.content.tdfs.tutor.setspec.speechAPIKey){
    tdf.content.tdfs.tutor.setspec.speechAPIKey = true;
  }
  if(tdf.content.tdfs.tutor.setspec.textToSpeechAPIKey){
    tdf.content.tdfs.tutor.setspec.textToSpeechAPIKey = true;
  }
  return {
    TDFId: tdf.tdfid,
    ownerId: tdf.ownerid,
    stimuliSetId: tdf.stimulisetid,
    content: tdf.content,
    visibility: tdf.visibility,
  };
}
