# MoFaCTS Deployment Guide

This document gives an overview of deploying MoFaCTS to a Debian server,
although in reality this is also a brief guide to deploying any meteor-based
application.

Four main sections follow: Requirements, Deployment, Execution, and "deploy.sh
overview". We assume that you will work through the requirements section and
create your own script for deployment and execution. The deploy.sh section
describes the script in this directory provided for your convenience.

*_Important:_* This document describes setting up a new server from scratch
and documents the setup process for optimallearning.org. If you are working on
the optimallearning.org server, then you probably care about deploying a new
version of the MoFaCT system:

 * Create a bundle on your dev system named mofacts.tar.gz
 * Copy it to /var/www/mofacts/mofacts.tar.gz on optimallearning.org
 * Log in to optimallearning.org, navigate to /var/www/mofacts, and
   run ./deploy.sh

You'll note that the deployment section below spells these three steps out in
detail.

If you are looking for scripts for setting up a new server, you should look in
the `../scripts/server` directory.


## Requirements

First you must have a functional Linux server. The particular flavor of Linux
shouldn't matter, but this document (and the deploy.sh script) assume a
Debian-based OS.

### Apache Web Server

First install the Apache web server. We assume that the "base" document
directory for serving HTTP is /var/www/html and that the Apache user is www-
data. You should also create a home directory for mofacts owned by the Apache
user.

````
$ cd /var/www
$ sudo mkdir mofacts
$ chown -R www-data:www-data
````

(Note: you could create your own and deploy to a different location if
necessary. None of these choices are magical.)

You might need to enable some functionality in your Apache server if it wasn't
turned on by default. You need proxy and proxy_http:

````
$ sudo a2enmod proxy
$ sudo a2enmod proxy_http
````

Now update the Apache config to proxy requests to your meteor server. Note
that this config assumes that the DNS entry mofacts.optimallearning.org
resovles to the server in question. On a Debian server, you can configure the
default site by modifying `/etc/apache2/sites-enabled/000-default.conf` and
adding:

````xml
<VirtualHost *:80>
    ServerName mofacts.optimallearning.org
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    ProxyPreserveHost on
</VirtualHost>
````

When a browser request for `mofacts.optimallearning.org`, then Apache will
proxy the request to port 3000. As a result MoFaCTS needs to listen on
the local network interface and isn't directory exposed to the internet.

### Apache SSL

The above is a decent default Apache configuration. You should also consider
using SSL on a production mofacts server. The server at mofacts.optimallearning.org
uses Let's Encrypt for SSL certs. If you follow this route, you'll need to do some extra setup.

***NOTE:*** before working through this section you should have performed the setup above and insured that your server is working.
Once everything is working you can proceed with the SSL setup below. This allow you to
start the SSL setup with a known working system, ***and*** the letsencrypt tool will
handle moving the proxy setup from the HTTP config to the HTTPS config for you automatically.

First you should enable SSL using Let's Encrypt tools. You should make sure you
have git and libaugeas0 installed:

````
$ sudo apt-get install git libaugeas0
````

Then you can clone the letsencrypt repository and use the letsencrypt-auto tool.
If your server is properly configured, the tool will be able to get you an
SSL cert, install it, and configure Apache to use it. When the automated tool
asks if you want all HTTP traffic direct to HTTPS, be sure to say yes.
A sample session with letsencrypt installed in `/opt` would look something
like:

````
$ sudo git clone https://github.com/letsencrypt/letsencrypt /opt/letsencrypt
$ cd /opt/letsencrypt
$ ./letsencrypt-auto --apache -d mofacts.optimallearning.org
````

You will need to make a some more adjustments to enabled all Meteor enabled. The
main issue is that the default SSL setup won't proxy websockets. Although
Meteor can work around this, you'll get better performance if websockets are working.
First, you'll need one more proxy module for websockets:

````
$ sudo a2enmod proxy_wstunnel
````

If you've been following along with the directions above, you should now have
two files to edit in `/etc/apache2/sites-enabled/`:

#### 000-default.conf

(Note that this may not represent the entire file. This listing should be
enough to identify what you need to change).

````xml
<VirtualHost *:80>
    ServerName mofacts.optimallearning.org
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    ProxyPreserveHost on

    RewriteEngine on

    # Added by mofacts installer
    ReWriteCond %{SERVER_PORT} !^443$
    # This allows DDP clients like ObjectiveDDP and Meteor-Unity to connect
    RewriteRule ^/websocket wss://%{SERVER_NAME}/websocket [NC,R,L]
    # This allows the meteor webapp to connect
    RewriteRule ^/sockjs/(.*)/websocket wss://%{SERVER_NAME}/sockjs/$1/websocket [NC,R,L]

    # from lets encrypt
    RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,QSA,R=permanent]
</VirtualHost>
````

The top section should already be there, and the bottom section marked as
`# from lets encrypt` should also be there. You'll need to add the middle
6 lines beginning with `# Added by mofacts installer`. Also note that the order
of these instructions matter, so be careful.

#### 000-default-le-ssl.conf

(Note that this may not represent the entire file. This listing should be
enough to identify what you need to change).

````xml
<VirtualHost *:443>
    ServerName mofacts.optimallearning.org

    #Added by lets encrypt
    SSLCertificateFile /etc/letsencrypt/live/mofacts.optimallearning.org/cert.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/mofacts.optimallearning.org/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
    SSLCertificateChainFile /etc/letsencrypt/live/mofacts.optimallearning.org/chain.pem

    #Added by mofacts installer
    ProxyRequests Off
    ProxyPass /websocket ws://localhost:3000/websocket
    ProxyPassMatch ^/sockjs/(.*)/websocket ws://localhost:3000/sockjs/$1/websocket

    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    ProxyPreserveHost on
</VirtualHost>
````

As before, most of the file should already be there. You
need to add the four lines starting with `# Added by mofacts installer`. Remember,
order matters.

### MongoDB

Next install MongoDB. The default installation method for your OS should be
fine. We assume that MongoDB will be listening on the local network interface
(127.0.0.1) and the default port (27017).

MongoDB will created the required database automatically on first access, but
you can pre-create the db if you want. For instance, using the mongo shell:

````
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
````

### Node.js

Meteor requires a specific Node.js version, which you should install on the
server. Please see the node.js installation guide for details, but building
node.js from source isn't difficult. Note that if your Debian-based OS has a
package named `nodejs-legacy`, you'll need to install three packages: nodejs,
npm, and nodejs-legacy. The node.js install process should install npm for
you.

Now you can use npm to install the `forever` package:

````
$ sudo npm install -g forever
````

_Important:_ As of this writing, the version of node.js supplied by the Debian
Jessie distribution is to old for the latest version of Meteor. As a result,
we manually compile and install node.js (which includes npm).

First we find the version of node bundle with meteor. We use a functioning
Vagrant development VM and the helper mnode script to get the current version.
From a development workstation:

````
user@host:~ $ cd mofacts
user@host:~/mofacts $ vagrant up
user@host:~/mofacts $ vagrant ssh
````

Once we have an SSH prompt in the vagrant development VM, we get the version:

````
vagrant@vagrant-ubuntu-trusty-64:~ $ cd mofacts/mofacts
vagrant@vagrant-ubuntu-trusty-64:~/mofacts/mofacts$ ./mnode -v
````

As of this writing, that is `v0.10.40`. The next step is to actually clone and
build that version on the actual server.

````
user@host:~ $ ssh optimallearning.org
user@fec239-1:~ $ git clone https://github.com/joyent/node.git
user@fec239-1:~ $ cd node
user@fec239-1:~/node $ git checkout v0.10.40-release
user@fec239-1:~/node $ ./configure
user@fec239-1:~/node $ make
user@fec239-1:~/node $ sudo make install
````

ow we can execute `sudo npm install -g forever` as above


## Deployment

You should deploy MoFaCTs just like any other meteor application.
First you should bundle the application and copy that bundle to the server
where you will be deploying. In the past you would do this with the bundle
command. Newer versions of Meteor now use the build command:

````
$ cd mofacts/mofacts
$ meteor build ./build  --architecture os.linux.x86_64
$ scp build/mofacts.tar.gz myuser@optimallearning.org:/var/www/mofacts
````

***Some important notes:*** The architecture switch used above is for the
optimal learning server. If that should change for some reason, you'll need a
different parameter. You should also note the main change from bundle command:
we no longer specify the bundle name. We must also specify a directory. We
specify `build`, but there's nothing special about the name. For convenience,
we've added mofacts/build to the main .gitignore file for this project so that
you don't automatically add the build folder (and your latest bundle) to the
git repo.

Note that deploy.sh expects the bundle name to be mofacts.tar.gz. This is the
name selected by `meteor build`, so there shouldn't be a problem.

At this point, you could just log in to the server and let the script take
over for you:

````
$ cd /var/www/mofacts
$ ./deploy.sh
````

Assuming that your user ID has `sudo` rights, everything should work just
fine. The rest of this section details how you perform the same actions
manually...

You perform all the following steps on the server in the "home" directory for
mofacts:

````
$ cd /var/www/mofacts
````

One note - remember that for security everything in this directory will owned
by the www-data user. As a result, you will use `sudo` to execute most of the
commands.

First you should extract the bundle. Meteor tutorials will often recommend
that you delete the bundle file, but our `deploy.sh` script changes the name
of the file instead. As a result, the deployment step occurs when necessary
(because it runs when mofacts.tar.gz exists), but there is a copy of the file
used for the running deployment (named mofacts.tar.gz.deployed). Also note
that for safety you should delete the previous bundle.

````
$ sudo rm -fr bundle
$ sudo -E rm -f mofacts.tar.gz.deployed
$ sudo -E -u www-data tar -zxf mofacts.tar.gz
$ sudo mv mofacts.tar.gz mofacts.tar.gz.deployed
````

Now that you have extracted the bundle, you need to rebuild any node.js
packages requiring native OS support. MoFaCT doesn't use of packages like
that directly, but meteor uses the `fibers` package:

````
$ sudo rm -fr bundle/programs/server/node_modules/fibers
$ sudo npm install fibers@1.0.1
````

As a final step, you should insure the ownership of all involved files is
correct.

````
$ sudo chown -R www-data:www-data *
````

## Execution

One possible gotcha to note is that there isn't any service stop or restart
functionality supported. As a result, you should kill any previous instance of
the process before starting a new one:

````
$ sudo killall nodejs
````

Note that this assumes that no other node.js processes are running on your
server.

When executing a meteor app, you must specify some environment variables. As a
result, it's important to use the `-E` switch with `sudo` so the commands can
"see" these variables. Node and meteor both examine the HOME environment
variable, so you must set it as well. We use the node.js `forever` package to
run meteor as a daemon process.

````
$ export HOME=$(pwd)
$ sudo -E -u www-data forever start bundle/main.js
````

## deploy.sh description

See above for the major functionality in the `deploy.sh` script. If you need
to customize the script, you should be able to change one (or more) of the
configuration variables at the beginning of the script.

The script terminates previous processes, deploys mofacts.tar.gz, and starts
the mofacts (meteor) process using forever. As a result, it should do the
"right thing".
