set PATH=%PATH%;C:\Users\Phil Pavlik\AppData\Local\Programs\Git\usr\bin
cd C:\Users\Phil Pavlik\Documents\NetBeansProjects\MoFaCTS
vagrant halt
vagrant up
vagrant ssh -c 'cd mofacts/mofacts; ./run_meteor'
pause