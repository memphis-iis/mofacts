import {Roles} from 'meteor/alanning:roles';
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
  assets: function() {
    try {
      console.log('[ASSETS] Starting assets helper');
      userId = Meteor.userId();
      console.log('[ASSETS] userId:', userId);
      const files = DynamicAssets.find({userId: userId}).fetch();
      console.log('[ASSETS] files:', files.length);
      sortedFiles = [];
      //get all tdfs
      toggleOnlyOwnedTDFs = Template.instance().toggleOnlyOwnedTDFs.get();
      console.log('[ASSETS] toggleOnlyOwnedTDFs:', toggleOnlyOwnedTDFs);
      if(toggleOnlyOwnedTDFs){
        allTDfs = Tdfs.find({ownerId: Meteor.userId()}).fetch();
      } else {
        allTDfs = Tdfs.find().fetch();
      }
      console.log('[ASSETS] allTdfs:', allTDfs);
      //iterate through allTdfs and get all stimuli
      tdfSummaries = [];
      for (const tdf of allTDfs) {
        try {
          // Check if TDF has required structure
          if (!tdf || !tdf.content || !tdf.content.tdfs || !tdf.content.tdfs.tutor ||
              !tdf.content.tdfs.tutor.setspec || !tdf.stimuli) {
            console.error('TDF missing required structure:', tdf._id);
            continue;
          }

          var thisTdf = {};
          thisTdf.lessonName = tdf.content.tdfs.tutor.setspec.lessonname || 'Unknown Lesson';
          thisTdf.stimuliCount = tdf.stimuli.length;
          thisTdf.accessors = tdf.accessors || [];
          thisTdf.accessorsCount = thisTdf.accessors.length;
          thisTdf.packageFile = tdf.packageFile;
          thisTdf.assets = [];
          thisTdf._id = tdf._id;
          thisTdf.errors = [];
          thisTdf.stimFileInfo = [];
          thisTdf.stimFilesCount = 0;
          thisTdf.fileName = tdf.content.fileName || 'unknown.xml';
          const ownerUser = Meteor.users.findOne({_id: tdf.ownerId});
          thisTdf.owner = ownerUser ? ownerUser.username : 'Unknown';
          //get all tdfs with the same packgeFile
          var sisterTdfs = allTDfs.filter(function(tdf){
            return tdf.packageFile == thisTdf.packageFile;
          });
          console.log('sisterTdfs:', sisterTdfs);
          thisTdf.hasAPIKeys = false;
          //check if any syter tdf has API keys at
          //check if thisTdf has API keys at tdf.content.tdfs.tutor.setspec.textToSpeechAPIKey or  tdf.content.tdfs.tutor.setspec.speechAPIKey
          var checkIfAPI = sisterTdfs.some(function(tdf){
            return tdf.content?.tdfs?.tutor?.setspec?.textToSpeechAPIKey || tdf.content?.tdfs?.tutor?.setspec?.speechAPIKey;
          });
          if(checkIfAPI){
            thisTdf.hasAPIKeys = true;
          }
          var checkIfConditional = allTDfs.some(function(tdf){
            var conditions = tdf.content?.tdfs?.tutor?.setspec?.condition;
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
          tdf.packageFile ? thisTdf.packageAssetId = tdf.packageFile.split('/').pop().split('.').shift() : thisTdf.packageAssetId = false;
          if(!thisTdf.packageAssetId){
            thisTdf.errors.push('Package ID not found. This package was uploaded before the new upload system was implemented. Please delete this package and re-upload it.');
            thisTdf.packageFileLink = null;
          } else {
            const packageAsset = DynamicAssets.findOne({_id: thisTdf.packageAssetId});
            thisTdf.packageFileLink = packageAsset ? (packageAsset.link() || false) : false;
            if (!packageAsset) {
              thisTdf.errors.push('Package file not found in assets. The original zip file may have been deleted.');
            }
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
          console.log('[ASSETS] Successfully processed TDF:', tdf._id);
          tdfSummaries.push(thisTdf);
        } catch (tdfError) {
          console.error('[ASSETS] Error processing TDF:', tdf?._id, tdfError);
          console.error('[ASSETS] Error stack:', tdfError.stack);
          // Continue processing other TDFs even if one fails
        }
      }
      console.log('[ASSETS] Finished processing, tdfSummaries:', tdfSummaries.length, 'items');
      return tdfSummaries;
    } catch (error) {
      console.error('[ASSETS] FATAL Error in assets helper:', error);
      console.error('[ASSETS] Error stack:', error.stack);
      return [];
    }
  },
  'packagesUploaded': function() {
    packages = DynamicAssets.find({userId: Meteor.userId()}).fetch();
    //get a link for each package
    packages.forEach(function(thispackage){
      thispackage.link = DynamicAssets.link(thispackage);
    });
    console.log('packages:', packages);
    return packages;
  },
  'displayUnownedTDFs': function(){
    return !Template.instance().toggleOnlyOwnedTDFs.get();
  },
  'showDeleteAllButton': function(){
    // Only show delete all button if user is admin AND setting is enabled
    const isAdmin = Roles.userIsInRoleAsync(Meteor.userId(), 'admin');
    const settingEnabled = Meteor.settings.public.enableDeleteAllButton || false;
    return isAdmin && settingEnabled;
  }
});

Template.contentUpload.onCreated(function() {
  this.currentUpload = new ReactiveVar(false);
  this.curFilesToUpload = new ReactiveVar([]);
  this.toggleOnlyOwnedTDFs = new ReactiveVar(true);
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
  // Admin/Teachers - upload and convert .apkg file
  'change #upload-apkg': async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('[APKG] Starting conversion:', file.name);
    $('#apkg-status').show();

    try {
      // Import JSZip and sql.js dynamically
      const JSZip = (await import('jszip')).default;
      const initSqlJs = (await import('sql.js')).default;

      // Read .apkg file
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      console.log('[APKG] Loaded zip, extracting database');

      // Get SQLite database
      let sqliteBytes;
      const c21 = zip.file('collection.anki21');
      const c2 = zip.file('collection.anki2');

      if (c21) {
        sqliteBytes = await c21.async('uint8array');
      } else if (c2) {
        sqliteBytes = await c2.async('uint8array');
      } else {
        throw new Error('No collection database found in .apkg file');
      }

      // Load media index
      let mediaIndex = {};
      const mediaJson = zip.file('media');
      if (mediaJson) {
        const txt = await mediaJson.async('string');
        mediaIndex = JSON.parse(txt || '{}');
      }

      console.log('[APKG] Found', Object.keys(mediaIndex).length, 'media files');

      // Open SQLite database
      const SQL = await initSqlJs();
      const db = new SQL.Database(new Uint8Array(sqliteBytes));

      // Extract data (using simplified version of our converter)
      const result = await convertApkgData(db, mediaIndex, zip);

      console.log('[APKG] Converted', result.cards.length, 'cards');

      // Build TDF and stims
      const deckName = result.deckName || 'Imported_Deck';
      const stimFilename = `${deckName}_stims.json`;

      // Build stims
      const clusters = result.cards.map(card => ({
        stims: [{
          response: { correctResponse: card.answer },
          display: {
            ...(card.hasImage && card.media.length > 0 ? { imgSrc: card.media[0] } : {}),
            ...(card.prompt ? { text: card.prompt } : {})
          }
        }]
      }));

      const stims = { setspec: { clusters } };

      // Standard adaptive learning model
      const calculateProbability = 'p.y = -3 + .508* pFunc.logitdec( p.overallOutcomeHistory.slice( Math.max(p.overallOutcomeHistory.length-60,  0),   p.overallOutcomeHistory.length),  .974)+ 1.4 * Math.log(1+p.stimSuccessCount) + 7.98 * pFunc.recency(p.stimSecsSinceLastShown,  .115) ;  var lastElements = p.overallOutcomeHistory.slice(Math.max(p.overallOutcomeHistory.length - 60,  0),  p.overallOutcomeHistory.length); var sum = lastElements.reduce((accumulator,  currentValue) => accumulator + currentValue,  0); var average = sum / (lastElements.length); p.probability = 1.0 / (1.0 + Math.exp(-p.y));  if ( p.overallStudyHistory && p.overallStudyHistory.length % 4 !== 0 && average > p.stimParameters[1] && p.probability > p.stimParameters[1]) {p.probability = 1 / (1 + Math.exp(-(Math.log(p.probability / (1 - p.probability)) + 6)));}  return p\\n';

      // Build TDF
      const tdf = {
        tutor: {
          setspec: {
            lessonname: `${deckName} (imported from Anki)`,
            stimulusfile: stimFilename,
            shuffleclusters: `0-${result.cards.length - 1}`,
            userselect: 'true',
            lfparameter: '0.85'
          },
          unit: [
            {
              unitname: 'Instructions',
              unitinstructions: '<p>This lesson was imported from an Anki deck.</p><p>Study each card and type your answer when prompted.</p>'
            },
            {
              unitname: 'Practice',
              learningsession: {
                clusterlist: `0-${result.cards.length - 1}`,
                unitMode: 'distance',
                calculateProbability: calculateProbability
              },
              deliveryparams: {
                purestudy: '10000',
                drill: '10000',
                skipstudy: 'false',
                reviewstudy: '5000',
                correctprompt: '500',
                fontsize: '3',
                correctscore: '1',
                incorrectscore: '0',
                optimalThreshold: '.8',
                practiceseconds: '1000000'
              }
            }
          ]
        }
      };

      // Create ZIP file
      const outputZip = new JSZip();
      outputZip.file(`${deckName}_TDF.json`, JSON.stringify(tdf, null, 2));
      outputZip.file(stimFilename, JSON.stringify(stims, null, 2));

      // Add media files
      for (const [numStr, filename] of Object.entries(mediaIndex)) {
        const entry = zip.file(numStr);
        if (entry) {
          const data = await entry.async('uint8array');
          outputZip.file(filename, data);
        }
      }

      // Generate ZIP blob
      const zipBlob = await outputZip.generateAsync({ type: 'blob' });
      const zipFile = new File([zipBlob], `${deckName}.zip`, { type: 'application/zip' });

      console.log('[APKG] Created ZIP file:', zipFile.name);

      // Upload through normal ZIP process
      $('#apkg-status').hide();
      await doPackageUpload(zipFile, Template.instance());

    } catch (error) {
      console.error('[APKG] Conversion error:', error);
      $('#apkg-status').hide();
      alert('Failed to convert .apkg file: ' + error.message);
    } finally {
      // Clear file input
      $('#upload-apkg').val('');
    }
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
  'click #package-delete-btn': function(event){
    const packageId = event.currentTarget.getAttribute('value');
    const fileName = event.currentTarget.getAttribute('data-filename');
    console.log('Delete button clicked - packageId:', packageId, 'fileName:', fileName);
    (async () => {
      try {
        const result = await Meteor.callAsync('deletePackageFile', packageId);
        console.log('Delete result:', result);
        alert('Package deleted: ' + result);
      } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting package: ' + error.message);
      }
    })();
  },
  'click #reset-conditions-btn': function(event){
    const tdfId = event.currentTarget.getAttribute('value')
    Meteor.callAsync('resetTdfConditionCounts',tdfId);
  },

  'click #assetDeleteButton': function(event){
    const assetId = event.currentTarget.getAttribute('value')
    Meteor.callAsync('removeAssetById', assetId);
  },

  'click #stim-download-btn': async function(event){
    event.preventDefault();
    const stimSetId = parseInt(event.currentTarget.getAttribute('value'));
    const tdf = Tdfs.findOne({'stimuliSetId': stimSetId})
    const stimFile = tdf.rawStimuliFile;
    let blob = new Blob([JSON.stringify(stimFile,null,2)], { type: 'application/json' });
    let url = window.URL.createObjectURL(blob);
    let downloadFileName = tdf.stimuli[0].stimulusFileName.trim();
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
    Meteor.callAsync('deleteStimFile',stimuliSetId);
  },
  'click #deleteAllAssetsConfirm': async function(e, template) {
    e.preventDefault();
    if (!confirm('This will delete all files, remove all lessons, and remove all stimuli. This is not recoverable. Are you sure?')) {
      return;
    }
    console.log('deleteAllAssetsConfirm clicked');
    Meteor.callAsync('deleteAllFiles',
      function(error, result) {
        if (error) {
          console.log('error:', error);
          alert('Error deleting files: ' + error);
        } else {
          console.log('result: deleted ', result, ' files');
          alert('Successfully deleted ' + result + ' files');
        }
      }
    );
  },
  'click .imageLink'(e) {
    const url = $(e.currentTarget).data('link');

    // MO8: Use DOM createElement for security and proper image optimization
    // SECURITY: Prevents XSS via proper DOM API instead of HTML string concatenation
    const popup = window.open();

    // Create proper HTML structure with image attributes
    const img = popup.document.createElement('img');
    img.src = url; // Safe - no string concatenation
    img.alt = 'Uploaded content preview'; // Accessibility
    img.loading = 'eager'; // Intentional preview, load immediately
    img.decoding = 'async'; // Non-blocking decode
    img.style.maxWidth = '100%'; // Ensure image fits in popup
    img.style.height = 'auto'; // Maintain aspect ratio

    popup.document.body.appendChild(img);
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
    (async () => {
      try {
        const result = await Meteor.callAsync('assignAccessors', tdfId, newAccessors, revokedAccessors);
        console.log('result:', result);
      } catch (error) {
        console.log('error:', error);
      }
    })();
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
    (async () => {
      try {
        const result = await Meteor.callAsync('assignAccessors', tdfId, curAccessors, revokedAccessors);
        console.log('result:', result);
      } catch (error) {
        console.log('error:', error);
      }
    })();
  },
  'click #transfer-btn': function(event){
    const tdfId = event.currentTarget.getAttribute('value');
    const newOwnerUsername = $('#transfer-' + tdfId).val();
    const newOwner = Session.get('allUsers').filter(user => user.username == newOwnerUsername)[0];
    (async () => {
      try {
        const result = await Meteor.callAsync('transferDataOwnership', tdfId, newOwner);
        console.log('result:', result);
      } catch (error) {
        console.log('error:', error);
      }
    })();
  },
  'click #showAllAssets': function(event){
    showAllAssets = Template.instance().toggleOnlyOwnedTDFs.get();
    Template.instance().toggleOnlyOwnedTDFs.set(!showAllAssets);
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
        // Security: Use server method instead of direct client remove
        Meteor.callAsync('removeAssetById', existingFile._id);
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
                try {
                  await Meteor.callAsync('tdfUpdateConfirmed', result.data.TDF);
                } catch (err) {
                  alert(err);
                }
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

    //force the stimDisplayTypeMap to refresh on next card load
    Session.set('stimDisplayTypeMap', undefined);

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
      // Security: Use server method instead of direct client remove
      Meteor.callAsync('removeAssetById', existingFile._id);
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
        (async () => {
          try {
            const result = await Meteor.callAsync('processPackageUpload', fileObj, Meteor.userId(), link, emailToggle);
            console.log('result:', result);
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
                  try {
                    await Meteor.callAsync('tdfUpdateConfirmed', res.data.TDF, res.data.reason.includes('shuffleclusterMissmatch'));
                  } catch (err) {
                    alert(err);
                  }
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
              alert("Package is being processed. You will be notified when it is complete or if there are any errors.");
            }
          } catch (err) {
            alert(err);
          }
        })();  
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

// //////////////////////////////////////////////////////////////////////////
// Anki .apkg conversion helper functions

const US = '\x1f'; // Anki field separator

function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, '').trim();
}

function splitFields(fldsRaw) {
  return (fldsRaw || '').split(US);
}

function extractMediaRefs(fields) {
  const refs = new Set();
  for (const f of fields) {
    if (!f) continue;
    const regex = /<img[^>]+src=['"]([^'"]+)['"]|(?:\[sound:([^\]]+)\])/g;
    for (const m of f.matchAll(regex)) {
      const candidate = m[1] || m[2];
      if (candidate) refs.add(candidate);
    }
  }
  return [...refs];
}

function queryAll(db, sql) {
  const stmt = db.prepare(sql);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

async function convertApkgData(db, mediaIndex, zip) {
  // Get models and decks
  const colRows = queryAll(db, 'SELECT models, decks FROM col');
  const models = colRows.length > 0 ? JSON.parse(colRows[0].models || '{}') : {};
  const decks = colRows.length > 0 ? JSON.parse(colRows[0].decks || '{}') : {};

  // Build model index
  const modelIndex = new Map();
  for (const [id, m] of Object.entries(models)) {
    modelIndex.set(parseInt(id, 10), {
      name: m.name || `Model_${id}`,
      isCloze: (m.name || '').toLowerCase().includes('cloze')
    });
  }

  // Build deck index
  const deckIndex = new Map();
  for (const [id, d] of Object.entries(decks)) {
    deckIndex.set(parseInt(id, 10), d.name || `Deck_${id}`);
  }

  // Load notes
  const notes = new Map();
  for (const row of queryAll(db, 'SELECT id, guid, mid, flds, tags FROM notes')) {
    notes.set(row.id, {
      id: row.id,
      guid: row.guid,
      mid: row.mid,
      fields: splitFields(row.flds),
      tags: row.tags || ''
    });
  }

  // Process cards
  const cards = [];
  let primaryDeckName = null;

  for (const row of queryAll(db, 'SELECT id, nid, did, ord FROM cards')) {
    const { id: cid, nid, did, ord } = row;
    const note = notes.get(nid);
    if (!note) continue;

    const model = modelIndex.get(note.mid);
    const deckName = deckIndex.get(did) || `Deck_${did}`;
    if (!primaryDeckName) primaryDeckName = deckName;

    const isCloze = model ? model.isCloze : false;

    // Extract prompt and answer
    let prompt, answer;
    if (isCloze) {
      // Simplified cloze handling
      const text = note.fields[0] || '';
      prompt = stripHtml(text);
      answer = stripHtml(text);
    } else {
      // Basic card: field 0 = front, field 1 = back
      prompt = stripHtml(note.fields[0] || '');
      answer = stripHtml(note.fields[1] || '');
    }

    // Extract media
    const mediaRefs = extractMediaRefs(note.fields);
    const mediaNames = mediaRefs.map(r => {
      const n = Number(r);
      if (Number.isFinite(n) && String(n) === r && mediaIndex[r]) {
        return mediaIndex[r];
      }
      return r;
    });
    const hasImage = mediaNames.some(m => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(m));

    cards.push({
      id: cid,
      prompt,
      answer,
      media: mediaNames,
      hasImage,
      deck: deckName,
      tags: note.tags
    });
  }

  return {
    cards,
    deckName: primaryDeckName
  };
}