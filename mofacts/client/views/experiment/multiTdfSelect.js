import {updateExperimentState} from './card';

Template.multiTdfSelect.helpers({
  // None
});

Template.multiTdfSelect.events({
  // Start a Sub TDF
  'click .subTdfButton': async function(event) {
    event.preventDefault();
    console.log(event);

    const target = $(event.currentTarget);
    selectSubTdf(
        target.data('lessonName'),
        target.data('clusterList'),
        target.data('subTdfIndex'),
    );
  },
});

Template.multiTdfSelect.rendered = function() {
  // this is called whenever the template is rendered.
  const subTdfs = Session.get('currentTdfFile').subTdfs;

  $('#expDataDownloadContainer').html('');

  // Check all the valid TDF's
  subTdfs.forEach( function(subTdfObject, index) {
    const lessonName = subTdfObject.lessonName;
    const clusterList = subTdfObject.clusterList;

    addSubTdfButton(
        $('<button type=\'button\' name=\''+lessonName+'\'>')
            .addClass('btn btn-block btn-responsive subTdfButton')
            .data('lessonName', lessonName)
            .data('clusterList', clusterList)
            .data('subTdfIndex', index)
            .html(lessonName),
    );
  });
};

function addSubTdfButton(btnObj) {
  console.log('ADD BUTTON CALLED: ' + JSON.stringify(btnObj));
  let container = '<div class=\'col-xs-12 col-sm-12 col-md-3 col-lg-3 text-center\'><br></div>';
  container = $(container).prepend('<p style="display:inline-block">&nbsp;&nbsp;&nbsp;</p>');
  container = $(container).prepend(btnObj);
  $('#testButtonContainer').append(container);
}

// Actual logic for selecting and starting a TDF
async function selectSubTdf(lessonName, clusterList, subTdfIndex) {
  console.log('Selected subtdf: ' + lessonName + ' with clusterList: ' + clusterList + ' and subTdfIndex: ' + subTdfIndex);

  Session.set('subTdfIndex', subTdfIndex);
  const newExperimentState = {
    subTdfIndex: subTdfIndex,
  };
  await updateExperimentState(newExperimentState, 'multiTdfSelect.selectSubTdf');

  Router.go('/card');
}
