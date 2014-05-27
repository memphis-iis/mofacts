MoFaCTS Deployment Guide
===============================

This document gives an overview of deploying MoFaCTS to a Debian server,
although in reality this is also a brief guide to deploying any
meteor-based app.

There are four sections: Requirements, Deployment, Execution, and
"deploy.sh overview".  It is assumed that you would work through the
requirements section and create your own script for deployment and
execution.  The deploy.sh section describes the script in this directory
provided for your convenience.


Requirements
---------------------------

Thef first requirement is that you have a functional Linux server.  The
particular flavor of Linux shouldn't matter, but this document (and
the deploy.sh script) assume a Debian-based OS.

### Apache Web Server

First install the Apache web server.  It is assumed that the "base"
document directory for serving HTTP is /var/www/html and that the Apache
user is www-data. You should also create a home directory for mofacts
owned by the Apache user

    cd /var/www
    sudo mkdir mofacts
    chown -R www-data:www-data 

(Note: you could create your own and deploy to a completely different
location if necessary.  There is nothing magical about these choices.)

Now update the Apache config to proxy requests to your meteor server.
Note that this config assumes that the DNS entry mofacts.optimallearning.org
resovles to the server in question.  On a Debian server, the default site
can be configured by modifying `/etc/apache2/sites-enabled/000-default.conf`
and adding:

    <VirtualHost *:80>
        ServerName mofacts.optimallearning.org
        ProxyPass / http://127.0.0.1:3000/
        ProxyPassReverse / http://127.0.0.1:3000/
        ProxyPreserveHost on
    </VirtualHost>

When a browser request for `mofacts.optimallearning.org`, then Apache
will proxy the request to port 3000.  As a result MoFaCTS only needs to
listen on the local network interface and isn't directory exposed to
the internet.

### MongoDB

Next install MongoDB.  The default installation method for your OS should
be fine.  It is assumed that the MongoDB will be listening on the local
network interface (127.0.0.1) and the default port (27017).

The required database should be created automatically, but you can
pre-create the db if you want.  Keep in mind that databases and
collections are created lazily, so you'll need to create a dummy record
in a dummy collection in your database to forece creation.  For instance,
using the mongo shell:

    $ mongo
    MongoDB shell version: 2.6.1
    > show dbs
    admin  (empty)
    local  0.031GB
    > use MoFaCT
    switched to db MoFaCT
    > db.created.insert({"Hello":"World"})
    WriteResult({ "nInserted" : 1 })
    > show dbs
    MoFaCT  0.031GB
    admin   (empty)
    local   0.031GB
    > exit
    bye

### Node.js

A fairly recent Node.js should be installed on the server.  Please see
the node.js installation guide for details, but building node.js from
source isn't difficult.  Note that if your Debian-based OS has a package
named `nodejs-legacy`, you'll need to install three packages: nodejs,
npm, and nodejs-legacy.  If you're building from source, npm should be
installed for you.

Once that is done, npm should be used to install the `forever` package:

    $ sudo npm install -g forever


Deployment
---------------------------

Deploying MoFaCTs should be done the same as any other meteor application.
First you should bundle the application and copy that bundle to the server
where you will be deploying:

    $ cd mofacts/mofacts
    $ meteor bundle mofacts.tar.gz
    $ scp mofacts.tar.gz myuser@optimallearning.org:/var/www/mofacts

Note that deploy.sh expects the bundle name to be mofacts.tar.gz. 
There is nothing special about the file name, so if you are manually
deploying you may use whatever file name you wish.

At this point, you could simply log in to the server and let the script
take over for you:

    $ cd /var/www/mofacts
    $ ./deploy.sh

Assuming that your user ID has `sudo` rights, everything should work
just fine.  The rest of this section details how you perform the same
actions manually...

It is assumed that all the following steps are performed on the server
in the "home" directory for mofacts:

    $ cd /var/www/mofacts
    
One note - remember that for security everything in this directory will
owned by the www-data user.  As a result, many of the commands will be
executed using `sudo`
    
First the bundle needs to be extracted.  Many meteor tutorials will then
delete the bundle file.  The deploy.sh script changes the name of the
file instead.  As a result, the deployment step only occurs when necessary
(because it can only run when mofacts.tar.gz exists), but there is a copy
of the file used for the currently running deployment (named
mofacts.tar.gz.deployed).  Also note that for safety you should delete
the previous bundle.

    $ sudo rm -fr bundle
    $ sudo -E rm -f mofacts.tar.gz.deployed
    $ sudo -E -u www-data tar -zxf mofacts.tar.gz
    $ sudo mv mofacts.tar.gz mofacts.tar.gz.deployed
    
Now that the bundle has been extracted, any node.js packages requiring
native OS support need to be rebuilt.  MoFaCT doesn't use of packages
like that directly, but meteor uses the `fibers` package:

    $ sudo rm -fr bundle/programs/server/node_modules/fibers
    $ sudo npm install fibers@1.0.1
    
As a final step, the ownership of all involved files should be changed.

    $ sudo chown -R www-data:www-data *


Execution
---------------------------

One possible gotcha to note is that there isn't any service stop or
restart functionality currently supported.  As a result, any previous
instance of the process should be killed before starting a new one:

    $ sudo killall nodejs
    
Note that this assumes that no other node.js processes are running
on your server.

When executing a meteor app, a few environment variables need to be
specified.  As a result, it's important to use the `-E` switch with
`sudo` so that these variables are maintained.  In addition, node and
meteor both examine the HOME environment variable, so it should be set
correctly as well. Finally, note that the node.js `forever` package is
used to run meteor as a daemon process:

    $ export HOME=$(pwd)
    $ sudo -E -u www-data forever start bundle/main.js


deploy.sh description
---------------------------

The major functionality of the `deploy.sh` script is described above.
If the script needs to be customized, all configuration is handled at 
the beginning of the script using environment variables.

The script kills previous processes, deploys mofacts.tar.gz, and then
starts the mofacts (meteor) process using forever.  As a result, it
should usually do the "right thing".
