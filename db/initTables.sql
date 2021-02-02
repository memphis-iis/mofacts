CREATE TYPE tdfVisibility AS ENUM ('enabled','disabled','profileOnly','profileSouthwestOnly');

CREATE TABLE tdf (
    TDFId SERIAL PRIMARY KEY,
    ownerId CHAR(17) NOT NULL,
    stimuliSetId INTEGER NOT NULL,
    content JSONB  NOT NULL,
    visibility tdfVisibility DEFAULT 'profileSouthwestOnly'
);

CREATE INDEX idx_tdf_owner on tdf USING gin((content -> '_id'));
CREATE INDEX idx_tdf_json_filename ON tdf USING gin((content -> 'fileName'));
CREATE INDEX idx_tdf_json_exptarget ON tdf USING gin((content ->'tdfs'->'tutor'->'setspec'->'experimentTarget'));

CREATE TABLE course (
    courseId SERIAL PRIMARY KEY,
    courseName VARCHAR(255) NOT NULL,
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
    sectionName VARCHAR(255) NOT NULL
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
    stimulusKC INTEGER UNIQUE NOT NULL,
    clusterKC INTEGER NOT NULL,
    responseKC INTEGER NOT NULL,
    params VARCHAR(255) NOT NULL,
    optimalProb NUMERIC(4,3),
    correctResponse VARCHAR(255) NOT NULL,
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

CREATE TABLE history (
    eventId SERIAL PRIMARY KEY,
    itemId INTEGER REFERENCES item (itemId),
    eventStartTime BIGINT NOT NULL,
    feedbackDuration INTEGER NOT NULL,
    stimulusDuration INTEGER NOT NULL,
    responseDuration INTEGER NOT NULL,
    outcome outcomeType NOT NULL,
    probabilityEstimate NUMERIC(4,3) NOT NULL,
    typeOfResponse responseType NOT NULL,
    responseValue VARCHAR(255) NOT NULL,
    displayedStimulus VARCHAR(255) NOT NULL
);

CREATE TYPE componentStateType AS ENUM ('stimulus','cluster','response');
CREATE TYPE unitType AS ENUM ('learningsession','assessmentsession');

CREATE TABLE componentState (
    componentStateId SERIAL PRIMARY KEY,
    userId CHAR(17) NOT NULL,
    TDFId INTEGER REFERENCES tdf (TDFId),
    KCId INTEGER NOT NULL,
    componentType componentStateType NOT NULL,
    firstSeen BIGINT NOT NULL,
    lastSeen BIGINT NOT NULL,
    priorCorrect INTEGER NOT NULL,
    priorIncorrect INTEGER NOT NULL,
    priorStudy INTEGER NOT NULL,
    totalPromptDuration INTEGER NOT NULL,
    totalStudyDuration INTEGER NOT NULL,
    totalInterference INTEGER NOT NULL,
    currentUnit INTEGER NOT NULL,
    currentUnitType unitType NOT NULL,
    outcomeStack VARCHAR(255)
);

CREATE TABLE globalExperimentState (
    experimentStateId SERIAL PRIMARY KEY,
    userId CHAR(17) NOT NULL,
    TDFId INTEGER REFERENCES tdf (TDFId),
    experimentState JSONB
);

CREATE INDEX idx_globalExperimentState_userId on globalExperimentState USING hash (userId);
CREATE INDEX idx_globalExperimentState_TDFId on globalExperimentState USING hash (TDFId);