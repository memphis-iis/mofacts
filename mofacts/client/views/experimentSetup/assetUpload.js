import { Template }    from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { FilesCollection } from 'meteor/ostrio:files';
import { Route53RecoveryCluster, Route53Resolver } from '../../../node_modules/aws-sdk/index';

Template.assetUpload.onCreated(function () {
  this.currentUpload = new ReactiveVar(false);
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
            console.log(fileObj);
            assetList = Session.get('assetLink') || [];
            assetList.push(
              {
               link: DynamicAssets.link(fileObj),
               filename: fileObj.name
              }
              );
            Session.set('assetLink',assetList);
          }
          template.currentUpload.set(false);
        });
        
        upload.start();

      }
    }
  }
});