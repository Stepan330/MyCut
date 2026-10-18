using System.IO;
using System.Windows;
using MyCut.Editor.Services;
using MyCut.Editor.ViewModels;

namespace MyCut.Editor;
public partial class App : Application
{
    private NativeSession? session;
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += (_, args) =>
        {
            Log(args.Exception);
            if (e.Args.Contains("--smoke-test")||e.Args.Contains("--spatial-test")) { args.Handled = true; Shutdown(1); return; }
            MessageBox.Show(args.Exception.Message, "MyCut", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
        };
        try
        {
            session = new NativeSession();
            bool smoke = e.Args.Contains("--smoke-test")||e.Args.Contains("--spatial-test");
            string preferences = smoke ? Path.Combine(AppContext.BaseDirectory, "smoke", "layout.json") :
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MyCut", "Editor", "layout.json");
            try {InterfaceSettings.Current.Initialize(Path.Combine(Path.GetDirectoryName(preferences)!,"interface.json"));}
            catch(Exception ex) when(ex is IOException or System.Text.Json.JsonException or UnauthorizedAccessException) {Log(ex);InterfaceSettings.Current.Reset();}
            if(smoke)InterfaceSettings.Current.Reset();
            try{if(smoke)SpatialSettings.Current.Reset();else SpatialSettings.Current.Load(Path.Combine(Path.GetDirectoryName(preferences)!,"spatial.json"));}catch(Exception ex) when(ex is IOException or System.Text.Json.JsonException or UnauthorizedAccessException){Log(ex);SpatialSettings.Current.Reset();}
            var vm = new EditorViewModel(session, smoke, e.Args.Contains("--hardware"));
            if(!smoke)vm.WorkbenchCommand.Execute(null);
            var window = new MainWindow(vm, new LayoutStore(preferences));
            MainWindow = window;
            window.Show();
            if(e.Args.Contains("--spatial-test"))window.RunSpatialTests();else if(smoke)window.RunSmokeTest();
        }
        catch (Exception ex)
        {
            Log(ex);
            if (!e.Args.Contains("--smoke-test")&&!e.Args.Contains("--spatial-test")) MessageBox.Show(ex.Message, "MyCut startup", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(1);
        }
    }
    internal static void Log(Exception error)
    {
        try
        {
            var folder = Path.Combine(AppContext.BaseDirectory, "logs");
            Directory.CreateDirectory(folder);
            File.AppendAllText(Path.Combine(folder, "mycut.log"), $"{DateTimeOffset.Now:O} {error}\n");
        }
        catch (IOException) { }
    }
    protected override void OnExit(ExitEventArgs e) { session?.Dispose(); base.OnExit(e); }
}
