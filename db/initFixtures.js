const pgp = require('pg-promise')();
const connectionString = "postgres://mofacts:test101@localhost:5432";
const db = pgp(connectionString);

function insertHandler(insertString,isGood,error){
    isGood ? console.log("it worked!",insertString) : console.log("error:",error,insertString);
}

function doInsert(insertString,valueArray,cb){
    db.none(insertString,valueArray).then(() => { insertHandler(insertString,true); if(cb) cb();}).catch(error => insertHandler(insertString,false,error));
}

var tdfJson = {"_id":"2xceL5aZzsu6cgZvY","fileName":"testTdf_FA_2020.xml","tdfs":{"tutor":{"setspec":[{"name":["InternalTesting"],"lessonname":["TestingTdf"],"userselect":["true"],"experimentTarget":["test"],"stimulusfile":["testStim.json"],"isModeled":["false"],"lfparameter":[".85"],"simTimeout":["3500"],"simCorrectProb":["0.85"],"speechAPIKey":["***REMOVED***"],"textToSpeechAPIKey":["***REMOVED***"],"audioInputEnabled":["true"],"audioInputSensitivity":["15"],"speechIgnoreOutOfGrammarResponses":["false"],"speechOutOfGrammarFeedback":["Pleasetryagain"],"enableAudioPromptAndFeedback":["true"],"audioPromptSpeakingRate":["1"],"prestimulusDisplay":["PrestimulusDisplayText"]}],"unit":[{"unitinstructions":["Herecomesthetestassessmentsession"],"unitname":["ScheduleUnit"],"buttontrial":["true"],"deliveryparams":[{"practiceseconds":["1000000"],"drill":["5000"],"skipstudy":["false"],"purestudy":["5000"],"reviewstudy":["5000"],"correctprompt":["500"],"fontsize":["2"],"correctscore":["0"],"incorrectscore":["0"],"numButtonListImageColumns":["3"]}],"assessmentsession":[{"conditiontemplatesbygroup":[{"groupnames":["A"],"clustersrepeated":["1"],"templatesrepeated":["1"],"group":["0,t,t,0"]}],"initialpositions":["A_1"],"randomizegroups":["false"],"clusterlist":["2-2"],"assignrandomclusters":["false"]}]},{"unitinstructions":["Herecomesthetestinglearningsession."],"unitname":["ModelUnit"],"learningsession":[{"clusterlist":["1-1"],"calculateProbability":["\nfunctionmul(m1,m2){\nvarresult=0;\nvarlen=m1.length;\nfor(vari=0;i<len;i++){\nresult+=m1[i]*m2[i]\n}\nreturnresult\n}\nfunctionlogitdec(outcomes,decay){\nif(outcomes){\nvaroutcomessuc=JSON.parse(JSON.stringify(outcomes));\nvaroutcomesfail=outcomes.map(function(value){\nreturnMath.abs(value-1)\n});\nvarw=outcomessuc.unshift(1);\nvarv=outcomesfail.unshift(1);\nreturnMath.log(mul(outcomessuc,[...Array(w).keys()].reverse().map(function(value,index){\nreturnMath.pow(decay,value)\n}))/mul(outcomesfail,[...Array(w).keys()].reverse().map(function(value,index){\nreturnMath.pow(decay,value)\n})))\n}\nreturn0\n}\nfunctionrecency(age,d){\nif(age==0){return0;\n}else\n{returnMath.pow(1+age,-d);\n}\n}\nfunctionquaddiffcor(seq,probs){\nreturnmul(seq,probs.map(function(value){\nreturnvalue*value\n}))\n}\nfunctionlinediffcor(seq,probs){\nreturnmul(seq,probs)\n}\nfunctionlinediffincor(seq,probs){\nreturnmul(seq.map(function(value){\nreturnMath.abs(value-1)\n}),probs)\n}\nvarnumTotalSyllables=p.syllables;\np.hintsylls=[];\nvarnumHiddenSyllables=p.stimIndex%2==0?1:2;\nif(numHiddenSyllables>numTotalSyllables){\nnumHiddenSyllables=numTotalSyllables;\n}\nfor(vari=0;i<numTotalSyllables-numHiddenSyllables;i++){\np.hintsylls.push(i);\n}\n\np.y=-0.72159+\n.58150*logitdec(\np.overallOutcomeHistory.slice(p.overallOutcomeHistory.length-60,\np.overallOutcomeHistory.length),.97)+\n.54467*logitdec(p.responseOutcomeHistory,.79)+\n9.67995*recency(p.stimSecsSinceLastShown,.35)+\n1.85143*linediffcor(p.stimOutcomeHistory,p.stimPreviousCalculatedProbabilities)+\n-1.96012*quaddiffcor(p.stimOutcomeHistory,p.stimPreviousCalculatedProbabilities)+\n-0.27823*linediffincor(p.stimOutcomeHistory,p.stimPreviousCalculatedProbabilities);\np.probability=1.0/(1.0+Math.exp(-p.y));\n//console.log(p.overallOutcomeHistory+\"-\"+p.responseOutcomeHistory+\"-\"+p.stimSecsSinceLastShown+\"-\"+p.stimOutcomeHistory+\"-\"+p.stimPreviousCalculatedProbabilities);\nreturnp\n"]}],"buttontrial":["false"],"buttonorder":["random"],"deliveryparams":[{"feedbackType":["dialogue"],"forceCorrection":["false"],"practiceseconds":["1000000"],"drill":["20000"],"purestudy":["20000"],"skipstudy":["false"],"reviewstudy":["5000"],"correctprompt":["500"],"fontsize":["2"],"correctscore":["1"],"incorrectscore":["0"],"falseAnswerLimit":["3"],"timeuntilaudio":["500"],"timeuntilaudiofeedback":["500"],"autostopTranscriptionAttemptLimit":["4"],"prestimulusdisplaytime":["500"]}]},{"unitname":["last"],"unitinstructions":["Youarealldone."]}]}},"owner":"6czoKhCiGADi2bngR","source":"repo"}

var mytdf = ['id_teach',1,tdfJson,'enabled'];
doInsert('INSERT INTO tdf(ownerId, stimuliSetId, content, visibility) VALUES($1, $2, $3, $4)', mytdf,() =>{
    var mycourse = ['Test Course','id_teach','FA_2020','2020-08-20','2020-12-04'];
    doInsert('INSERT INTO course(courseName, teacherUserId, semester, beginDate, endDate) VALUES($1, $2, $3, $4, $5)',mycourse,() => {
        var mysection = [1,'sec1'];
        doInsert('INSERT INTO section(courseId, sectionName) VALUES($1, $2)',mysection,() => {
            var mysection_user_map = [1,'id_student1'];
            doInsert('INSERT INTO section_user_map(sectionId, userId) VALUES($1, $2)',mysection_user_map);
            var mysection_user_map2 = [1,'id_student2'];
            doInsert('INSERT INTO section_user_map(sectionId, userId) VALUES($1, $2)',mysection_user_map2);
        });

        var mysection2 = [1,'sec2'];
        doInsert('INSERT INTO section(courseId, sectionName) VALUES($1, $2)',mysection2,() => {
            var mysection2_user_map = [2,'id_student3'];
            doInsert('INSERT INTO section_user_map(sectionId, userId) VALUES($1, $2)',mysection2_user_map);
            var mysection2_user_map2 = [2,'id_student4'];
            doInsert('INSERT INTO section_user_map(sectionId, userId) VALUES($1, $2)',mysection2_user_map2);
        });
    });
    var myassignment = [1,1];
    doInsert('INSERT INTO assignment(courseId, TDFId) VALUES($1, $2)',myassignment);

    var myitem = [1, 1, 1, 1, "-0.479299999999998", 0.91, 'correct', 'incorrect1,incorrect2', "The _____ brown fox jumped over..."];
    doInsert('INSERT INTO item(stimuliSetId, stimulusKC, clusterKC, responseKC, params, optimalProb, correctResponse, incorrectResponses, clozeStimulus) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',myitem);
    var myitem = [1, 2, 1, 1, "-0.479299999999998", 0.91, 'correct', 'incorrect1,incorrect2', "sounds/music2/1.mp3"];
    doInsert('INSERT INTO item(stimuliSetId, stimulusKC, clusterKC, responseKC, params, optimalProb, correctResponse, incorrectResponses, audioStimulus) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',myitem);
    var myitem = [1, 3, 1, 1, "-0.479299999999998", 0.91, 'correct', 'incorrect1,incorrect2', "images/TNplants/6151_IMG00293.JPG"];
    doInsert('INSERT INTO item(stimuliSetId, stimulusKC, clusterKC, responseKC, params, optimalProb, correctResponse, incorrectResponses, imageStimulus) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',myitem);
});



//INSERT INTO item(stimuliSetId, stimulusKC, clusterKC, responseKC, params, optimalProb, correctResponse, incorrectResponses, clozeStimulus) VALUES(1, 1, 1, 1, '-0.479299999999998', 0.91, 'correct', 'incorrect1,incorrect2', 'The _____ brown fox jumped over...');



var myitem = [1, 1, 2, 3, "-0.479299999999998", 0.91, 'correct', 'incorrect1,incorrect2', "How do you say correct?"];
doInsert('INSERT INTO item(stimuliSetId, stimulusKC, clusterKC, responseKC, params, optimalProb, correctResponse, incorrectResponses, textStimulus) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',myitem);


//UserTimesLog
//select by _id (student id), select all, update _id

//UserMetrics
//select by _id

//Stimuli
//select by fileName, insert, select all, update _id


//Tdfs
//insert, update _id, select all, select one fileName/experimentTarget,

//select TDFId, stimuliSetId from tdf where content @> '{"_id":"2xceL5aZzsu6cgZvY"}'::jsonb;

//select TDFId, stimuliSetId from tdf where ownerid='id_a';

//convert fileName lookups to ids?
//select TDFId, stimuliSetId from tdf where content @> '{"fileName":"testTdf_FA_2020.xml"}'::jsonb;


//select TDFId, stimuliSetId from tdf where content @> '{"tdfs":{"tutor":{"setspec":[{"experimentTarget":["test"]}]}}}'::jsonb;


// CREATE TYPE outcomeType AS ENUM ('correct','incorrect');
// CREATE TYPE responseType AS ENUM ('image','text');

// CREATE TABLE history (
//     eventId SERIAL PRIMARY KEY,
//     itemId INTEGER REFERENCES item (itemId),
//     eventStartTime BIGINT NOT NULL,
//     feedbackDuration INTEGER NOT NULL,
//     stimulusDuration INTEGER NOT NULL,
//     responseDuration INTEGER NOT NULL,
//     outcome outcomeType NOT NULL,
//     probabilityEstimate NUMERIC(4,3) NOT NULL,
//     typeOfResponse responseType NOT NULL,
//     responseValue VARCHAR(255) NOT NULL,
//     displayedStimulus VARCHAR(255) NOT NULL
// );

// CREATE TYPE componentStateType AS ENUM ('stimulus','cluster','response');

// CREATE TABLE componentState (
//     componentStateId SERIAL PRIMARY KEY,
//     userId CHAR(17) NOT NULL,
//     TDFId INTEGER REFERENCES tdf (TDFId),
//     KCId INTEGER NOT NULL,
//     componentType componentStateType NOT NULL,
//     firstSeen BIGINT NOT NULL,
//     lastSeen BIGINT NOT NULL,
//     priorCorrect INTEGER NOT NULL,
//     priorIncorrect INTEGER NOT NULL,
//     priorStudy INTEGER NOT NULL,
//     totalPromptDuration INTEGER NOT NULL,
//     totalStudyDuration INTEGER NOT NULL,
//     totalInterference INTEGER NOT NULL,
//     currentUnit INTEGER NOT NULL,
//     outcomeStack VARCHAR(255)
// );

// UPDATE table SET columnName = 'value' WHERE otherColumnName = 'otherValue';

// db.any('SELECT * FROM users WHERE active = $1', [true])
// .then(function(data) {
//     // success;
//     //data[rowNum][columnName]
// })
// .catch(function(error) {
//     // error;
// });