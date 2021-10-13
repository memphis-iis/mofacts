import {meteorCallAsync} from '../..';

const userFiles = new Mongo.Collection(null); // local-only - no database;

async function userFilesRefresh() {
  console.log('userFilesRefresh');
  userFiles.remove({'temp': 1});

  let count = 0;
  const userId = Meteor.userId();
  let allTdfs = await meteorCallAsync('getAllTdfs');
  console.log('allTdfs', allTdfs, typeof(allTdfs));
  Session.set('allTdfs', allTdfs);

  for (const tdf of Session.get('allTdfs')) {
    if (userId === tdf.ownerId) {
      try {
        userFiles.insert({
          'temp': 1,
          '_id': '' + tdf.TDFId,
          'idx': count,
          'type': 'tdf',
          'fileName': tdf.content.fileName.trim(),
        });
        count += 1;
      } catch (err) {
        if (err.name !== 'MinimongoError') {
          throw err;
        }
      }
      const stimuliSetId = tdf.stimuliSetId;
      let stimFileName = tdf.content.tdfs.tutor.setspec.stimulusfile;
      if (stimFileName) stimFileName = stimFileName[0];
      if (stimuliSetId && stimFileName) {
        try {
          userFiles.insert({
            'temp': 1,
            '_id': '' + stimuliSetId,
            'idx': count,
            'type': 'stim',
            'fileName': stimFileName,
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
