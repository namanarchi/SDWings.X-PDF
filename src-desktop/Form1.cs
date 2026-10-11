using System;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SDWings.Desktop;

public partial class Form1 : Form
{
    private WebView2 webView = null!;
    private readonly string? _initialFileToOpen;

    public Form1(string? initialFile = null)
    {
        _initialFileToOpen = initialFile;
        InitializeWindow();
    }

    private void InitializeWindow()
    {
        Text = "SDWings.X _ PDF Reader";
        Width = 1440;
        Height = 900;
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new System.Drawing.Size(960, 640);
        BackColor = System.Drawing.Color.FromArgb(242, 241, 236);

        // Load unified SDX application icon for window title bar and taskbar
        try
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string iconPath = Path.Combine(baseDir, "app.ico");
            if (File.Exists(iconPath))
            {
                Icon = new System.Drawing.Icon(iconPath);
            }
            else
            {
                Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
        }
        catch { }

        webView = new WebView2
        {
            Dock = DockStyle.Fill
        };
        Controls.Add(webView);

        AllowDrop = true;
        DragEnter += Form1_DragEnter;
        DragDrop += Form1_DragDrop;

        Load += Form1_Load;
    }

    [System.Runtime.InteropServices.DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_CAPTION_COLOR = 35;
    private const int DWMWA_TEXT_COLOR = 36;

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        ApplyTitleBarTheme(false);
    }

    public void ApplyTitleBarTheme(bool isDark)
    {
        try
        {
            if (isDark)
            {
                int darkMode = 1;
                DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref darkMode, sizeof(int));

                // Caption background: #121417 -> COLORREF (0x00BBGGRR): 0x00171412
                int captionColor = 0x00171412;
                DwmSetWindowAttribute(Handle, DWMWA_CAPTION_COLOR, ref captionColor, sizeof(int));

                // Caption text: #F9FAFB -> COLORREF (0x00BBGGRR): 0x00FBFAF9
                int textColor = 0x00FBFAF9;
                DwmSetWindowAttribute(Handle, DWMWA_TEXT_COLOR, ref textColor, sizeof(int));
            }
            else
            {
                int darkMode = 0;
                DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref darkMode, sizeof(int));

                // Caption background matches app background #f2f1ec -> COLORREF (0x00BBGGRR): 0x00ECF1F2
                int captionColor = 0x00ECF1F2;
                DwmSetWindowAttribute(Handle, DWMWA_CAPTION_COLOR, ref captionColor, sizeof(int));

                // Caption text matches primary text #111827 -> COLORREF (0x00BBGGRR): 0x00271811
                int textColor = 0x00271811;
                DwmSetWindowAttribute(Handle, DWMWA_TEXT_COLOR, ref textColor, sizeof(int));
            }
        }
        catch { }
    }

    private async void Form1_Load(object? sender, EventArgs e)
    {
        ApplyTitleBarTheme(false);
        try
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string userDataDir = Path.Combine(localAppData, "SDWings.X-PDF", "WebView2Data");
            Directory.CreateDirectory(userDataDir);

            var env = await CoreWebView2Environment.CreateAsync(null, userDataDir);
            await webView.EnsureCoreWebView2Async(env);

            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.IsZoomControlEnabled = false;

            webView.CoreWebView2.WebMessageReceived += (s, args) =>
            {
                try
                {
                    string msgJson = args.WebMessageAsJson;
                    if (msgJson.Contains("theme_changed"))
                    {
                        bool isDark = msgJson.Contains("\"isDark\":true");
                        Invoke(() => ApplyTitleBarTheme(isDark));
                    }
                }
                catch { }
            };

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string distDir = Path.Combine(baseDir, "dist");
            if (!Directory.Exists(distDir))
            {
                distDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "dist"));
            }

            if (Directory.Exists(distDir))
            {
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "app.sdwings-x-pdf",
                    distDir,
                    CoreWebView2HostResourceAccessKind.Allow
                );
                webView.CoreWebView2.Navigate("https://app.sdwings-x-pdf/index.html");
            }
            else
            {
                webView.CoreWebView2.Navigate("http://localhost:5174/");
            }

            webView.NavigationCompleted += (s, args) =>
            {
                if (!string.IsNullOrEmpty(_initialFileToOpen) && File.Exists(_initialFileToOpen))
                {
                    OpenFileInApp(_initialFileToOpen);
                }
            };
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Lỗi khởi tạo trình đọc PDF: {ex.Message}", "SDWings.X-PDF", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void Form1_DragEnter(object? sender, DragEventArgs e)
    {
        if (e.Data is IDataObject data && data.GetDataPresent(DataFormats.FileDrop))
        {
            if (data.GetData(DataFormats.FileDrop) is string[] files && files.Length > 0 &&
                Path.GetExtension(files[0]).Equals(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                e.Effect = DragDropEffects.Copy;
                return;
            }
        }
        e.Effect = DragDropEffects.None;
    }

    private void Form1_DragDrop(object? sender, DragEventArgs e)
    {
        if (e.Data is IDataObject data && data.GetDataPresent(DataFormats.FileDrop))
        {
            if (data.GetData(DataFormats.FileDrop) is string[] files)
            {
                foreach (var file in files)
                {
                    if (Path.GetExtension(file).Equals(".pdf", StringComparison.OrdinalIgnoreCase))
                    {
                        OpenFileInApp(file);
                    }
                }
            }
        }
    }

    private async void OpenFileInApp(string filePath)
    {
        try
        {
            if (!File.Exists(filePath)) return;
            byte[] fileBytes = await File.ReadAllBytesAsync(filePath);
            string base64 = Convert.ToBase64String(fileBytes);
            string fileName = Path.GetFileName(filePath).Replace("'", "\\'");

            string js = $"window.postMessage({{ type: 'open_external_pdf', name: '{fileName}', base64: '{base64}' }}, '*');";
            await webView.CoreWebView2.ExecuteScriptAsync(js);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Không thể mở tệp: {ex.Message}", "SDWings.X-PDF", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }
}
