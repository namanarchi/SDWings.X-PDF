using System;
using System.IO;
using System.Windows.Forms;

namespace SDWings.Desktop;

static class Program
{
    /// <summary>
    ///  The main entry point for the application.
    /// </summary>
    [STAThread]
    static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        string? fileToOpen = null;
        if (args.Length > 0 && File.Exists(args[0]))
        {
            fileToOpen = args[0];
        }

        Application.Run(new Form1(fileToOpen));
    }    
}