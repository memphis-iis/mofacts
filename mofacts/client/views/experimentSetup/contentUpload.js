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
    sortedFiles = [];
    //get all tdfs
    allTDfs = Tdfs.find({ownerId: Meteor.userId()}).fetch();
    console.log('allTdfs:', allTDfs);
    //iterate through allTdfs and get all stimuli
    tdfSummaries = [];
    for (const tdf of allTDfs) {
      thisTdf = {};
      thisTdf.lessonName = tdf.content.tdfs.tutor.setspec.lessonname;
      thisTdf.stimuliCount = tdf.stimuli.length;
      thisTdf.accessors = tdf.accessors || [];
      thisTdf.accessorsCount = thisTdf.accessors.length;
      thisTdf.assets = [];
      thisTdf._id = tdf._id;
      //iterart through tdf.stimuli and get all stimuli
      for (const stim of tdf.stimuli) {
        thisAsset = {};
        thisAsset.filename = stim.imageStimulus || stim.audioStimulus || stim.videoStimulus;
        thisAsset.fileType = stim.imageStimulus ? 'image' : stim.audioStimulus ? 'audio' : stim.videoStimulus ? 'video' : 'unknown';
        thisAsset.link = DynamicAssets.findOne({name: thisAsset.filename}).link();
        //check if thisTdf.assets already contains a file with thisAsset.filename
        //if not, add it to thisTdf.assets
        if(!thisTdf.assets.some(function(asset){
            return asset.filename === thisAsset.filename;
        })){
          thisTdf.assets.push(thisAsset);
        }
      }
      tdfSummaries.push(thisTdf);
    }
  console.log('tdfSummaries:', tdfSummaries);
  return tdfSummaries;
  },
});

Template.contentUpload.onCreated(function() {
  this.currentUpload = new ReactiveVar(false);
  this.curFilesToUpload = new ReactiveVar([]);
});

Template.contentUpload.rendered = function() {
  Meteor.subscribe('allUsers', function() {
    Session.set('allUsers', Meteor.users.find({}, {fields: {username: 1}, sort: [['username', 'asc']]}).fetch());
  });
};


// //////////////////////////////////////////////////////////////////////////
// Template events

Template.contentUpload.events({
  // Admin/Teachers - upload a TDF file
  'change #upload-file': function(event) {
    //get files array from reactive var
    const files = Template.instance().curFilesToUpload.get();
    //add new files to array, appending the current file type from the dropdown
    for (const file of Array.from($('#upload-file').prop('files'))) {
      //if the file has extension .json, read and parse it, if it is a TDF file it will have "tutor" field, if it is a stimuli file it will have "setspec" field
      if (file.name.endsWith('.json')) {
        console.log('JSON file:', file);
        const reader = new FileReader();
        reader.onload = function(e) {
          const fileContent = JSON.parse(e.target.result);
          //print file contents to console
          console.log('fileContent:', fileContent);
          if (fileContent.tutor) {
            file.fileType = 'tdf';
            file.fileDescrip = 'TDF'
          } else if (fileContent.setspec) {
            file.fileType = 'stim';
            file.fileDescrip = 'Stimuli'
          } else {
            file.fileType = 'unknown';
            file.fileDescrip = 'Unknown'      
          }
        };
        reader.readAsText(file);
      } else {
        file.fileType = 'package';
      }
      files.push(file);
    }
    //update reactive var with new array
    console.log('files:', files);
    Template.instance().curFilesToUpload.set(files);
    //clear file input
    $('#upload-file').val('');
  },
  'click #show_assets': function(event){
    event.preventDefault();
    //get data-file field
    const tdfId = event.currentTarget.getAttribute('data-file');
    console.log('tdfId:', tdfId);
    //toggle the attribute hidden of assets-tdfid
    if($('#assets-'+tdfId).attr('hidden')){
      $('#assets-'+tdfId).removeAttr('hidden');
    } else {
      $('#assets-'+tdfId).attr('hidden', true);
    }
  },
  'click #doUpload': async function(event) {
    //get files array from reactive var
    const files = Template.instance().curFilesToUpload.get();
    $('#stimUploadLoadingSymbol').show()
    doFileUpload(files);
    //reset reactive var
    Template.instance().curFilesToUpload.set([]);
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
    $('#deleteAllAssetsConfirm').removeAttr('hidden');

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
  },
  'click #add-access-btn': function(event){
    //call assignAccessors meteor method with args tdfId and [accessors] and [revokedAccessors]
    const tdfId = event.currentTarget.getAttribute('value');
    console.log('tdfId:', tdfId);
    //get current accessors
    const curAccessors = Tdfs.findOne({_id: tdfId}).accessors;
    const accessors = ($('#add-access-'+tdfId).val()).split(',');  //iterate through accessors to get _id for each by email
    var newAccessors = [];
    for(let i=0; i<accessors.length; i++){
      const accessor = Session.get('allUsers').filter(user => user.username == accessors[i]);
      if(accessor.length > 0){
        newAccessors.push({userId: accessor[0]._id, username: accessor[0].username});
      } else {
        console.log('accessor not found:', accessors[i]);
        alert('User does not exist.' + accessors[i]);
        return;
      }
    }
    console.log('accessors:', newAccessors);
    const revokedAccessors = [];
    Meteor.call('assignAccessors', tdfId, newAccessors, revokedAccessors, function(error, result){
      if(error){
        console.log('error:', error);
      } else {
        console.log('result:', result);
      }
    });
  },
  'click #remove-access-btn': function(event){
    //call assignAccessors meteor method with args tdfId and [accessors] and [revokedAccessors]
    const tdfId = event.currentTarget.getAttribute('value');
    console.log('tdfId:', tdfId, 'user:', event.currentTarget.getAttribute('data-user'));
    //get current accessors
    var curAccessors = Tdfs.findOne({_id: tdfId}).accessors;
    //remove the accessor from the array
    curAccessors = curAccessors.filter(accessor => accessor.userId != event.currentTarget.getAttribute('data-user'));
    //get accessors to revoke
    const revokedAccessorId = event.currentTarget.getAttribute('data-user');
    //get the revoked accessors _id
    const revokedAccessors = [revokedAccessorId];
    Meteor.call('assignAccessors', tdfId, curAccessors, revokedAccessors, function(error, result){
      if(error){
        console.log('error:', error);
      } else {
        console.log('result:', result);
      }
    });
  },
  'click #transfer-btn': function(event){
    const tdfId = event.currentTarget.getAttribute('value');
    const newOwnerUsername = $('#transfer-' + tdfId).val();
    const newOwner = Session.get('allUsers').filter(user => user.username == newOwnerUsername)[0];
    Meteor.call('transferDataOwnership', tdfId, newOwner, function(error, result){
      if(error){
        console.log('error:', error);
      } else {
        console.log('result:', result);
      }
    });
  },
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
      alert("Files saved successfully. It may take a few minutes for the changes to take effect.");
    } else {
      alert('There were ' + errorStack.length + ' errors uploading files: ' + errorStack.join('\n'));
    }

    //update the stimDisplayTypeMap
    const stimDisplayTypeMap = await meteorCallAsync('getStimDisplayTypeMap');
    Session.set('stimDisplayTypeMap', stimDisplayTypeMap);

    //clear the file upload fields
    $('#upload-file').val('');

     // Now we can clear the selected file
    $('#upload-file').val('');
    $('#upload-file').parent().find('.file-info').html('');

    console.log(fileType, ':', fileDescrip, 'at ele', fileElementSelector, 'scheduled', count, 'uploads');
    //alert('Upload complete');
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