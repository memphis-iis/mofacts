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
  currentUpload() {
    return Template.instance().currentUpload.get();
  },
  assets: function() {
    userId = Meteor.userId();
    const files = DynamicAssets.find({userId: userId}).fetch();
    sortedFiles = [];
    //get all tdfs
    allTDfs = Tdfs.find({ownerId: Meteor.userId()}).fetch();
    console.log('allTdfs:', allTDfs);
    //iterate through allTdfs and get all stimuli
    tdfSummaries = [];    for (const tdf of allTDfs) {
      thisTdf = {};
      thisTdf.lessonName = tdf.content.tdfs.tutor.setspec.lessonname;
      thisTdf.stimuliCount = tdf.stimuli.length;
      thisTdf.accessors = tdf.accessors || [];
      thisTdf.accessorsCount = thisTdf.accessors.length;
      thisTdf.assets = [];
      thisTdf._id = tdf._id;
      thisTdf.errors = [];
      thisTdf.stimFileInfo = [];
      thisTdf.stimFilesCount = 0;
      thisTdf.fileName = tdf.content.fileName;
      checkIfConditional = allTDfs.some(function(tdf){
        conditions = tdf.content.tdfs.tutor.setspec.condition;
        //check if condition contains the TDF filename
        if(conditions && conditions.includes(thisTdf.fileName)){
          return true;
        }
      });
      if(tdf.content.tdfs.tutor.setspec.condition){
        thisTdf.conditions = [];
        for(let i=0; i<tdf.content.tdfs.tutor.setspec.condition.length; i++){
          if(tdf.conditionCounts == undefined){
            tdf.conditionCounts = [];
            //add an error to thisTdf.errors
            thisTdf.errors.push('Condition counts not found. Condition count reset needed. Please click the refresh icon for this lesson.');
          }
          thisTdf.conditions.push({condition: tdf.content.tdfs.tutor.setspec.condition[i], count: tdf.conditionCounts[i]});
        }
      }
      //if thisTdf is conditional, skip it
      if(checkIfConditional){
        continue;
      }
      //get the original package filename by looking up the assetId in the tdf
      tdf.packageFileName ? thisTdf.packageAssetId = tdf.packageFileName.split('.')[0] : thisTdf.packageAssetId = false;
      if(!thisTdf.packageAssetId){
        thisTdf.errors.push('Package ID not found. This package was uploaded before the new upload system was implemented. Please delete this package and re-upload it.');
        thisTdf.packageFileLink = null;
      } else {
        thisTdf.packageFileLink = DynamicAssets.findOne({_id: thisTdf.packageAssetId}).link() || false;
      }
      //iterate through tdf.stimuli and get all stimuli
      for (const stim of tdf.stimuli) {
        //check if thisTdf.stimFileInfo already contains a file with this stim.stimuliSetId
        //if not, add it to thisTdf.stimFileInfo
        if(!thisTdf.stimFileInfo.some(function(stimFileInfo){
            return stimFileInfo.stimuliSetId === stim.stimuliSetId;
        })){
          thisTdf.stimFilesCount++;
          thisTdf.stimFileInfo.push( {stimuliSetId: stim.stimuliSetId, fileName: stim.stimulusFileName} );
        }
        thisAsset = {};
        thisAsset.filename = stim.imageStimulus || stim.audioStimulus || stim.videoStimulus;
        thisAsset.fileType = stim.imageStimulus ? 'image' : stim.audioStimulus ? 'audio' : stim.videoStimulus ? 'video' : "unknown"
        thisAsset.filename ? fileObj = DynamicAssets.findOne({name: thisAsset.filename}) : fileObj = false;
        //if fileObj exists, get the file link
        if (thisAsset.filename && fileObj) {
          thisAsset.link = fileObj.meta.link || fileObj.link();
        } else {
          if(typeof thisAsset.filename !== 'undefined'){
            thisTdf.errors.push(thisAsset.filename + ' not found. This will cause errors in the lesson.<br>');
          }
        }
        //check if thisTdf.assets already contains a file with thisAsset.filename
        //if not, add it to thisTdf.assets
        if(!thisTdf.assets.some(function(asset){
            return asset.filename === thisAsset.filename;
        })){
          //check that thisAsset.filename is not false
          if (thisAsset.filename){
            thisTdf.assets.push(thisAsset);
          }
        }
      }
      tdfSummaries.push(thisTdf);
    }
  console.log('tdfSummaries:', tdfSummaries);
  return tdfSummaries;
  },
  'packagesUploaded': function() {
    packages = DynamicAssets.find({userId: Meteor.userId()}).fetch();
    //get a link for each package
    packages.forEach(function(thispackage){
      thispackage.link = DynamicAssets.link(thispackage);
    });
    console.log('packages:', packages);
    return packages;
  }
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
      doPackageUpload(file, Template.instance());
    }
    //update reactive var with new array
    console.log('files:', files);
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
  'click #show_stimuli': function(event){
    event.preventDefault();
    //get data-file field
    const tdf = event.currentTarget.getAttribute('data-file');
    console.log('tdf:', tdf);
    //toggle the attribute hidden of assets-tdfid
    if($('#stimuli-'+tdf).attr('hidden')){
      $('#stimuli-'+tdf).removeAttr('hidden');
    } else {
      $('#stimuli-'+tdf).attr('hidden', true);
    }
  },
  'click #doUpload': async function(event) {
    //get files array from reactive var
    const files = Template.instance().curFilesToUpload.get();
    //call doFileUpload function for each file
    for (const file of files) {
      await doPackageUpload(file, Template.instance());
    }
  },
    'click #tdf-download-btn': function(event){
      event.preventDefault();
      window.open(event.currentTarget.getAttribute('value'));
    },
  'click #tdf-delete-btn': function(event){
    const tdfId = event.currentTarget.getAttribute('value')
    Meteor.call('deleteTDFFile',tdfId);
  },
  'click #reset-conditions-btn': function(event){
    const tdfId = event.currentTarget.getAttribute('value')
    Meteor.call('resetTdfConditionCounts',tdfId);
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
    Meteor.call('deleteAllFiles',
      function(error, result) {
        if (error) {
          console.log('error:', error);
        } else {
          console.log('result: deleted ', results, ' files');
        }
      }
    );
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
          const result = await meteorCallAsync('saveContentFile', fileType, name, fileData, Meteor.userId());
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
    if(confirm(`Uploading this file will overwrite existing data. Continue?`)){
      console.log(`File ${file.name} already exists, overwritting.`)
      existingFile.remove();
    } else {
      return;
    }
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
        // check if emailInsteadOfAlert is checked
        const emailToggle = $('#emailInsteadOfAlert').is(':checked') ? true : false;
        Meteor.call('processPackageUpload', fileObj, Meteor.userId(), link, emailToggle, function(err,result){
            if(err){
            alert(err);
          } 
          for(res of result.results){
            if (res.data && res.data.res == 'awaitClientTDF') {
              let reason = []
              if(res.data.reason.includes('prevTDFExists'))
                reason.push(`Previous ${res.data.TDF.content.fileName} already exists, continuing the upload will overwrite the old file. Continue?`)
              if(res.data.reason.includes(`prevStimExists`))
                reason.push(`Previous ${res.data.TDF.content.tdfs.tutor.setspec.stimulusfile} already exists, continuing the upload will overwrite the old file. Continue?`)
              if(res.data.reason.includes('shuffleclusterMissmatch'))
                reason.push(`The uploaded package contains a TDF file that could break the experiment. Do you want to continue?\nFile Name: ${res.data.TDF.content.fileName}`)
              console.log('Client TDF could break experiment, asking for confirmation');
              if(confirm(reason.join('\n'))){
                Meteor.call('tdfUpdateConfirmed', res.data.TDF, res.data.reason.includes('shuffleclusterMissmatch'), function(err,res){
                  if(err){
                    alert(err);
                  }
                });
              }
            }
            else if(!res.result) {
              alert("Package upload failed: " + res.errmsg);
              return
            }
          }
        //if email toggle, then we don't wait for the server to process the package
        if(!emailToggle){
          alert("Package upload succeded.");
        } else {
          alert("Package is being processed. You will be notified when it is complete or if there are any errors.");}
        });  
      }
    }
  });
  upload.start();
  //return the filename
  res = {fileName: file.name};
  return res;
}

async function readFileAsDataURL(file) {
  const result = await new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.readAsText(file, 'UTF-8');
  });

  return result;
}