; Inno Setup Script for SDWings.X-PDF
; Ultra-lightweight, High-performance CAD PDF Workbench

#define MyAppName "SDWings.X _ PDF Reader"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "namanarchi.vn"
#define MyAppURL "https://github.com/namanarchi/SDWings.X-PDF"
#define MyAppExeName "SDWings.X-PDF.exe"

[Setup]
AppId={{5E98B48F-9C84-4EFA-9226-8A613F582DA1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\SDWings.X-PDF
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\release
OutputBaseFilename=SDWings.X-PDF-Setup-v1.0.0
SetupIconFile=..\src-desktop\app.ico
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\app.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=yes
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "associatepdf"; Description: "Đặt làm ứng dụng mở tệp PDF (.pdf) mặc định"; GroupDescription: "Liên kết định dạng tệp:"

[Files]
Source: "..\release\lightweight-win\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"; IconFilename: "{app}\app.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app.ico"; Tasks: desktopicon

[Registry]
Root: HKA; Subkey: "Software\Classes\.pdf\OpenWithProgids"; ValueType: string; ValueName: "SDWings.X-PDF.Document"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatepdf
Root: HKA; Subkey: "Software\Classes\SDWings.X-PDF.Document"; ValueType: string; ValueName: ""; ValueData: "Tài liệu PDF (SDWings.X _ PDF Reader)"; Flags: uninsdeletekey; Tasks: associatepdf
Root: HKA; Subkey: "Software\Classes\SDWings.X-PDF.Document\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\app.ico"; Tasks: associatepdf
Root: HKA; Subkey: "Software\Classes\SDWings.X-PDF.Document\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associatepdf

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
