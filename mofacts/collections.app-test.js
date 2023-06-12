import { Meteor } from 'meteor/meteor';


if(Meteor.isServer){
    var chai = require('chai');  
    var assert = chai.assert;    // Using Assert style
    var expect = chai.expect;    // Using Expect style
    var should = chai.should();  // Using Should style
    console.log('Running server tests');
    //run test on collections
    describe('Collections', function() {
        //test tdfs
        Tdfs.find().forEach(function(tdf){
            //expect tdf to have a valid _id
            it('tdf ' + tdf._id + ' should have a valid _id', function(){
                expect(tdf._id).to.be.a('string');
            });
            //expect tdf to have a valid owner that matches a user
            it('tdf ' + tdf._id +  ' should have a valid owner', function(){
                expect(Meteor.users.findOne(tdf.ownerId)).to.not.be.undefined;
            });
            //expect tdf to have a valid content.tdfs that is a object that contains a tutor object that contains a setspec object
            it('tdf ' + tdf._id +  ' should have a setspec', function(){
                expect(tdf.content.tdfs.tutor.setspec).to.be.a('object');
            });
            //expect tdf to have a valid content.tdfs that is a object that contains a tutor object that contains a unit array that is not empty
            it('tdf ' + tdf._id +  ' should have a unit array', function(){
                expect(tdf.content.tdfs.tutor.unit).to.be.a('array');
            });
            it('tdf ' + tdf._id +  ' should have a unit array that is not empty', function(){
                expect(tdf.content.tdfs.tutor.unit).to.not.be.empty;
            });
        });
        //test Stims
        Items.find().forEach(function(stimulus){
            //expect stimulus to have a valid _id
            it('stim ' + stimulus._id +  ' should have a valid _id', function(){
                expect(stimulus._id).to.be.a('string');
            });
            //expect stimulus to have a valid StimsSetId that is a integer
            it('stim ' + stimulus._id +  ' should have a valid StimSetId', function(){
                expect(stimulus.stimuliSetId).to.be.a('number');
            });
            //expect stimulus to have a stimulusFileName that matches a fileName is stim_files collection
            it('stim ' + stimulus._id +  ' should have a stimulusFileName', function(){
                expect(Stims.findOne({fileName: stimulus.stimulusFileName})).to.not.be.undefined;
            });
            //if stimulus has a correctResponse, expect it to have a syllables array
            it('stim ' + stimulus._id +  ' should have a syllables array if correctResponse is present', function(){
                if(stimulus.correctResponse){
                    expect(stimulus.syllables).to.be.a('array');
                }
            });
        });
        //test global experiment state
        GlobalExperimentStates.find().forEach(function(GlobalExperimentStates){
            //expect GlobalExperimentStates to have a valid _id
            it('global experiment state ' + GlobalExperimentStates._id +  ' should have a valid _id', function(){
                expect(GlobalExperimentStates._id).to.be.a('string');
            });
            //expect GlobalExperimentStates to have a valid userId that matches a user
            it('global experiment state ' + GlobalExperimentStates._id +  ' should have a valid userId', function(){
                expect(Meteor.users.findOne(GlobalExperimentStates.userId)).to.not.be.undefined;
            });
            //expect GlobalExperimentStates to have a valid tdfId that matches a tdf
            it('global experiment state ' + GlobalExperimentStates._id +  ' should have a valid tdfId', function(){
                expect(Tdfs.findOne({_id: GlobalExperimentStates.TDFId})).to.not.be.undefined;
            });
            //expect GlobalExperimentStates to have an experimentState object
            it('global experiment state ' + GlobalExperimentStates._id +  ' should have an experimentState object', function(){
                expect(GlobalExperimentStates.experimentState).to.be.a('object');
            });
            //expect GlobalExperimentStates to have a valid experimentState.currentUnitNumber that matches a unit in the tdf
            it('global experiment state ' + GlobalExperimentStates._id +  ' should have a valid experimentState.currentUnitNumber', function(){
                expect(Tdfs.findOne({_id: GlobalExperimentStates.tdfId}).content.tdfs.tutor.unit[GlobalExperimentStates.experimentState.currentUnitNumber]).to.not.be.undefined;
            });
            //expect GlobalExperimentStates to have a valid experimentStart.instructionClientState that is a double
            it('global experiment state ' + GlobalExperimentStates._id +  ' should have a valid experimentState.instructionClientStart', function(){
                expect(GlobalExperimentStates.experimentState.instructionClientStart).to.be.a('number');
            });
            //expect GlobalExperimentStates to have a valid experimentState.instructionClientStart that is before experimentState.lastTimeStamp
            it('global experiment state ' + GlobalExperimentStates._id +  ' should have a valid experimentState.instructionClientStart that is a valid time', function(){
                expect(GlobalExperimentStates.experimentState.instructionClientStart).to.be.below(GlobalExperimentStates.experimentState.lastTimeStamp);
            });
            //expect gloabalExperimentState to have a valid experimentState.lastActionTimeStamp that is a double
            it('global experiment state ' + GlobalExperimentStates._id +  ' should have a valid experimentState.lastActionTimeStamp', function(){
                expect(GlobalExperimentStates.experimentState.lastActionTimeStamp).to.be.a('number');
            });
        });
        //test Histories
        Histories.find().forEach(function(Histories){
            //expect Histories to have a valid _id
            it('history ' + Histories._id +  ' should have a valid _id', function(){
                expect(Histories._id).to.be.a('string');
            });
            //expect Histories to have a valid userId that matches a user
            it('history ' + Histories._id +  ' should have a valid userId', function(){
                expect(Meteor.users.findOne({_id: Histories.userId})).to.not.be.undefined;
            });
            //expect Histories to have a valid tdfId that matches a tdf
            it('history ' + Histories._id +  ' should have a valid tdfId', function(){
                expect(Tdfs.findOne({_id: Histories.TDFId})).to.not.be.undefined;
            });
            //expect CF_EndLatency, CF_StartLatency, and CF_EndLatency to be a number greater than 0
            it('history ' + Histories._id +  ' should have a valid latencies', function(){
                expect(Histories.CFEndLatency).to.be.above(0);
                expect(Histories.CFStartLatency).to.be.above(0);
                expect(Histories.CFEndLatency).to.be.above(0);
            });
            //expect CF_ResponseTime to be a number greater than 0
            it('history ' + Histories._id +  ' should have a valid CFResponseTime', function(){
                expect(Histories.CFResponseTime).to.be.above(0);
            });
            //expect CFItemRemoved to be false
            it('history ' + Histories._id +  ' should have a valid CFItemRemoved (false)', function(){
                expect(Histories.CFItemRemoved).to.be.false;
            });
            //hintLevel should be in the range [0, 3]
            it('history ' + Histories._id +  ' should have a valid hintLevel (range 0-3)', function(){
                expect(Histories.hintLevel).to.be.within(0, 3);
            });
        });
    });
}