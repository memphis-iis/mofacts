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
    fontSizeClass: function() {
        // Take advantage of Bootstrap h1-h5 classes
        return 'h' + getCurrentFontSize().toString();
    },
});
