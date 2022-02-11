export {getItem, getComponentState, getCourse, getHistory, getTdf};

function getItem(stim) {
  return {
    itemId: stim.itemid,
    stimuliSetId: stim.stimulisetid,
    stimulusFilename: stim.stimulusfilename,
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
    priorStudy: componentState.priorstudy,
    totalPracticeDuration: componentState.totalpracticeduration,
    outcomeStack: componentState.outcomestack.split(',').filter((x) => x!=='').map((x) => parseInt(x)),
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
    'Selection': '',
    'Action': '',
    'KC Category(Default)': '',
    'KC Category(Cluster)': '',
    'CF (Overlearning)': false,
    'CF (Note)': '',
    'dialoguehistory': history.dialoguehistory,
    'itemid': history.itemid,
    'useridtdfid': history.useridtdfid,
    'kcid': history.kcid,
    'responseduration': history.responseduration,
    'probabilityestimate': history.probabilityestimate,
    'typeofresponse': history.typeofresponse,
    'responsevalue': history.responsevalue,
    'displayedstimulus': history.displayedstimulus,
    'Anon Student Id': history.anon_student_id,
    'Session ID': history.session_id,
    'Condition Namea': history.condition_namea,
    'Condition Typea': history.condition_typea,
    'Condition Nameb': history.condition_nameb,
    'Condition Typeb': history.condition_typeb,
    'Condition Namec': history.condition_namec,
    'Condition Typec': history.condition_typec,
    'Condition Named': history.condition_named,
    'Condition Typed': history.condition_typed,
    'Condition Namee': history.condition_namee,
    'Condition Typee': history.condition_typee,
    'Level (Unit)': history.level_unit,
    'Level (Unitname)': history.level_unitname,
    'Problem Name': history.problem_name,
    'Step Name': history.step_name,
    'Time': history.time,
    'Input': history.input,
    'Outcome': history.outcome,
    'Student Response Type': history.student_response_type,
    'Student Response Subtype': history.student_response_subtype,
    'Tutor Response Type': history.tutor_response_type,
    'Tutor Response Subtype': history.kc_default,
    'KC (Cluster)': history.kc_cluster,
    'CF (Audio Input Enabled)': history.cf_audio_input_enabled,
    'CF (Audio Output Enabled)': history.cf_audio_output_enabled,
    'CF (Display Order)': history.cf_display_order,
    'CF (Stim File Index)': history.cf_stim_file_index,
    'CF (Set Shuffled Index)': history.cf_set_shuffled_index,
    'CF (Alternate Display Index)': history.cf_alternate_display_index,
    'CF (Stimulus Version)': history.cf_stimulus_version,
    'CF (Correct Answer)': history.cf_correct_answer,
    'CF (Correct Answer Syllables)': history.cf_correct_answer_syllables,
    'CF (Correct Answer Syllables Count)': history.cf_correct_answer_syllables_count,
    'CF (Display Syllable Indices)': history.cf_display_syllable_indices,
    'CF (Response Time)': history.cf_response_time,
    'CF (Start Latency)': history.cf_start_latency,
    'CF (End Latency)': history.cf_end_latency,
    'CF (Feedback Latency)': history.cf_feedback_latency,
    'CF (Review Latency)': history.cf_review_latency,
    'CF (Review Entry)': history.cf_review_entry,
    'CF (Button Order)': history.cf_button_order,
    'Feedback Text': history.feedback_text,
    'feedbackType': history.feedbackType,
    'dynamicTagFields': history.dynamictagfields,
    'recordedServerTime': history.recordedServerTime,
    'hintLevel':history.hintlevel,
    'Entry_Point': history.entry_point
  };
  return historyOutput;
}

function getTdf(tdf) {
  return {
    TDFId: tdf.tdfid,
    ownerId: tdf.ownerid,
    stimuliSetId: tdf.stimulisetid,
    content: tdf.content,
    visibility: tdf.visibility,
  };
}
