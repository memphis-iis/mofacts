import { Template }    from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { FilesCollection } from 'meteor/ostrio:files';
import { Route53RecoveryCluster, Route53Resolver } from '../../../node_modules/aws-sdk/index';
import { meteorCallAsync } from '../../index';

Template.assetUpload.onCreated(function () {
  this.currentUpload = new ReactiveVar(false);
  Meteor.subscribe('files.assets.all');
});

Template.assetUpload.helpers({
  currentUpload() {
    return Template.instance().currentUpload.get();
  },
  assetLink: () => DynamicAssets.find(),
});

Template.assetUpload.events({
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
              doFileUpload(file, template)
            }
          });
        } else {
          doFileUpload(file, template)
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

function doFileUpload(file, template){
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
            alert("Package upload failed.\n"+err);
          } else {
            console.log(res);
          }
        });
      }
    }
    template.currentUpload.set(false);
  });
  
  upload.start();
}