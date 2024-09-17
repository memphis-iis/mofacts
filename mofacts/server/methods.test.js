import { Meteor } from 'meteor/meteor';
import { assert } from 'chai';
import sinon from 'sinon';
import { methods } from './methods';
import { Tdfs } from './collections'; // Adjust the import according to your project structure

describe('methods', function() {
    describe('getAccessableTDFSForUser', function() {
        let userId;
        let userStub;
        let tdfsStub;

        beforeEach(function() {
            userId = 'testUserId';

            // Stub Meteor.users.findOne
            userStub = sinon.stub(Meteor.users, 'findOne');
            userStub.withArgs({_id: userId}).returns({
                accessedTDFs: ['tdf1', 'tdf2']
            });

            // Stub Tdfs.find
            tdfsStub = sinon.stub(Tdfs, 'find');
            tdfsStub.withArgs({_id: {$in: ['tdf1', 'tdf2']}}).returns({
                fetch: () => [{_id: 'tdf1'}, {_id: 'tdf2'}]
            });
        });

        afterEach(function() {
            userStub.restore();
            tdfsStub.restore();
        });

        it('should return accessible TDFs for a user', function() {
            const result = methods.getAccessableTDFSForUser(userId);
            assert.deepEqual(result, {
                accessableTDFs: ['tdf1', 'tdf2'],
                TDFs: [{_id: 'tdf1'}, {_id: 'tdf2'}]
            });
        });

        it('should return empty arrays if user has no accessed TDFs', function() {
            userStub.withArgs({_id: userId}).returns({});
            const result = methods.getAccessableTDFSForUser(userId);
            assert.deepEqual(result, {
                accessableTDFs: [],
                TDFs: []
            });
        });
    });
});