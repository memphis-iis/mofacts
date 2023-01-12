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
    Console.WriteLine("Warning: Running on Windows is not recommended. Please use Linux if possible. Vagrant and VirtualBox are notoriously slow on Windows.");
    Console.WriteLine("Press any key to continue...");
    Console.ReadKey();
    //check if we are admin
    if (System.Security.Principal.WindowsIdentity.GetCurrent().Owner.IsWellKnown(System.Security.Principal.WellKnownSidType.BuiltinAdministratorsSid))
    {
        // Download the Windows installers of VirtualBox, Git, and Vagrant
        Console.WriteLine("Downloading Windows installers of VirtualBox, Git, and Vagrant...");
        string[] urls = new string[] { "https://download.virtualbox.org/virtualbox/6.1.16/VirtualBox-6.1.16-140961-Win.exe", "https://releases.hashicorp.com/vagrant/2.3.3/vagrant_2.3.3_windows_i686.msi","https://github.com/git-for-windows/git/releases/download/v2.38.1.windows.1/Git-2.38.1-32-bit.exe"};
        string[] filenames = new string[] { "VirtualBox-6.1.16-140961-Win.exe", "vagrant_2.3.3_windows_i686.msi", "Git-2.38.1-32-bit.exe" };
        for (int i = 0; i < urls.Length; i++)
        {
            using (WebClient client = new WebClient())
            {
                client.DownloadFile(urls[i], filenames[i]);
            }
        }
        Console.WriteLine("Download complete!");
        //Install VirtualBox headless
        Console.WriteLine("Installing VirtualBox...");
        Process.Start("VirtualBox-6.1.16-140961-Win.exe", "/S");
        Console.WriteLine("VirtualBox installed!");
        //Install Vagrant headless
        Console.WriteLine("Installing Vagrant...");
        Process.Start("vagrant_2.3.3_windows_i686.msi", "/quiet");
        Console.WriteLine("Vagrant installed!");
        //Install Git headless
        Console.WriteLine("Installing Git...");
        Process.Start("Git-2.38.1-32-bit.exe", "/SILENT");
        Console.WriteLine("Git installed!");
        //clean up
        Console.WriteLine("Cleaning up...");
        File.Delete("VirtualBox-6.1.16-140961-Win.exe");
        File.Delete("vagrant_2.3.3_windows_i686.msi");
        File.Delete("Git-2.38.1-32-bit.exe");
        Console.WriteLine("Clean up complete!");
        //Make Directory for Mofacts in Program Files
        Console.WriteLine("Creating Mofacts directory in Program Files...");
        //If the directory already exists, delete it
        if (Directory.Exists("C:\\Program Files\\Mofacts"))
        {
            Directory.Delete("C:\\Program Files\\Mofacts", true);
        }
        Directory.CreateDirectory(@"C:\Program Files\MoFaCTS");
        //Use git to clone the Mofacts repository at https://github.com/memphis-iis/mofacts-ies.git into the Mofacts directory
        Console.WriteLine("Cloning Mofacts repository...");
        //change directory to Program Files
        Directory.SetCurrentDirectory(@"C:\Program Files\MoFaCTS");
        //clone the repository form the github url, wait for it to finish
        Process newProcess =Process.Start("git", "clone \"https://github.com/memphis-iis/mofacts-ies.git\"");
        newProcess.WaitForExit();
        Console.WriteLine("Mofacts repository cloned!");
        //check if C:\Program Files\MoFaCTS\mofacts-ies exists, if so, delete it
        if (Directory.Exists(@"C:\Program Files\MoFaCTS\mofacts-ies"))
        {
            Console.WriteLine("Deleting old Mofacts directory...");
            Directory.Delete(@"C:\Program Files\MoFaCTS\mofacts-ies", true);
            Console.WriteLine("Old Mofacts directory deleted!");
        }
        //change directory to mofacts-ies
        Directory.SetCurrentDirectory(@"C:\Program Files\MoFaCTS\mofacts-ies");
        //run vagrant up
        Console.WriteLine("Running vagrant up for initial setup...");
        Process.Start("vagrant", "up");
        Console.WriteLine("vagrant up complete!");
        //shutdown
        Console.WriteLine("Shutting down initialization...");
        //vagrant halt
        Process.Start("vagrant", "halt");
        //create mofacts_windows.bat
        Console.WriteLine("Creating mofacts_windows.bat...");
        File.WriteAllText(@"C:\Program Files\MoFaCTS\mofacts_windows.bat", "cd C:\\Program Files\\MoFaCTS\\mofacts-ies\r vagrant up");
        Console.WriteLine("mofacts_windows.bat created!");
        //copy mofacts_windows.bat to desktop
        Console.WriteLine("Copying mofacts_windows.bat to desktop...");
        File.Copy(@"C:\Program Files\MoFaCTS\mofacts_windows.bat", @"C:\Users\Public\Desktop\mofacts_windows.bat");
        Console.WriteLine("Installation complete!");
        Console.WriteLine("Please restart your computer to complete the installation.");
        Console.WriteLine("You can now run Mofacts by running the mofacts_windows.bat file on your desktop.");
        Console.WriteLine("Press any key to exit...");
        Console.ReadKey();
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
    







