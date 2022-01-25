import {meteorCallAsync} from '../..';
import { resultsToError } from '../../../server/lib/Wikifier';
import { getCurrentClusterAndStimIndices } from '../experiment/card';

const userFiles = new Mongo.Collection(null); // local-only - no database;

async function userFilesRefresh() {
  console.log('userFilesRefresh');
  userFiles.remove({'temp': 1});

  let count = 0;
  const userId = Meteor.userId();
  let allTdfs = await meteorCallAsync('getAllTdfs');
  let allStims = await meteorCallAsync('getAllStims');
  console.log('allTdfs', allTdfs, typeof(allTdfs));
  Session.set('allTdfs', allTdfs);

  for (const tdf of Session.get('allTdfs')) {
    if (userId === tdf.ownerId) {
      try {
        userFiles.insert({
          'temp': 1,
          '_id': '' + count,
          'idx': count,
          'type': 'tdf',
          'fileName': tdf.content.fileName.trim(),
          'tdfID': tdf.TDFId,
        });
        count += 1;
      } catch (err) {
        if (err.name !== 'MinimongoError') {
          throw err;
        }
      }
      let stimFileName = tdf.content.tdfs.tutor.setspec.stimulusfile;
      if (typeof stimFileName == 'object') stimFileName = stimFileName[0];
      if (stimFileName && !userFiles.findOne({'fileName': stimFileName})) {
        try {
          userFiles.insert({
            'temp': 1,
            '_id': '' + count,
            'idx': count,
            'type': 'stim',
            'fileName': stimFileName,
            'stimID': 1,
          });
          count += 1;
        } catch (err) {
          if (err.name !== 'MinimongoError') {
            throw err;
          }
        }
      }
    }
  }
  for(const stim of allStims){
    if (!userFiles.findOne({'fileName': stim.stimulusfilename})){
      try{
        userFiles.insert({
          'temp': 1,
          '_id': '' + count,
          'idx': count,
          'type': 'stim',
          'fileName': stim.stimulusfilename,
          'stimID': 1,
        });
        count += 1;
      } catch (err) {
        if (err.name !== 'MinimongoError') {
          throw err;
        }
      }
    }
  }
}

Template.contentUpload.helpers({
  userFiles: function() {
    return userFiles.find();
  },
});

Template.contentUpload.onRendered(function() {
  userFilesRefresh();
});


// //////////////////////////////////////////////////////////////////////////
// Template events

Template.contentUpload.events({
  // Admin/Teachers - upload a TDF file
  'click #doUploadTDF': async function(event) {
    event.preventDefault();
    await doFileUpload('#upload-tdf', 'tdf', 'TDF');

    const stimDisplayTypeMap = await meteorCallAsync('getStimDisplayTypeMap');
    Session.set('stimDisplayTypeMap', stimDisplayTypeMap);
    userFilesRefresh();
  },

  // Admin/Teachers - upload a Stimulus file
  'click #doUploadStim': async function(event) {
    event.preventDefault();
    await doFileUpload('#upload-stim', 'stim', 'Stimlus');
    userFilesRefresh();
  },
  'click #tdf-download-btn': function(event){
    event.preventDefault();
    let unencodedRawData = Session.get('allTdfs')[$("#tdf-download-btn").val() - 1];
    console.log('downloading tdf id', $("#tdf-download-btn").val() - 1);
    let splitData = JSON.stringify(unencodedRawData.content,null,2).split('\n');
    console.log('splitData',splitData);
    unencodedData = splitData.slice(0,splitData.length - 5).join('\n');
    unencodedData = unencodedData.substr(0, unencodedData.length -1) + "\n}";
    console.log('unencodedData',unencodedData);
    unencodedData = JSON.parse(unencodedData);
    console.log('unencodedData',unencodedData);
    let blob = new Blob([JSON.stringify(unencodedData,null,2)], { type: 'application/json' });
    let url = window.URL.createObjectURL(blob);
    let downloadFileName = unencodedRawData.content.fileName.trim();
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = url;
    a.download = downloadFileName;
    a.click();
    window.URL.revokeObjectURL(url);
    alert('TDF downloaded.');
  },

  'click #stim-download-btn': async function(event){
    event.preventDefault();
    // Set Filename
    const btnTarget = $(event.currentTarget);
    const fileName = _.trim(btnTarget.data('filename'));
    console.log('downloading stim', fileName);
    // Get All Items matching filename
    const allStims = await meteorCallAsync('getItemsByFileName',fileName);
    let curCluster = allStims[0].clusterKC;
    let stims = [];
    let output = "{\n\t\"setspec\": {\n\t\t\"clusters\": [\n\t\t\t{\n\t\t\t\t\"stims\": [\n";
    for(i = 0; i < allStims.length; i++){
      let stim = allStims[i];
      let itemResponseType = "";
      stims[i] = {};
      stims[i].response = {};
      if(stim.correctResponse){stims[i].response.correctResponse = stim.correctResponse;}
      if(stim.incorrectResponses){stims[i].response.incorrectResponses = stim.incorrectResponses.split(",");}
      stims[i].display  = {};
      if(stim.clozeStimulus){stims[i].display.clozeText = stim.clozeStimulus;}
      if(stim.textStimulus){stims[i].display.text = stim.textStimulus;}
      if(stim.audioStimulus){stims[i].display.audioSrc = stim.audioStimulus;}
      if(stim.imageStimulus){stims[i].display.imgSrc = stim.imageStimulus;}
      if(stim.videoStimulus){stims[i].display.videoSrc = stim.videoStimulus;}
      if(stim.tags){stims[i].tags = stim.tags};
      if(stim.alternateDisplays){stims[i].alternateDisplays = stim.alternateDisplays};
      if(stim.params){stims[i].parameter = stim.params};
      stimConverted = JSON.stringify(stims[i],null,2);
      if(stim.clusterKC != curCluster){
        curCluster = stim.clusterKC;
        if(stim.itemResponseType){itemResponse = "\"responseType\": \"" + stim.itemResponseType + "\",\n";}
        output = output + "\n]\n},\n{\n" + itemResponse + "\"stims\": [\n" + stimConverted;
      } else if(i != 0) {
        output = output + ",\n" + stimConverted;
      } else {
        output = output + stimConverted;
      }
    }
    output = output.substring(0,output.length - 2) + "\n}\n]\n}\n]\n}\n}";
    output = JSON.stringify(JSON.parse(output),null,2);
    newJson = output;
    let blob = new Blob([newJson], { type: 'application/json' });
    let url = window.URL.createObjectURL(blob);
    let downloadFileName = _.trim(btnTarget.data('filename'));
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = url;
    a.download = downloadFileName;
    a.click();
    window.URL.revokeObjectURL(url);
    alert('Stim Exported.');
  },

  'change #upload-tdf': function(event) {
    const curFiles = Array.from($('#upload-tdf').prop('files'));
    let outputLabel = curFiles[0].name;
    if (curFiles.length > 1) {
      outputLabel += ' + ' + (curFiles.length-1) + ' more...';
    }
    $('#tdf-file-info').html(outputLabel);
  },

  'change #upload-stim': function(event) {
    const curFiles = Array.from($('#upload-stim').prop('files'));
    let outputLabel = curFiles[0].name;
    if (curFiles.length > 1) {
      outputLabel += ' + ' + (curFiles.length-1) + ' more...';
    }
    $('#stim-file-info').html(outputLabel);
  },
});


// //////////////////////////////////////////////////////////////////////////
// Our main logic for uploading files

async function doFileUpload(fileElementSelector, fileType, fileDescrip) {
  let count = 0;
  const files = $(fileElementSelector).prop('files');
  console.log('files:', files);
  const errorStack = [];

  for (const file of files) {
    count += 1;

    const name = file.name;
    if (name.indexOf('<') != -1 || name.indexOf('>') != -1 || name.indexOf(':') != -1 ||
      name.indexOf('"') != -1 || name.indexOf('/') != -1 || name.indexOf('|') != -1 ||
      name.indexOf('?') != -1 || name.indexOf('*') != -1){
      alert('Please remove the following characters from your filename: < > : " / | ? *');
    } else {
      const fileData = await readFileAsDataURL(file);
      console.log('Upload attempted for', name);

      try {
        const result = await meteorCallAsync('saveContentFile', fileType, name, fileData);
        if (!result.result) {
          console.log(fileDescrip + ' save failed', result);
          errorStack.push('The ' + fileDescrip + ' file was not saved: ' + result.errmsg);
        } else {
          console.log(fileDescrip + ' Saved:', result);
          if(result.errmsg){
            errorStack.push('The ' + fileDescrip + ' file was saved with warnings:' + result.errmsg);
          }
        }
      } catch (error) {
        console.log('Critical failure saving ' + fileDescrip, error);
        errorStack.push('There was a critical failure saving your ' + fileDescrip + ' file:' + error);
      }
    }
  }
  if (errorStack.length == 0) {
    alert(count.toString() + ' files saved successfully');
  } else {
    alert('There were ' + errorStack.length + ' errors uploading files: ' + errorStack.join('\n'));
  }
  // Now we can clear the selected file
  $(fileElementSelector).val('');
  $(fileElementSelector).parent().find('.file-info').html('');

  console.log(fileType, ':', fileDescrip, 'at ele', fileElementSelector, 'scheduled', count, 'uploads');
}

async function readFileAsDataURL(file) {
  const result = await new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.readAsBinaryString(file);
  });

  return result;
}
