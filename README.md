# Latest DOI (IES_Fall_2019 Release)

[![DOI](https://zenodo.org/badge/202790770.svg)](https://zenodo.org/badge/latestdoi/202790770)

# MoFaCTS README

MoFaCTS is a Meteor.js driven, responsive implementation of the FaCT System
designed for use by mobile participants.

Please see the docs subdirectory for a complete description of deployment and
production setup.

Please note - if you are using Windows or you're not comfortable installing,
maintaining, and using the tools required for meteor development, you can skip
to the "Using Vagrant" section below

If your development workstation is running Linux or Mac OSX, then you can
develop and test this application "natively". Just be sure that you've
installed meteor (see [https://www.meteor.com/](https://www.meteor.com/)).
You'll probably want to install  MongoDB; that way you can use the handy
`run_meteor` script in the meteor directory. Assuming that you've accomplished
the above, setting up and running the application is as simple as opening a
terminal and running:

````
$ git clone https://bitbucket.org/ppavlik/mofacts.git
$ cd mofacts/mofacts
$ ./run_meteor
````

# Using Vagrant

We maintain a Vagrantfile so that you can use vagrant to run this application
in a virtual machine. The virtual machine abstracts away the setup steps you
need to get a testable version of MoFaCTS running, and it allows you to
continue to use whatever code editors and other tools you like in your current
operating system. We'll cover the one-time steps you need to perform so that
you can use vagrant, a one-time setup for this project, and the common
development activities that you'll want to know about


## One-Time Setup for Vagrant

* Install git if you haven't already
* Install VirtualBox if you haven't already:
  [https://www.virtualbox.org/wiki/Downloads](https://www.virtualbox.org/wiki/Downloads)
* Install vagrant if you havent' already:
  [https://www.vagrantup.com/downloads.html](https://www.vagrantup.com/downloads.html)


## One-Time Setup for MoFaCTS

Now that you have vagrant and virtual box installed, you need to get MoFaCTS
set up for development. If you haven't already, you need to clone the code
repository. From your command prompt, clone the repository and then enter the
new directory:

````
$ git clone https://github.com/memphis-iis/mofacts-ies.git
$ cd mofacts
````

Now you're ready to use vagrant to set up your development environment. First,
we'll ask vagrant to download a "box"; this is a "base" image that we use as a
starting point. Assuming that you're in the mofacts directory that we cloned
above:

````
$ vagrant box add ubuntu/bionic64
````

This will download a virtual machine image. ***WARNING:*** this may take a
while if you haven't already downloaded the machine image. If for
some reason it should fail (which may happen if you have an intermittent
internet connection), you can just repeat the command.

***Note:*** this is an optional step. If you skip it, the `vagrant up` command
we describe below will automatically download the machine image.

Now we will have vagrant configure and start the virtual machine. Again, from
the directory you created above:

````
$ vagrant up
````

This will start the virtual machine. Since this is the first time you've
actually started it, a provisioning scripting will run. This script will take
some time since it will doing a variety of things, including downloading and
installing software. If this step fails, the safest way to restart is to
delete the virtual machine and start over:

````
$ vagrant destroy
$ vagrant up
````

Note that you can also re-initialize your virtual machine to it "original"
state this way if you want to discard any changes you've made to the virtual
machine's environment.

You're ready to begin development after the command completes.

## Typical Startup for MoFaCTS Development

Typically, you want to change files inside the MoFaCTS project, then run the
application and test your changes. When using vagrant, you first open a command
prompt (or terminal), navigate to the mofacts directory, and use vagrant to
run your virtual machine:

````
$ cd mofacts
$ vagrant up
````

***HINT:*** This should look familiar - `vagrant up` was the final setup step
we used in our one-time setup above. It should run much faster now since
you've already created and provisioned the virtual machine.

Once the virtual machine starts up, you can connect to it and run code.
Assuming that you're still in the same command prompt that you opened above:

````
$ vagrant ssh
````

If you have a problem (on Windows), you might need to add ssh to path
manually. In that case, you should be able to find a copy of ssh in your
git/bin directory.

The command prompt should look different now: you are at a shell prompt in the
virtual machine. Since vagrant shares the mofacts repository with the VM, you
can just `cd` into it to start the application. We've provided a handy script
to force the application to use the "real" MongoDB server in the VM (and
perform some other changes that make development on a Windows machine easier):

````
$ cd mofacts/mofacts
$ ./run_meteor
````

Ports for the application and MongoDB are already shared. Once meteor reports
that your application is running (after you've run `./run_meteor` as above),
you can connect from your native operating system at
[http://localhost:3000/](http://localhost:3000/)

You can also connect to the MongoDB instance with your tool of choice (for
instance, Robomongo) on your native operating system connecting to `localhost`
at port `30017`. Note that inside the virtual machine, the port for MongoDB is
the default `27017`.

As implied above, the general idea is that you edit source code, look at data,
test the application, commit code to the repository, etc. in your native
operating system. The vagrant-controlled virtual machine is where you run
the project in a suitable environment for testing.

## Testing
To run both server and client tests* in Vagrant, use

```
TEST_WATCH=1 ./run_meteor test --driver-package meteortesting:mocha --settings ./settings.json --allow-incompatible-update
```
*The `--full-app` option may be used for integration testing.

## When you're done with development

Once you've reached a stopping point, you should shut down your environment
cleanly. If you still have mofacts running, stop it with CTRL+C. Then you can
exit the SSH session by entering `exit` at the command prompt in the virtual
machine. After you exit, you should be back in your native OS environment
where you originally entered `vagrant ssh`. From here you can stop the virtual
machine:

````
$ vagrant halt
````

This is fine for the end of a development session, but if you want to remove
the virtual machine from your computer you can delete it:

````
$ vagrant destroy
````

This is a low risk activity, since you can always run `vagrant up` to recreate
the virtual machine for you.

## FAQs

### Question

I'm encountering the following error when trying to run meteor:
````
vagrant@vagrant-ubuntu-trusty-64:~/mofacts/mofacts$ ./run_meteor
-bash: ./run_meteor: /bin/bash^M: bad interpreter: No such file or directory
````

### Solution

This is an error due to the run_meteor file's line endings being converted to windows line endings and not linux line endings.  To fix it simply run the following commands inside the vagrant vm:

````
sudo apt-get install dos2unix
dos2unix run_meteor
````

Then simply run meteor as normal with

````
./run_meteor
````

## Caveats

* Older versions of Firefox that don't support HTML5 Web Audio are not compatible with MoFaCTs. This incompatibility
  is usually indicated by a "speechSynthesis is not defined or supported" error in the console.

* Server deployments should be performed as the root user, e.g. `sudo ./deploy.sh`. Failing to do this will cause a build
  error relating to the _fibers_ package.

* MoFaCTs runs on Node 8.x. Older versions of Node will throw a libstdc++.so.6 at build time.

* MoFaCTs must be built for Linux 64-bit architecture (`os.linux.x86_64`) _without_ Node being installed on the
  vagrant host machine. With Node host conflicts or the wrong architecture specified, a `unexpected token { const pause ...`
  error can be seen at build time.
