import {meteorCallAsync} from '../..';
import { ReactiveVar } from 'meteor/reactive-var';
export {doFileUpload};

Template.contentUpload.helpers({
  TdfFiles: function() {
    return Tdfs.find();
  },
  currentUpload() {
    return Template.instance().currentUpload.get();
  },
  assetLink: function() {
    const files = DynamicAssets.find().fetch();
    return files;
  },
});

Template.contentUpload.onRendered(function() {
  this.currentUpload = new ReactiveVar(false);
  Meteor.subscribe('files.assets.all');
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
  },

  // Admin/Teachers - upload a Stimulus file
  'click #doUploadStim': async function(event) {
    $('#stimUploadLoadingSymbol').show()
    event.preventDefault();
    await doFileUpload('#upload-stim', 'stim', 'Stimlus');
  },
  'click #tdf-download-btn': function(event){
    event.preventDefault();
    let selectedTdf = Session.get('allTdfs').find(x => x._id == event.currentTarget.getAttribute('value'));
    console.log('downloading tdf id', event.currentTarget.getAttribute('value'));
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
    Meteor.call('downloadStimFile', stimSetId, function(err, res){
      for(let stim of res){
        let blob = new Blob([JSON.stringify(stim.stimuli,null,2)], { type: 'application/json' });
        let url = window.URL.createObjectURL(blob);
        let downloadFileName = stim.fileName.trim();
        var a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = downloadFileName;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    })
  },

  'click #stim-delete-btn': function(event){
    const stimuliSetId = event.currentTarget.getAttribute('value')
    Meteor.call('deleteStimFile',stimuliSetId);
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

  'change #fileInput'(e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      for(let file of e.currentTarget.files){
        // We upload only one file, in case
        // multiple files were selected
        const foundFile = DynamicAssets.findOne({name: file.name, userId: Meteor.userId()})
        if(foundFile){
          foundFile.remove(function (error){
            if (error) {
              console.log(`File ${file.name} could not be removed`, error)
            }
            else{
              console.log(`File ${file.name} already exists, overwritting.`)
              doPackageUpload(file, template)
            }
          });
        } else {
          doPackageUpload(file, template)
        }
      }
    }

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
      name.indexOf('?') != -1 || name.indexOf('*') != -1) {
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
  // Now we can clear the selected file
  $(fileElementSelector).val('');
  $(fileElementSelector).parent().find('.file-info').html('');

  console.log(fileType, ':', fileDescrip, 'at ele', fileElementSelector, 'scheduled', count, 'uploads');
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
      if(fileObj.ext == "zip"){
        console.log('package detected')
        Meteor.call('processPackageUpload', fileObj.path, Meteor.userId(), function(err,res){
          if(err){
            alert(err);
          } else {
            alert("Package upload succeded.");
          }
        });
      }
    }
    template.currentUpload.set(false);
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