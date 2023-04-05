import {meteorCallAsync} from '../..';
import {doFileUpload} from './contentUpload';

Template.FileManagement.onRendered(async function() {
  const allTeachers = await meteorCallAsync('getAllTeachers');
  Session.set('allUsersWithTeacherRole', allTeachers);
});

Template.FileManagement.helpers({
  'teachers': function() {
    return Session.get('allUsersWithTeacherRole');
  },
  'fileAccessors': function() {
    return Session.get('fileAccessors');
  },
  'ownedStims': function() {
    return Stims.find().fetch();
  },
  'ownedTDFS': function() {
    return Tdfs.find().fetch();
  },
  'stimLessonName': function(stimSetId) {
    return Session.get('allTdfs').filter(function(tdf) {
      return tdf.stimuliSetId === stimSetId;
    })[0].content.tdfs.tutor.setspec.lessonname;
  }
});

Template.FileManagement.events({
  'click #TransferOwnershipButton': function(event) {
    let fileId = event.currentTarget.getAttribute('data-fileId');
    let fileType = event.currentTarget.getAttribute('data-fileType');
    Session.set('transferOwnershipFileId', fileId);
    Session.set('transferOwnershipFileType', fileType);
  },

  'click #AssignAccessorsButton': function(event) {
    let fileId = event.currentTarget.getAttribute('data-fileId');
    Meteor.call('getAccessorsTDFID', fileId, function(err, res){
      if(err){
        console.log(err)
      }
      else{
        Session.set('fileAccessors', res);
      }
    })
    Session.set('AssignAccessorsFileId', fileId);
  },

  'click #transferOwnershipSaveButton': function() {
    const fileId = Session.get('transferOwnershipFileId');
    const fileType = Session.get('transferOwnershipFileType');
    const newOwnerUserName = $('#transferOwnershipDataList').val();
    const newOwnerId = $('#ownersDataList [value="' + newOwnerUserName + '"]').attr('data-teacherid');
    Meteor.call('transferDataOwnership', fileId, fileType, newOwnerId, Meteor.userId(), function(err, res){
      if(err){
        console.log(err)
      }
      else{
        console.log(res)
        Session.set('transferOwnershipFileId', undefined);
        Session.set('transferOwnershipFileType', undefined);
      }
    })
  },

  'click #addAcessor': function() {
    const newAccessorUserName = $('#assignAccessorDataList').val();
    const newAccessorId = $('#accessorsDataList [value="' + newAccessorUserName + '"]').attr('data-teacherid');
    $('#assignAccessorDataList').val('');
    let accessors = Session.get('fileAccessors') || [];
    let removedAccessors = Session.get('removedAccessors') || [];
    removedAccessors = removedAccessors.filter(function(accessor) {
      return accessor !== newAccessorId;
    });
    accessors.push({name: newAccessorUserName, userId: newAccessorId});
    Session.set('removedAccessors', removedAccessors);
    Session.set('fileAccessors', accessors);
  },

  'click #removeAcessor': function(event, instance) {
    const accessorID = event.currentTarget.getAttribute('data-teacherid');
    let accessors = Session.get('fileAccessors') || [];
    let removedAccessors = Session.get('removedAccessors') || [];
    accessors = accessors.filter(function(accessor) {
      return accessor.userId !== accessorID;
    });
    removedAccessors.push(accessorID);
    Session.set('removedAccessors', removedAccessors);
    Session.set('fileAccessors', accessors);
    },

  'click #assignAccessorsSaveButton': function(event) {
    const fileId = Session.get('AssignAccessorsFileId');
    const accessors = Session.get('fileAccessors');
    const removedAccessors = Session.get('removedAccessors');
    Meteor.call('assignAccessors', fileId, accessors, removedAccessors, function(err, res){
      if(err){
        console.log(err)  
      } else {
        console.log(res)
        alert('Accessors Assigned Successfully');
        Session.set('fileAccessors', []);
        Session.set('removedAccessors', []);
      }
    });
  },
  'click #fileOverwrite': function(event) {
    event.preventDefault();
    let fileName = event.currentTarget.getAttribute('data-fileName');
    let fileType = event.currentTarget.getAttribute('data-fileType');
    Session.set('fileName', fileName);
    Session.set('fileType', fileType);
  },
  'click #doFileUpload': async function(event, instance) {
    event.preventDefault();
    const fileType = Session.get('fileType');
    if(fileType === 'TDF'){
      await doFileUpload('#upload-file', 'tdf', 'TDF');
    } else if(fileType === 'stim'){
      await doFileUpload('#upload-file', 'stim', 'stim');
    }
  },
  'click #downloadStimFile': function(event) {
    event.preventDefault();
    let stimuliSetId = parseInt(event.currentTarget.getAttribute('data-fileId'));
    let stim = Stims.findOne({stimuliSetId: stimuliSetId})
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
  },
  'click #downloadTDFFile': function(event) {
    event.preventDefault();
    let TDFId = event.currentTarget.getAttribute('data-fileId');
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
  'click #fileDelete': function(event) {
    event.preventDefault();
    if(window.confirm('Are you sure you want to delete this file? All the data associated with this file will be deleted.')){
      let fileId = event.currentTarget.getAttribute('data-fileId');
      let fileType = event.currentTarget.getAttribute('data-fileType');
      let func = fileType == 'Stim' ? 'deleteStimFile' : 'deleteTDFFile';
      Meteor.call(func, fileId, function(err, res){
        if(err){
          console.log(err)
        }
        else{
          alert('File Deleted Successfully')
        }
      })
    }
  }
});