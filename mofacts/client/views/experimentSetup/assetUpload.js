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
      // We upload only one file, in case
      // multiple files were selected
      const upload = DynamicAssets.insert({
        file: e.currentTarget.files[0],
        chunkSize: 'dynamic'
      }, false);

      upload.on('start', function () {
        template.currentUpload.set(this);
      });

      upload.on('end', function (error, fileObj) {
        if (error) {
          alert(`Error during upload: ${error}`);
        } else {
          alert(`File "${fileObj.name}" successfully uploaded`);
          // console.log(DynamicAssets.link(fileObj));
          Session.set('assetLink',DynamicAssets.link(fileObj));
        }
        template.currentUpload.set(false);
      });

      upload.start();

    }
  }
});