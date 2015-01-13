Roles README
====================

Quick Overview
----------------------

On startup, our server-side code will read the files admins.json and
teachers.json from this directory.  Any usernames in the array in one of those
files will be added to the corresponding roles.

NOTE that currently no one will be removed from a role via this logic.

Roles Overview
----------------------

We are using the alanning:roles package - see https://github.com/alanning
/meteor-roles/ for details. Essentially it adds roles on top of the Meteor
user system.

Important: you will see checks for roles in the client-side code. This is a
convenience for users. However, actual security must be handled on the server
side via methods or data that is selectively published. See server/methods.js
for details.
