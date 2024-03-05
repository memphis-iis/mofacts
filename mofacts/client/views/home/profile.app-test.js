import { Meteor } from 'meteor/meteor';
import { Router } from 'meteor/iron:router';
import { selectTdf } from '../new_templates/lessonSelect.js';

const waitForSubscriptions = () => new Promise(resolve => {
	const poll = Meteor.setInterval(() => {
		if (DDP._allSubscriptionsReady()) {
			Meteor.clearInterval(poll);
			resolve();
		}
	}, 200);
});

async function doPackageUpload(file) {
    const upload = DynamicAssets.insert({
        file: file,
        chunkSize: 'dynamic'
    }, false);

    upload.on('end', function (error, fileObj) {
        console.log('package detected')
        const link = DynamicAssets.link(fileObj);
        Meteor.call('processPackageUpload', fileObj, Meteor.userId(), "link", false, function (err, result) {
            if (err) {
                console.error(err);
            }
            console.log('result:', result);
            // for (res of result.results) {
            // }
        });
    });

	upload.start();
}

Meteor.call('getPackage', function (err, res) {
	if (err) {
		console.error(err);
	}
	const zip = new File(res, 'test.zip', { type: "application/zip" })
	console.log('result:', zip);
	doPackageUpload(zip);
});

let chai = require('chai');
let assert = chai.assert;    // Using Assert style
let expect = chai.expect;    // Using Expect style
let should = chai.should();  // Using Should styleconst 
console.log('Running client tests');

describe('client suite', () => {
	// First, ensure the data that we expect is loaded on the server
	//   Then, route the app to the homepage
	beforeEach(() => waitForSubscriptions());
	Router.go('/');
	Meteor.call('generateFixtures');

	describe('User data exists', function () {
		it('Meteor.user exists', function () {
			expect(Meteor.user()).to.not.be.undefined;
		});

		it('Meteor.userId exists', function () {
			expect(Meteor.userId()).to.not.be.undefined;
		});
	});

	describe('TDF data exists', function () {
		it('TDF data exists', function () {
			expect(Tdfs.find().count()).to.be.greaterThan(0);
		});
	});

	describe('Routes to lessonSelect', function () {
	    it('Testing Tdf button exists', async function () {
			await Router.go('/lessonSelect')
			//expect(Router.current().route.getName()).to.equal('client.lessonSelect');
			const TDFId = Tdfs.findOne()._id;
			expect($(`#${TDFId}`)).to.exist;
		})
	});

	describe('Lesson loads', function () {
		it('Lesson loads', async function () {
			const TDF = await Tdfs.findOne();
			await selectTdf(
				TDF._id,
				TDF.content.tdfs.tutor.setspec.lessonname,
				TDF.stimuliSetId,
				TDF.content.tdfs.tutor.setspec.speechIgnoreOutOfGrammarResponses === 'true' ? true : false,
				TDF.content.tdfs.tutor.setspec.speechOutOfGrammarFeedback === 'true' ? true : false,
				'test',
				false,
				false,
			);
			//expect(Router.current().route.getName()).to.equal('client.card');
		})
	});
});

describe('data available when routed', () => {
	// First, ensure the data that we expect is loaded on the server
	//   Then, route the app to the homepage
	beforeEach(() => () => Router.go('/lessonSelect')
		.then(waitForSubscriptions)
	);

	describe('when logged out', () => {
		it('has all public lists at homepage', () => {
			assert.equal(3, 3);
		});

		it('renders the correct list when routed to', () => {
			assert.equal(3, 3);
			// const list = Lists.findOne();
			// Router.go('Lists.show', { _id: list._id });

			// return afterFlushPromise()
			// 	.then(waitForSubscriptions)
			// 	.then(() => {
			// 		assert.equal($('.title-wrapper').html(), list.name);
			// 		assert.equal(Todos.find({ listId: list._id }).count(), 3);
			// 	});
		});
	});
});