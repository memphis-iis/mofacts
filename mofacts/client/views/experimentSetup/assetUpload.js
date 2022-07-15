import { Template }    from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { FilesCollection } from 'meteor/ostrio:files';
import { Route53RecoveryCluster, Route53Resolver } from '../../../node_modules/aws-sdk/index';

Template.assetUpload.onCreated(function () {
  this.currentUpload = new ReactiveVar(false);
  Meteor.call('getAssetList', function(err, res) {
    Session.set('assetLink',res);
  })
});

Template.assetUpload.helpers({
  currentUpload() {
    return Template.instance().currentUpload.get();
  },
  assetLink: () => Session.get('assetLink'),
});

Template.assetUpload.events({
  'change #fileInput'(e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      for(let file of e.currentTarget.files){
        // We upload only one file, in case
        // multiple files were selected
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
            assetLink = DynamicAssets.link(fileObj);
            assetList = Session.get('assetLink') || [];
            if(fileObj.ext == "zip"){
              console.log('package detected')
              Meteor.call('processPackageUpload',fileObj.path,fileObj.ext,Meteor.userId(),function(err,res){
                if(err){
                  alert("Package upload failed.\n"+err);
                } else {
                  console.log(res);
                  Session.set('assetLink',res);
                }
              });
            }
          }
          template.currentUpload.set(false);
        });
        
        upload.start();

        }
      }
  }
});