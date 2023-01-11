// .NET OneStep Startup and Installer for Mofacts
using System;
using System.Net;
using System.IO;
// using process
using System.Diagnostics;


// Check which OS we are running on
string os = Environment.OSVersion.ToString();

//write welcome message
Console.WriteLine("========================================");
Console.WriteLine("Welcome to Mofacts OneStep Installer");
Console.WriteLine("========================================");
Console.WriteLine("This installer will install Mofacts on your computer. It will also install the following dependencies:");
Console.WriteLine("Vagrant, VirtualBox, and Git");
Console.WriteLine("Please be patient and wait for the installer to finish. It could take a few minutes.");
Console.WriteLine("========================================");
Console.WriteLine("Press any key to continue...");


// Check if we are running on Windows and if so, download the Windows installers of VirtualBox, Git, and Vagrant
if (os.Contains("Windows"))
{
    Console.WriteLine("Checking if you are an administrator...");
    if (System.Security.Principal.WindowsIdentity.GetCurrent().Owner.IsWellKnown(System.Security.Principal.WellKnownSidType.BuiltinAdministratorsSid))
    {
        //create a directory for Mofacts in C:\Program Files
        Console.WriteLine("Creating Mofacts directory in C:\\Program Files...");
        Directory.CreateDirectory(@"C:\Program Files\MoFaCTS");
        //Check if git is installed
        Console.WriteLine("Checking if Git is installed...");
        if (File.Exists(@"C:\Program Files\Git\bin\git.exe"))
        {
            Console.WriteLine("Git is installed!");
        }
        else
        {
            Console.WriteLine("Git is not installed!");
            Console.WriteLine("Downloading Git...");
            //download git
            WebClient client = new WebClient();
            client.DownloadFile("https://github.com/git-for-windows/git/releases/download/v2.39.0.windows.2/Git-2.39.0.2-64-bit.exe", @"C:\Program Files\MoFaCTS\Git-Installer.exe");
            Console.WriteLine("Git downloaded!");
            Console.WriteLine("Installing Git...");
            //install git
            Process newProcess = new Process();
            newProcess.StartInfo.FileName = @"C:\Program Files\MoFaCTS\Git-Installer.exe";
            newProcess.StartInfo.Arguments = "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /SUPPRESSMSGBOXES";
            newProcess.Start();
            newProcess.WaitForExit();
            Console.WriteLine("Git installed!");
        }
        //Check if Node.js v12 is installed
        Console.WriteLine("Checking if Node.js v12 is installed...");
        if (File.Exists(@"C:\Program Files\nodejs\node.exe"))
        {
            Console.WriteLine("Node.js v12 is installed!");
        }
        else
        {
            Console.WriteLine("Node.js v12 is not installed!");
            Console.WriteLine("Downloading Node.js v12...");
            //download node.js v12
            WebClient client = new WebClient();
            client.DownloadFile("https://nodejs.org/dist/v12.22.7/node-v12.22.7-x64.msi", @"C:\Program Files\MoFaCTS\node-v12.22.7-x64.msi");
            Console.WriteLine("Node.js v12 downloaded!");
            Console.WriteLine("Installing Node.js v12...");
            //install node.js v12
            Process newProcess = new Process();
            newProcess.StartInfo.FileName = @"C:\Program Files\MoFaCTS\node-v12.22.7-x64.msi";
            newProcess.StartInfo.Arguments = "/quiet /norestart";
            newProcess.Start();
            newProcess.WaitForExit();
            Console.WriteLine("Node.js v12 installed!");
        }
        // use npmn to install meteor 1.12
        Console.WriteLine("Installing Meteor 1.12...");
        Process newProcess = new Process();
        newProcess.StartInfo.FileName = @"C:\Program Files\nodejs\npm.cmd";
        newProcess.StartInfo.Arguments = "install -g meteor@^1.12";
        newProcess.Start();
        newProcess.WaitForExit();
        Console.WriteLine("Meteor 1.12 installed!");
        //use git to clone the Mofacts repository
        Console.WriteLine("Cloning Mofacts repository...");
        newProcess.StartInfo.FileName = @"C:\Program Files\Git\bin\git.exe";
        newProcess.StartInfo.Arguments = "clone https://github.com/memphis-iis/mofacts-ies.git";
        newProcess.StartInfo.WorkingDirectory = @"C:\Program Files\MoFaCTS";
        newProcess.Start();
        newProcess.WaitForExit();
        Console.WriteLine("Mofacts repository cloned!");
        //use cmd to run  meteor npm install
        Console.WriteLine("Installing Mofacts dependencies...");
        newProcess.StartInfo.FileName = @"C:\Windows\System32\cmd.exe";
        newProcess.StartInfo.Arguments = "/c meteor npm install";
        newProcess.StartInfo.WorkingDirectory = @"C:\Program Files\MoFaCTS\mofacts-ies";
        newProcess.Start();
        newProcess.WaitForExit();
        Console.WriteLine("Mofacts dependencies installed!");
        //create bat file to run meteor
        Console.WriteLine("Creating bat file to run Mofacts...");
        string[] lines = { "cd C:\\Program Files\\MoFaCTS\\mofacts-ies", "meteor" };
        File.WriteAllLines(@"C:\Program Files\MoFaCTS\mofacts.bat", lines);
        Console.WriteLine("Bat file created!");
        //create desktop shortcut
        Console.WriteLine("Creating desktop shortcut...");
        string shortcutPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop) + @"\Mofacts.lnk";
        IWshShortcut shortcut = (IWshShortcut)new WshShell().CreateShortcut(shortcutPath);
        shortcut.Description = "Mofacts";
        shortcut.TargetPath = @"C:\Program Files\MoFaCTS\mofacts.bat";
        shortcut.Save();
        Console.WriteLine("Desktop shortcut created!");
    } else {
        Console.WriteLine("You must be an administrator to run this program.");
        Console.WriteLine("Press any key to exit...");
        Console.ReadKey();
    }
}
// Check if we are running on Ubuntu and if so, use apt to install vagrant, git, and virtualbox
else if (os.Contains("Unix")){
    // Install Vagrant, Git, and VirtualBox
    Console.WriteLine("Installing Vagrant, Git, and VirtualBox...");
    //ask for sudo password obscurely
    Console.WriteLine("Please enter your sudo password:");
    string password = Console.ReadLine();
    //clear the console
    Console.Clear();
    //create a process to run the apt-get commands
    Process newProcess = new Process();
    newProcess.StartInfo.FileName = "sudo";
    newProcess.StartInfo.Arguments = "-S apt-get install -y vagrant git virtualbox";
    newProcess.StartInfo.UseShellExecute = false;
    newProcess.StartInfo.RedirectStandardInput = true;
    newProcess.StartInfo.RedirectStandardOutput = true;
    newProcess.Start();
    Console.WriteLine("Vagrant, Git, and VirtualBox installed!");
    //Make Directory for Mofacts in /opt using sudo
    Console.WriteLine("Creating Mofacts directory in /opt...");
    newProcess.StartInfo.Arguments = "-S mkdir /opt/MoFaCTS";
    newProcess.Start();
    //Allow the user to read and write to the directory
    newProcess.StartInfo.Arguments = "-S chmod 777 /opt/MoFaCTS";
    newProcess.Start();
    //clone the Mofacts repository to /opt/Mofacts
    Console.WriteLine("Cloning Mofacts repository...");
    //change directory to /opt
    Directory.SetCurrentDirectory(@"/opt/MoFaCTS");
    //check if /opt/Mofacts/mofacts-ies exists, if so, delete it
    if (Directory.Exists(@"/opt/MoFaCTS/mofacts-ies"))
    {
        Console.WriteLine("Deleting old Mofacts directory...");
        Directory.Delete(@"/opt/MoFaCTS/mofacts-ies", true);
        Console.WriteLine("Old Mofacts directory deleted!");
    }
    //clone the repository
    Process newProcess0= Process.Start("git", "clone https://github.com/memphis-iis/mofacts-ies.git");
    newProcess0.WaitForExit();
    Console.WriteLine("Mofacts repository cloned!");
    //change directory to mofacts-ies
    Directory.SetCurrentDirectory(@"/opt/MoFaCTS/mofacts-ies");
    //run vagrant halt to make sure the VM is off
    Console.WriteLine("Running vagrant halt to make sure the VM is off...");
    Process newProcess1 = Process.Start("vagrant", "halt");
    newProcess1.WaitForExit();
    //run vagrant up
    Console.WriteLine("Running vagrant up for initial setup...");
    Process newProcess2 = Process.Start("vagrant", "up");
    newProcess2.WaitForExit();
    Console.WriteLine("vagrant up complete!");
    //run vagrant halt
    Console.WriteLine("Shutting down initialization...");
    Process newProcess3 = Process.Start("vagrant", "halt");
    newProcess3.WaitForExit();
    //create a shell script to run mofacts at /opt/Mofacts/mofacts-ies/mofacts_linux.sh
    using (StreamWriter sw = File.CreateText(@"/opt/MoFaCTS/mofacts-ies/mofacts_linux.sh"))
    {
        sw.WriteLine("#!/bin/bash");
        sw.WriteLine("cd /opt/MoFaCTS/mofacts-ies");
        sw.WriteLine("vagrant up");
        sw.WriteLine("vagrant ssh");
        
    }
    //add shortcut to /bin
    Console.WriteLine("Adding shortcut to /bin...");
    Process newProcess4 = Process.Start("sudo", "ln -s /opt/MoFaCTS/mofacts-ies/mofacts_linux.sh /bin/mofacts");
    //change permissions on mofacts_linux.sh
    Console.WriteLine("Changing permissions on mofacts_linux.sh...");
    Process newProcess5 = Process.Start("sudo", "chmod +x /opt/MoFaCTS/mofacts-ies/mofacts_linux.sh");
    newProcess4.WaitForExit();
    Console.WriteLine("Shortcut added!");
    //send a message to the user that the installation is complete
    Console.WriteLine("Installation complete!");
    Console.WriteLine("Please restart your computer to complete the installation.");
    Console.WriteLine("After restarting, you can run Mofacts by typing 'mofacts' in the terminal.");
    Console.WriteLine("Press any key to exit...");
    Console.ReadKey();
}
    







