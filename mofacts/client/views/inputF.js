/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
Template.inputF.rendered = function()
{
    this.$('input').focus();
};


Template.inputF.helpers({

    fontsmall: function() {
        return getCurrentDeliveryParams().fontsize===1;
    },
 fontmedium: function() {
        return getCurrentDeliveryParams().fontsize===2;
    },
     fontlarge: function() {
        return getCurrentDeliveryParams().fontsize===3;
    }

});
