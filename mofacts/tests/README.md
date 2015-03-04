README for mofacts testing directory
=========================================

This directory contains some unit tests for mofacts. Note that the name
("tests") is special - Meteor won't load it on the server or send it to
the client.

Currently individual files are run from the mofacts project directory.
For instance:

    user@host:~/mofacts/mofacts$ node tests/AssessmentSession.js
    ...tests run and give output...
    user@host:~/mofacts/mofacts$ meteor
    ...now running application so you can system test...

At some point someone really needs to:

 1. Switch to an actual unit testing framework (like Mocha)
 2. Document how to run the entire test suite
 3. Vastly increase test coverage
 4. Look into the brand new Meteor testing framework (Velocity), which
    supports Mocha and many other frameworks

