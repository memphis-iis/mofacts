import { Meteor } from 'meteor/meteor';

const waitForSubscriptions = () => new Promise(resolve => {
    const poll = Meteor.setInterval(() => {
        if (DDP._allSubscriptionsReady()) {
            Meteor.clearInterval(poll);
            resolve();
        }
    }, 200);
});


let chai = require('chai');  
let assert = chai.assert;    // Using Assert style
let expect = chai.expect;    // Using Expect style
let should = chai.should();  // Using Should style
console.log('Running client tests');

describe('client suite', () => {
    // First, ensure the data that we expect is loaded on the server
    //   Then, route the app to the homepage
    beforeEach(() => waitForSubscriptions()
    );
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

});