CREATE TYPE tdfVisibility AS ENUM ('enabled','disabled','profileOnly','profileSouthwestOnly');

CREATE TABLE tdf (
    TDFId SERIAL PRIMARY KEY,
    ownerId CHAR(17) NOT NULL,
    stimuliSetId INTEGER,
    content JSONB  NOT NULL,
    visibility tdfVisibility DEFAULT 'profileOnly'
);

CREATE INDEX idx_tdf_owner on tdf USING gin((content -> '_id'));
CREATE INDEX idx_tdf_json_filename ON tdf USING gin((content -> 'fileName'));
CREATE INDEX idx_tdf_json_exptarget ON tdf USING gin((content ->'tdfs'->'tutor'->'setspec'->'experimentTarget'));

CREATE TABLE course (
    courseId SERIAL PRIMARY KEY,
    courseName TEXT NOT NULL,
    teacherUserId CHAR(17),
    semester VARCHAR(20) NOT NULL,
    beginDate DATE,
    endDate DATE
);

CREATE INDEX idx_course_teacheruserid on course USING hash (teacherUserId);
CREATE INDEX idx_course_semester on course USING hash (semester);

CREATE TABLE assignment (
    assignmentId SERIAL PRIMARY KEY,
    courseId INTEGER REFERENCES course (courseId),
    TDFId INTEGER REFERENCES tdf (TDFId)
);

CREATE INDEX idx_assignment_courseid on assignment USING hash (courseId);

CREATE TABLE section (
    sectionId SERIAL PRIMARY KEY,
    courseId INTEGER REFERENCES course (courseId),
    sectionName TEXT NOT NULL
);

CREATE INDEX idx_section_courseid on section USING hash (courseId);
CREATE INDEX idx_section_sectionid on section USING hash (sectionId);

CREATE TABLE section_user_map (
    sectionId INTEGER REFERENCES section (sectionId),
    userId CHAR(17) NOT NULL 
);

CREATE INDEX idx_section_user_map_sectionid on section_user_map USING hash (sectionId);
CREATE INDEX idx_section_user_map_userid on section_user_map USING hash (userId);

CREATE TYPE responseType AS ENUM ('image','text');

CREATE TABLE item (
    itemId SERIAL PRIMARY KEY,
    stimuliSetId INTEGER,
    stimulusFilename VARCHAR(1024),
    parentStimulusFileName VARCHAR(1024),
    stimulusKC INTEGER,
    clusterKC INTEGER NOT NULL,
    responseKC INTEGER,
    params VARCHAR(1024) NOT NULL,
    optimalProb NUMERIC(4,3),
    correctResponse TEXT NOT NULL,
    incorrectResponses VARCHAR(2048),
    itemResponseType responseType DEFAULT 'text',
    speechHintExclusionList VARCHAR(2048),
    clozeStimulus VARCHAR(1024),
    textStimulus VARCHAR(1024),
    audioStimulus VARCHAR(1024),
    imageStimulus VARCHAR(1024),
    videoStimulus VARCHAR(1024),
    alternateDisplays JSONB,
    tags JSONB
);

CREATE TYPE outcomeType AS ENUM ('correct','incorrect');
CREATE TYPE feedbackTypeOptions AS ENUM ('simple','refutational','dialogue');

CREATE TABLE history ( 
    eventId SERIAL PRIMARY KEY,
    itemId INTEGER REFERENCES item (itemId),
    userId CHAR(17) NOT NULL,
    TDFId INTEGER REFERENCES tdf (TDFId),
    KCId INTEGER NOT NULL,
    eventStartTime BIGINT NOT NULL,
    feedbackDuration INTEGER NOT NULL,
    stimulusDuration INTEGER NOT NULL,
    responseDuration INTEGER NOT NULL,
    outcome outcomeType NOT NULL,
    probabilityEstimate NUMERIC(4,3),
    typeOfResponse responseType NOT NULL,
    responseValue TEXT NOT NULL,
    displayedStimulus TEXT NOT NULL,
    dynamicTagFields TEXT[],
    Anon_Student_Id VARCHAR(255) NOT NULL,
    Session_Id TEXT NOT NULL,
    Condition_Namea VARCHAR(1024),
    Condition_Typea VARCHAR(1024),
    Condition_Nameb VARCHAR(1024),
    Condition_Typeb INTEGER,
    Condition_Namec VARCHAR(1024),
    Condition_Typec VARCHAR(1024),
    Condition_Named VARCHAR(1024),
    Condition_Typed VARCHAR(1024),
    Condition_Namee VARCHAR(1024),
    Condition_Typee BOOLEAN,
    Level_Unit INTEGER NOT NULL,
    Level_Unitname TEXT NOT NULL,
    Problem_Name TEXT NOT NULL,
    Step_Name TEXT NOT NULL,
    Time BIGINT NOT NULL,
    Input VARCHAR(1024) NOT NULL,
    Student_Response_Type VARCHAR(1024) NOT NULL,
    Student_Response_Subtype VARCHAR(1024) NOT NULL,
    Tutor_Response_Type  VARCHAR(1024) NOT NULL,
    KC_Default INTEGER,
    KC_Cluster INTEGER,
    CF_GUI_Source VARCHAR(1024) NOT NULL,
    CF_Audio_Input_Enabled BOOLEAN NOT NULL,
    CF_Audio_Output_Enabled BOOLEAN NOT NULL,
    CF_Display_Order INTEGER NOT NULL,
    CF_Stim_File_Index INTEGER NOT NULL,
    CF_Set_Shuffled_Index INTEGER NOT NULL,
    CF_Alternate_Display_Index INTEGER,
    CF_Stimulus_Version INTEGER,
    CF_Correct_Answer TEXT NOT NULL,
    CF_Correct_Answer_Syllables TEXT,
    CF_Correct_Answer_Syllables_Count INTEGER,
    CF_Display_Syllable_Indices TEXT,
    CF_Response_Time BIGINT,
    CF_Start_Latency BIGINT,
    CF_End_Latency BIGINT,
    CF_Review_Latency BIGINT,
    CF_Review_Entry TEXT,
    CF_Button_Order TEXT,
    Feedback_Text TEXT,
    feedbackType feedbackTypeOptions,
    dialogueHistory JSONB,
    recordedServerTime BIGINT NOT NULL
);

CREATE INDEX idx_history_userId_TDFId on history (userId,TDFId);

CREATE TYPE componentStateType AS ENUM ('stimulus','cluster','response');
CREATE TYPE unitType AS ENUM ('learningsession','assessmentsession');

CREATE TABLE componentState (
    componentStateId SERIAL PRIMARY KEY,
    userId CHAR(17) NOT NULL,
    TDFId INTEGER REFERENCES tdf (TDFId),
    KCId INTEGER NOT NULL,
    componentType componentStateType NOT NULL,
    probabilityEstimate NUMERIC(4,3),
    firstSeen BIGINT NOT NULL,
    lastSeen BIGINT NOT NULL,
    trialsSinceLastSeen INTEGER,
    priorCorrect INTEGER NOT NULL,
    priorIncorrect INTEGER NOT NULL,
    priorStudy INTEGER NOT NULL,
    totalPracticeDuration INTEGER NOT NULL,
    outcomeStack TEXT
);

CREATE TABLE globalExperimentState (
    experimentStateId SERIAL PRIMARY KEY,
    userId CHAR(17) NOT NULL,
    TDFId INTEGER REFERENCES tdf (TDFId),
    experimentState JSONB
);

CREATE INDEX idx_globalExperimentState_userId on globalExperimentState USING hash (userId);
CREATE INDEX idx_globalExperimentState_TDFId on globalExperimentState USING hash (TDFId);

CREATE TABLE itemSourceSentences (
    stimuliSetId INTEGER,
    sourceSentences JSONB
);

CREATE INDEX idx_itemSourceSentences_stimuliSetId on itemSourceSentences USING hash (stimuliSetId);