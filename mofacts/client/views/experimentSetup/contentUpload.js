import {meteorCallAsync} from '../..';
import { ReactiveVar } from 'meteor/reactive-var';
export {doFileUpload};

Template.contentUpload.helpers({
  TdfFiles: function() {
    return Tdfs.find();
  },
  StimFiles: function() {
    return Stims.find();
  },
  curFilesToUpload() {
    return Template.instance().curFilesToUpload.get();
  },
  currentUpload() {
    return Template.instance().currentUpload.get();
  },
  assets: function() {
    const files = DynamicAssets.find().fetch();
    files.forEach((file) => {
      file.link = DynamicAssets.link(file)
    });
    return files;
  },
});

Template.contentUpload.onCreated(function() {
  this.currentUpload = new ReactiveVar(false);
  this.curFilesToUpload = new ReactiveVar([]);
});


// //////////////////////////////////////////////////////////////////////////
// Template events

Template.contentUpload.events({
  // Admin/Teachers - upload a TDF file
  'change #upload-file': function(event) {
    //get files array from reactive var
    const files = Template.instance().curFilesToUpload.get();
    //add new files to array, appending the current file type from the dropdown
    for (const file of Array.from($('#upload-file').prop('files'))) {
      file.fileType = $('#file-type').val();
      files.push(file);
      //if file is a TDF, add a description field
      if (file.fileType == 'tdf') {
        file.fileDescrip = 'TDF'
      } else if (file.fileType == 'stim') {
        file.fileDescrip = 'Stimuli'
      } else {
        file.fileDescrip = 'Package'
      }
    }
    //update reactive var with new array
    console.log('files:', files);
    Template.instance().curFilesToUpload.set(files);
    //clear file input
    $('#upload-file').val('');
  },
  'click #doUpload': async function(event) {
    //get files array from reactive var
    const files = Template.instance().curFilesToUpload.get();
    $('#stimUploadLoadingSymbol').show()
    doFileUpload(files);
  },
    'click #tdf-download-btn': function(event){
      event.preventDefault();
      const TDFId = event.currentTarget.getAttribute('value')
      let selectedTdf = Tdfs.findOne({_id: TDFId});
      console.log('downloading tdf id', TDFId);
      let blob = new Blob([JSON.stringify(selectedTdf.content.tdfs,null,2)], { type: 'application/json' });
      let url = window.URL.createObjectURL(blob);
      let downloadFileName = selectedTdf.content.fileName.trim();
      var a = document.createElement("a");
      document.body.appendChild(a);
      a.style = "display: none";
      a.href = url;
      a.download = downloadFileName;
      a.click();
      window.URL.revokeObjectURL(url);
    },
  'click #tdf-delete-btn': function(event){
    const tdfId = event.currentTarget.getAttribute('value')
    Meteor.call('deleteTDFFile',tdfId);
  },

  'click #assetDeleteButton': function(event){
    const assetId = event.currentTarget.getAttribute('value')
    Meteor.call('removeAssetById', assetId);
  },

  'click #stim-download-btn': async function(event){
    event.preventDefault();
    const stimSetId = parseInt(event.currentTarget.getAttribute('value'));
    const stimFile = Stims.findOne({'stimuliSetId': stimSetId})
    let blob = new Blob([JSON.stringify(stimFile.stimuli,null,2)], { type: 'application/json' });
    let url = window.URL.createObjectURL(blob);
    let downloadFileName = stimFile.fileName.trim();
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = url;
    a.download = downloadFileName;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  'click #stim-delete-btn': function(event){
    const stimuliSetId = event.currentTarget.getAttribute('value')
    Meteor.call('deleteStimFile',stimuliSetId);
  },
  'click #deleteAllAssetsPrompt'(e, template) {
    e.preventDefault();
    console.log('deleteAllAssetsPrompt clicked');
    $('#deleteAllAssetsPrompt').css('display', 'none');
    $('#deleteAllAssetsConfirm').css('display', 'block');
  },
  'click #deleteAllAssetsConfirm': async function(e, template) {
    fileCount = await meteorCallAsync('deleteAllFiles');
    if(fileCount == 0){
      alert(`All files deleted.`);
    } else {
      alert("Error: Files not deleted.");
    }
    $('#deleteAllAssetsPrompt').css('display', 'block');
    $('#deleteAllAssetsConfirm').css('display', 'none');
  },
  'click .imageLink'(e) {
    const url = $(e.currentTarget).data('link');
    const img = '<img src="'+url+'">';
    const popup = window.open();
    popup.document.write(img);                        
    popup.print();
  }
});


// //////////////////////////////////////////////////////////////////////////
// Our main logic for uploading files

async function doFileUpload(fileArray) {
  //reorder fileArray so that packages are uploaded first, then stimuli, then tdfs
  fileArray.sort((a, b) => {
    if (a.fileType == 'package') {
      return -1;
    } else if (b.fileType == 'package') {
      return 1;
    } else if (a.fileType == 'stim') {
      return -1;
    } else if (b.fileType == 'stim') {
      return 1;
    } else {
      return 0;
    }
  });
  let count = 0;
  const files = fileArray;
  console.log('files:', files);
  const errorStack = [];

  for (const file of files) {
    //check if file type is package
    if (file.fileType == 'package') {
      //check if package exists in dynamicAssets
      const existingFile = DynamicAssets.findOne({fileName: file.name});
      if (existingFile) {
        //atempts to delete existing file
        try {
          existingFile.remove();
        } catch (e) {
          console.log('error deleting existing file', e);
          alert('Error deleting existing file. Please try again. If this error persists, please file a bug report.');
        }
      } else {
        doPackageUpload(file, Template.instance());
      }
    } else {
      count += 1;
      const name = file.name;
      const fileType = file.fileType;
      const fileDescrip = file.fileDescrip;
      if (name.indexOf('<') != -1 || name.indexOf('>') != -1 || name.indexOf(':') != -1 ||
        name.indexOf('"') != -1 || name.indexOf('/') != -1 || name.indexOf('|') != -1 ||
        name.indexOf('?') != -1 || name.indexOf('*') != -1) {
        alert('Please remove the following characters from your filename: < > : " / | ? *');
      } else {
        const fileData = await readFileAsDataURL(file);
        console.log('Upload attempted for', name);

        try {
          const result = await meteorCallAsync('saveContentFile', fileType, name, fileData);
          if (!result.result) {
            if(result.data && result.data.res == 'awaitClientTDF'){
              console.log('Client TDF could break experiment, asking for confirmation');
              if(confirm(`The uploaded package contains a TDF file that could break the experiment. Do you want to continue?\nFile Name: ${result.data.TDF.content.fileName}`)){
                Meteor.call('tdfUpdateConfirmed', result.data.TDF, function(err,res){
                  if(err){
                    alert(err);
                  }
                });
              }
            } else {
              console.log(fileDescrip + ' save failed', result);
              errorStack.push('The ' + fileDescrip + ' file was not saved: ' + result.errmsg);
            }
          } else {
            console.log(fileDescrip + ' Saved:', result);
          }
        } catch (error) {
          console.log('Critical failure saving ' + fileDescrip, error);
          errorStack.push('There was a critical failure saving your ' + fileDescrip + ' file:' + error);
        }
      }
    }

    $('#stimUploadLoadingSymbol').hide()
    
    if (errorStack.length == 0) {
      alert(count.toString() + ' files saved successfully');
    } else {
      alert('There were ' + errorStack.length + ' errors uploading files: ' + errorStack.join('\n'));
    }

    //update the stimDisplayTypeMap
    const stimDisplayTypeMap = await meteorCallAsync('getStimDisplayTypeMap');
    Session.set('stimDisplayTypeMap', stimDisplayTypeMap);

    //clear the file upload fields
    $('#upload-file').val('');

    //clear the reactive variables
    Template.instance().currentUpload.set(false);
    Template.instance().curFilesToUpload.set([]);

    // Now we can clear the selected file
    $('#upload-file').val('');
    $('#upload-file').parent().find('.file-info').html('');

    console.log(fileType, ':', fileDescrip, 'at ele', fileElementSelector, 'scheduled', count, 'uploads');
    }
  }



async function doPackageUpload(file, template){
  const existingFile = await DynamicAssets.findOne({ name: file.name, userId: Meteor.userId() });
  if (existingFile) {
    console.log(`File ${file.name} already exists, overwritting.`)
    existingFile.remove();
  }
  const upload = DynamicAssets.insert({
    file: file,
    chunkSize: 'dynamic'
  }, false);

  upload.on('start', function () {
    template.currentUpload.set(this);
  });

  upload.on('end', function (error, fileObj) {
    if (error) {
      alert(`Error during upload: ${error}`);
    } else {
      const link = DynamicAssets.link(fileObj);
      if(fileObj.ext == "zip"){
        console.log('package detected')
        Meteor.call('processPackageUpload', fileObj, Meteor.userId(), link, function(err,result){
          if(err){
            alert(err);
          } 
          for(res of result.results){
            if (res.data && res.data.res == 'awaitClientTDF') {
              console.log('Client TDF could break experiment, asking for confirmation');
              if(confirm(`The uploaded package contains a TDF file that could break the experiment. Do you want to continue?\nFile Name: ${res.data.TDF.content.fileName}`)){
                Meteor.call('tdfUpdateConfirmed', res.data.TDF, function(err,res){
                  if(err){
                    alert(err);
                  }
                });
              }
            }
          }
          alert("Package upload succeded.");
          if(res.stimSetId)
            Meteor.call('updateStimSyllables', res.stimSetId);
        });
      }
    }
  });
  upload.start();
}

async function readFileAsDataURL(file) {
  const result = await new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.readAsText(file, 'UTF-8');
  });

  return result;
}