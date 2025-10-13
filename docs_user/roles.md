# Roles README

## Quick Overview

On startup, our server-side code will read role from the site config (see
server/lib/siteConfig.js for details). The system will add any user names found
in the arrays to the corresponding roles. The user names may also be email
addresses.

_Note_ that this logic will NOT remove anyone from a role on startup.

## Roles Overview

We are using the alanning:roles package - see
https://github.com/alanning/meteor-roles/ for details. Essentially it adds
roles on top of the Meteor user system.

Important: you will see checks for roles in the client-side code. This is a
convenience for users. Server-side methods handle actual security and
selectively published data. See server/methods.js for details.
