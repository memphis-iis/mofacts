const fs = require('fs');
let probFunction = "\r\n          function mul(m1, m2) {\r\n            var result = 0;\r\n            var len = m1.length;\r\n            for (var i = 0; i < len; i++) {\r\n                result += m1[i] * m2[i]\r\n            }\r\n            return result\r\n          }\r\n\r\n          function logitdec(outcomes, decay) {\r\n            if (outcomes) {\r\n                var outcomessuc = JSON.parse(JSON.stringify(outcomes));\r\n                var outcomesfail = outcomes.map(function(value) {\r\n                    return Math.abs(value - 1)\r\n                });\r\n                var w = outcomessuc.unshift(1);\r\n                var v = outcomesfail.unshift(1);\r\n                return Math.log(mul(outcomessuc, [...Array(w).keys()].reverse().map(function(value, index) {\r\n                    return Math.pow(decay, value)\r\n                })) / mul(outcomesfail, [...Array(w).keys()].reverse().map(function(value, index) {\r\n                    return Math.pow(decay, value)\r\n                })))\r\n            }\r\n            return 0\r\n          }\r\n\r\n          function recency(age, d) {\r\n          if (age==0) { return 0;\r\n          } else\r\n            {return Math.pow(1 + age, -d);\r\n            }\r\n          }\r\n\r\n          function quaddiffcor(seq, probs) {\r\n            return mul(seq, probs.map(function(value) {\r\n                return value * value\r\n            }))\r\n          }\r\n\r\n          function quaddiffcor(seq, probs) {\r\n            return mul(seq, probs.map(function(value) {\r\n                return value * value\r\n            }))\r\n          }\r\n\r\n          function quaddiffincor(seq, probs) {\r\n            return mul(Math.abs(seq-1), probs.map(function(value) {\r\n                return value * value\r\n            }))\r\n          }\r\n\r\n          function linediffcor(seq, probs) {\r\n            return mul(seq, probs)\r\n          }\r\n\r\n          function linediffincor(seq, probs) {\r\n            return mul(seq.map(function(value) {\r\n                return Math.abs(value - 1)\r\n            }), probs)\r\n          }\r\n\r\n          p.hintsylls = [];\r\nif((p.stimSuccessCount+p.stimFailureCount)<3 && p.syllables>2) {\r\n            var numHintSylls = getRandomInt(3);\r\n\r\n            for(var index=0;index<numHintSylls;index++){\r\n              p.hintsylls.push(index);\r\n            }\r\n          }\r\n          var intercept;\r\n          function arrSum(arr){return arr.reduce(function(a,b){return a + b}, 0)}\r\n          function errlist(seq) {  return seq.map(function(value) {return Math.abs(value - 1)})}\r\n          if (p.hintsylls.length==0) {intercept=-.563} else if (p.hintsylls.length==1) {intercept=0.261} else {intercept=0.496}\r\n                              p.y = intercept    +\r\n                              .721 * logitdec(\r\n                                  p.overallOutcomeHistory.slice(Math.max(p.overallOutcomeHistory.length-60,1),\r\n                                  p.overallOutcomeHistory.length), .955) +\r\n                              .268 * logitdec(p.responseOutcomeHistory, .794) +\r\n                              10.4 * recency(p.stimSecsSinceLastShown, .519) +\r\n                              .943 *  recency(p.responseSecsSinceLastShown, .049) +\r\n                              1.40  * linediffcor(p.stimOutcomeHistory, p.stimPreviousCalculatedProbabilities) +\r\n                              -1.40 * quaddiffcor(p.stimOutcomeHistory, p.stimPreviousCalculatedProbabilities) +\r\n                              -.178 * arrSum(errlist(p.stimOutcomeHistory)) ;\r\n                              p.probability = 1.0 / (1.0 + Math.exp(-p.y));          \r\n\r\n                  // console.log(p.overallOutcomeHistory+\\\" - \\\"+p.responseOutcomeHistory +\\\" - \\\"+p.stimSecsSinceLastShown+\\\" - \\\"+p.stimOutcomeHistory+\\\" - \\\"+p.stimPreviousCalculatedProbabilities);\r\n                    return p\r\n                      ";
var tdfs = fs.readFileSync('tdfs.json', 'utf-8');
var tdfsJSON = JSON.parse(tdfs);
var tdfStream = fs.createWriteStream("updatedTdfs.json", {flags:'a'});
tdfStream.write('[');
for(let i=0;i<tdfsJSON.length;i++){
    let tdf = tdfsJSON[i];
    if(tdf.fileName.indexOf("FA_2020")!=-1){
        if(tdf.fileName === "Rothschild-Chapter2_mrothschild_2020_09_09T21_22_43_491Z_FA_2020_TDF.xml"){
            continue;
        }
        tdf.fileName = tdf.fileName.replace("FA_2020","SP_2021");
        tdf.tdfs.tutor.unit[0].unitname = ["Instructions"];
        tdf.tdfs.tutor.unit[0].unitinstructions = ["Press continue to start"];
        tdf.tdfs.tutor.setspec[0].textToSpeechAPIKey = Object.assign(tdf.tdfs.tutor.setspec[0].textToSpeechAPIKey,["REDACTED"]);
        tdf.tdfs.tutor.setspec[0].speechAPIKey = ["REDACTED"];
        tdf.tdfs.tutor.setspec[0].stimulusfile = [tdf.tdfs.tutor.setspec[0].stimulusfile[0].replace("FA_2020","SP_2021")];
        tdf.tdfs.tutor.unit[2].learningsession[0].calculateProbability[0] = probFunction;
    }
    tdfStream.write(JSON.stringify(tdf));
    if(i<tdfsJSON.length-1){
        tdfStream.write(',');
    }
}
tdfStream.write(']');
tdfStream.end();

console.log("done with tdfs")

var stim = fs.readFileSync('stimuli.json')
var stimJSON = JSON.parse(stim);
var stimStream = fs.createWriteStream("updatedStimuli.json", {flags:'a'});
stimStream.write('[');
for(let j=0;j<stimJSON.length;j++){
    let stim = stimJSON[j];
    if(stim.fileName.indexOf("FA_2020")!=-1){
        console.log('working',stim.fileName);
        stim.fileName = stim.fileName.replace("FA_2020","SP_2021");
    }
    stimStream.write(JSON.stringify(stim));
    if(j<stimJSON.length-1){
        stimStream.write(',');
    }
};
stimStream.write(']');
stimStream.end();