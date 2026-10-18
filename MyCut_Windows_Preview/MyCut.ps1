# MyCut Review Preview. Windows PowerShell 5.1 + WPF, no network operations.
$ErrorActionPreference = 'Stop'
$AppRoot = $PSScriptRoot
$LogPath = Join-Path $AppRoot 'mycut-startup.log'
try {
 Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Xaml
 $reader = New-Object System.Xml.XmlNodeReader ([xml](Get-Content -LiteralPath (Join-Path $AppRoot 'MainWindow.xaml') -Raw))
 $script:Window = [Windows.Markup.XamlReader]::Load($reader)
 $script:Ui = @{}
 $names = @('OpenCollection','SaveCollection','ImportButton','CategoryList','SourceTitle','FavoriteButton','Media','Photo','PhotoTransform','EmptyView','EmptyTitle','EmptyDetail','ViewerBadge','BackFrame','PlayButton','NextFrame','TimeInput','DurationLabel','MuteCheck','VolumeSlider','SourcePanel','SourceRow','TimelineCanvas','SeekSlider','MarkIn','MarkOut','AddMarker','LoopCheck','RangeInfo','FitSource','FitRange','ZoomSlider','SourceDetails','RelinkButton','NoteInput','PhotoZoom','RangeName','SaveRange','RangeList','DeleteRange','MarkerList','HoverCheck','ViewMode','SearchInput','MediaList','StatusText','HoverPopup','HoverMedia','HoverTitle')
 foreach ($name in $names) { $script:Ui[$name] = $script:Window.FindName($name); if ($null -eq $script:Ui[$name]) { throw "Missing UI element: $name" } }
 $script:Assets = New-Object 'System.Collections.ObjectModel.ObservableCollection[object]'
 $script:Current = $null
 $script:Playing = $false
 $script:Loading = $false
 $script:Updating = $false
 $script:Restoring = $false
 $script:Duration = 0.0
 $script:InPoint = 0.0
 $script:OutPoint = 0.0
 $script:Position = 0.0
 $script:ViewStart = 0.0
 $script:ListMode = $false
 $script:Hovered = $null
 $StateDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MyCut\ReviewPreview'
 [void][IO.Directory]::CreateDirectory($StateDir)
 $script:DefaultState = Join-Path $StateDir 'collection.json'

 function Set-Status([string]$message) { $script:Ui.StatusText.Text = $message }
 function Format-Time([double]$seconds) {
  $span = [TimeSpan]::FromSeconds([Math]::Max(0,$seconds))
  return ('{0:00}:{1:00}:{2:00}.{3:000}' -f [Math]::Floor($span.TotalHours),$span.Minutes,$span.Seconds,$span.Milliseconds)
 }
 function Load-Bitmap([string]$path) {
  $bitmap = New-Object Windows.Media.Imaging.BitmapImage
  $bitmap.BeginInit()
  $bitmap.CacheOption = [Windows.Media.Imaging.BitmapCacheOption]::OnLoad
  $bitmap.UriSource = New-Object Uri $path
  $bitmap.EndInit(); $bitmap.Freeze()
  return $bitmap
 }
 function New-Asset([string]$path) {
  $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
  $kind = if ($ext -in @('.png','.jpg','.jpeg','.bmp','.gif','.tif','.tiff')) {'Photo'} elseif ($ext -in @('.wav','.mp3','.wma','.m4a','.aac','.flac')) {'Audio'} elseif ($ext -in @('.mp4','.mov','.avi','.wmv','.m4v','.mkv','.webm')) {'Video'} else {return $null}
  $thumb = $null; $resolution = ''
  if ($kind -eq 'Photo') { try { $thumb=Load-Bitmap $path; $resolution="$($thumb.PixelWidth) x $($thumb.PixelHeight)" } catch { $resolution='Unable to decode image' } }
  return [pscustomobject]@{Id=[Guid]::NewGuid().ToString();Path=$path;Name=[IO.Path]::GetFileName($path);Kind=$kind;Thumb=$thumb;Resolution=$resolution;Duration=0.0;Favorite=$false;Note='';LastPosition=0.0;Ranges=(New-Object 'System.Collections.ObjectModel.ObservableCollection[object]');Markers=(New-Object 'System.Collections.ObjectModel.ObservableCollection[object]');Summary="$kind - local file"}
 }
 function Stop-Hover {
  $script:HoverTimer.Stop()
  $script:Ui.HoverPopup.IsOpen=$false
  $script:Ui.HoverMedia.Stop(); $script:Ui.HoverMedia.Close()
  $script:Hovered=$null
 }
 function Pause-Media {
  $script:Ui.Media.Pause()
  $script:Playing=$false
  $script:Ui.PlayButton.Content='Play'
 }
 function Refresh-Library {
  $category = 'All'
  if ($null -ne $script:Ui.CategoryList.SelectedItem) { $category=[string]$script:Ui.CategoryList.SelectedItem.Tag }
  $query = $script:Ui.SearchInput.Text
  $visible = @($script:Assets | Where-Object {
   ($category -eq 'All' -or $_.Kind -eq $category -or ($category -eq 'Favorite' -and $_.Favorite) -or ($category -eq 'Ranges' -and $_.Ranges.Count -gt 0)) -and ($_.Name.IndexOf($query,[StringComparison]::OrdinalIgnoreCase) -ge 0)
  })
  $script:Ui.MediaList.ItemsSource = $visible
  if ($null -ne $script:Current -and $visible -contains $script:Current) { $script:Ui.MediaList.SelectedItem=$script:Current }
 }
 function Show-Details {
  if ($null -eq $script:Current) {return}
  $a=$script:Current
  $script:Ui.SourceDetails.Text = "$($a.Kind)$([Environment]::NewLine)$($a.Resolution)$([Environment]::NewLine)$(Format-Time $a.Duration)$([Environment]::NewLine)$([Environment]::NewLine)$($a.Path)"
  $script:Ui.FavoriteButton.Content = if ($a.Favorite) {'Favorited'} else {'Favorite'}
  $script:Ui.RangeList.ItemsSource=$a.Ranges
  $script:Ui.MarkerList.ItemsSource=$a.Markers
 }
 function Draw-Timeline {
  $canvas=$script:Ui.TimelineCanvas
  $canvas.Children.Clear()
  $width=$canvas.ActualWidth
  if ($width -le 1 -or $script:Duration -le 0) {return}
  $zoom=[double]$script:Ui.ZoomSlider.Value
  $span=$script:Duration/$zoom
  $script:ViewStart=[Math]::Max(0,[Math]::Min($script:ViewStart,$script:Duration-$span))
  $startX=($script:InPoint-$script:ViewStart)/$span*$width
  $endX=($script:OutPoint-$script:ViewStart)/$span*$width
  $selection=New-Object Windows.Shapes.Rectangle
  $selection.Fill=[Windows.Media.BrushConverter]::new().ConvertFromString('#3D6294')
  $selection.Width=[Math]::Max(0,[Math]::Min($width,$endX)-[Math]::Max(0,$startX))
  $selection.Height=60
  [Windows.Controls.Canvas]::SetLeft($selection,[Math]::Max(0,$startX))
  [void]$canvas.Children.Add($selection)
  for ($i=0;$i -le 4;$i++) {
   $label=New-Object Windows.Controls.TextBlock
   $label.Text=Format-Time ($script:ViewStart+$span*$i/4)
   $label.FontSize=10; $label.Foreground=[Windows.Media.Brushes]::LightSteelBlue
   [Windows.Controls.Canvas]::SetLeft($label,[Math]::Max(0,[Math]::Min($width-84,$width*$i/4)))
   [Windows.Controls.Canvas]::SetTop($label,4);[void]$canvas.Children.Add($label)
  }
  foreach ($marker in $script:Current.Markers) {
   $x=($marker.Time-$script:ViewStart)/$span*$width
   if ($x -lt 0 -or $x -gt $width) {continue}
   $label=New-Object Windows.Controls.TextBlock;$label.Text='M';$label.Foreground=[Windows.Media.Brushes]::PaleGoldenrod
   [Windows.Controls.Canvas]::SetLeft($label,$x);[Windows.Controls.Canvas]::SetTop($label,39);[void]$canvas.Children.Add($label)
  }
  $line=New-Object Windows.Shapes.Rectangle
  $line.Width=2;$line.Height=60;$line.Fill=[Windows.Media.Brushes]::LightSkyBlue
  [Windows.Controls.Canvas]::SetLeft($line,($script:Position-$script:ViewStart)/$span*$width)
  [void]$canvas.Children.Add($line)
  $script:Ui.RangeInfo.Text=('{0:0.00} - {1:0.00} s' -f $script:InPoint,$script:OutPoint)
  $script:Ui.SaveRange.IsEnabled=($script:OutPoint -gt $script:InPoint -and $script:Current.Kind -ne 'Photo')
 }
 function Update-PositionUi {
  $script:Updating=$true
  $script:Ui.SeekSlider.Value=$script:Position
  if (-not $script:Ui.TimeInput.IsKeyboardFocusWithin) { $script:Ui.TimeInput.Text=Format-Time $script:Position }
  $script:Updating=$false
  Draw-Timeline
 }
 function Seek-To([double]$seconds) {
  if ($null -eq $script:Current -or $script:Current.Kind -eq 'Photo' -or $script:Loading) {return}
  $script:Position=[Math]::Max(0,[Math]::Min($seconds,$script:Duration))
  $script:Ui.Media.Position=[TimeSpan]::FromSeconds($script:Position)
  $script:Current.LastPosition=$script:Position
  Update-PositionUi
 }
 function Select-Asset($asset) {
  if ($null -eq $asset) {return}
  if ($null -ne $script:Current -and $asset.Id -eq $script:Current.Id) {return}
  Stop-Hover
  Pause-Media; $script:Ui.Media.Close();$script:Ui.Media.Source=$null
  $script:Current=$asset;$script:Duration=[double]$asset.Duration
  $script:Position=0.0;$script:InPoint=0.0;$script:OutPoint=$script:Duration;$script:ViewStart=0.0
  $script:Ui.ZoomSlider.Value=1
  $script:Ui.SourceTitle.Text=$asset.Name
  $script:Ui.NoteInput.Text=$asset.Note
  $script:Ui.EmptyView.Visibility='Collapsed'
  $script:Ui.Photo.Visibility='Collapsed';$script:Ui.Media.Visibility='Visible'
  $script:Ui.PhotoZoom.Value=1;$script:Ui.PhotoZoom.IsEnabled=($asset.Kind -eq 'Photo')
  $script:Ui.SourcePanel.Visibility=if ($asset.Kind -eq 'Photo') {'Collapsed'} else {'Visible'}
  $rowHeight=if ($asset.Kind -eq 'Photo') {0.0} else {175.0}
  $script:Ui.SourceRow.Height=[Windows.GridLength]::new($rowHeight)
  $script:Ui.SaveRange.IsEnabled=$false
  foreach ($control in @('BackFrame','NextFrame','MarkIn','MarkOut','AddMarker')) {$script:Ui[$control].IsEnabled=($asset.Kind -ne 'Photo')}
  $script:Ui.ViewerBadge.Text=if ($asset.Path.StartsWith((Join-Path $AppRoot 'Demo'),[StringComparison]::OrdinalIgnoreCase)) {'Included demo material'} else {'Local source'}
  $script:Loading=$false
  if (-not (Test-Path -LiteralPath $asset.Path -PathType Leaf)) {
   $script:Ui.EmptyView.Visibility='Visible';$script:Ui.EmptyTitle.Text='Source file is missing';$script:Ui.EmptyDetail.Text='Use Locate source to reconnect it.'
   Set-Status 'Missing file. Saved ranges are retained.'
  } elseif ($asset.Kind -eq 'Photo') {
   try {
    $bitmap=Load-Bitmap $asset.Path;$asset.Thumb=$bitmap;$asset.Resolution="$($bitmap.PixelWidth) x $($bitmap.PixelHeight)"
    $script:Ui.Photo.Source=$bitmap;$script:Ui.Photo.Visibility='Visible';$script:Ui.Media.Visibility='Collapsed'
    Set-Status 'Photo opened. Use the Photo View slider to zoom.'
   } catch { $script:Ui.EmptyView.Visibility='Visible';$script:Ui.EmptyTitle.Text='Image cannot be opened';$script:Ui.EmptyDetail.Text=$_.Exception.Message }
  } else {
   $script:Loading=$true
   $script:Ui.Media.Volume=0
   $script:Ui.Media.Source=New-Object Uri $asset.Path
   $script:Ui.Media.Play()
   if ($asset.Kind -eq 'Audio') {$script:Ui.EmptyView.Visibility='Visible';$script:Ui.EmptyTitle.Text='Audio source';$script:Ui.EmptyDetail.Text='Press Play to listen. Waveform generation is planned.'}
   Set-Status 'Loading media...'
  }
  $script:Ui.PlayButton.IsEnabled=($asset.Kind -ne 'Photo' -and -not $script:Loading)
  $script:Ui.SeekSlider.Maximum=[Math]::Max(0.001,$script:Duration)
  $script:Ui.DurationLabel.Text='/ '+(Format-Time $script:Duration)
  Show-Details;Update-PositionUi
 }
 function Add-Files([string[]]$paths) {
  $first=$null
  foreach ($path in $paths) {
   if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {continue}
   $full=[IO.Path]::GetFullPath($path)
   if (@($script:Assets | Where-Object {$_.Path -eq $full}).Count -gt 0) {continue}
   $asset=New-Asset $full
   if ($null -ne $asset) {[void]$script:Assets.Add($asset);if ($null -eq $first) {$first=$asset}}
  }
  Refresh-Library
  if ($null -ne $first) {$script:Ui.MediaList.SelectedItem=$first;Select-Asset $first}
 }
 function Save-State([string]$path) {
  $data=@{Version=1;Assets=@($script:Assets | ForEach-Object {
   @{Id=$_.Id;Path=$_.Path;Name=$_.Name;Kind=$_.Kind;Duration=$_.Duration;Resolution=$_.Resolution;Favorite=$_.Favorite;Note=$_.Note;LastPosition=$_.LastPosition;Ranges=@($_.Ranges | ForEach-Object {@{Name=$_.Name;Start=$_.Start;End=$_.End;Label=$_.Label}});Markers=@($_.Markers | ForEach-Object {@{Time=$_.Time;Label=$_.Label}})}
  })}
  $temp=$path+'.tmp'
  $data | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $temp -Encoding UTF8
  Move-Item -LiteralPath $temp -Destination $path -Force
 }
 function Load-State([string]$path) {
  $data=Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
  if ($data.Version -ne 1) {throw 'Unsupported collection version.'}
  $replacement=New-Object 'System.Collections.ObjectModel.ObservableCollection[object]'
  foreach ($saved in $data.Assets) {
   $a=New-Asset ([string]$saved.Path);if ($null -eq $a) {continue}
   $a.Id=[string]$saved.Id;$a.Duration=[double]$saved.Duration;$a.Favorite=[bool]$saved.Favorite;$a.Note=[string]$saved.Note;$a.LastPosition=[double]$saved.LastPosition
   if ($saved.Resolution) {$a.Resolution=[string]$saved.Resolution}
   foreach ($r in $saved.Ranges) {[void]$a.Ranges.Add([pscustomobject]@{Name=[string]$r.Name;Start=[double]$r.Start;End=[double]$r.End;Label=[string]$r.Label})}
   foreach ($m in $saved.Markers) {[void]$a.Markers.Add([pscustomobject]@{Time=[double]$m.Time;Label=[string]$m.Label})}
   [void]$replacement.Add($a)
  }
  Stop-Hover;Pause-Media;$script:Ui.Media.Close();$script:Current=$null
  $script:Assets=$replacement
  $script:Ui.CategoryList.SelectedIndex=0;$script:Ui.SearchInput.Text=''
  Refresh-Library
  if ($script:Assets.Count -gt 0) {$script:Ui.MediaList.SelectedIndex=0;Select-Asset $script:Assets[0]}
  Set-Status 'Collection loaded. Original files remain in their locations.'
 }
 function Toggle-Play {
  if ($null -eq $script:Current -or $script:Current.Kind -eq 'Photo' -or $script:Loading -or $script:Duration -le 0) {return}
  if ($script:Playing) {Pause-Media} else {
   if ($script:Ui.LoopCheck.IsChecked -and ($script:Position -lt $script:InPoint -or $script:Position -ge $script:OutPoint)) {Seek-To $script:InPoint}
   elseif ($script:Position -ge $script:Duration) {Seek-To 0}
   $script:Ui.Media.Play();$script:Playing=$true;$script:Ui.PlayButton.Content='Pause'
  }
 }
 function Mark-Boundary([string]$which) {
  if ($null -eq $script:Current -or $script:Current.Kind -eq 'Photo' -or $script:Loading) {return}
  if ($which -eq 'In') {$script:InPoint=$script:Position} else {$script:OutPoint=$script:Position}
  Draw-Timeline
  Set-Status 'Range boundary changed. Click Save range to keep this selection.'
 }
 function Add-Marker {
  if ($null -eq $script:Current -or $script:Current.Kind -eq 'Photo' -or $script:Loading) {return}
  [void]$script:Current.Markers.Add([pscustomobject]@{Time=$script:Position;Label="Marker $($script:Current.Markers.Count+1) - $(Format-Time $script:Position)"})
  Draw-Timeline
 }

 $script:HoverTimer=New-Object Windows.Threading.DispatcherTimer
 $script:HoverTimer.Interval=[TimeSpan]::FromMilliseconds(200)
 $script:HoverTimer.Add_Tick({
  $script:HoverTimer.Stop()
  if ($null -eq $script:Hovered -or -not $script:Ui.HoverCheck.IsChecked) {return}
  $a=$script:Hovered
  if ($a.Kind -ne 'Video' -or -not (Test-Path -LiteralPath $a.Path)) {return}
  $script:Ui.HoverTitle.Text=$a.Name
  $script:Ui.HoverMedia.Source=New-Object Uri $a.Path
  $script:Ui.HoverPopup.IsOpen=$true
  $script:Ui.HoverMedia.Play()
 })
 $script:Ui.HoverMedia.Add_MediaFailed({$script:Ui.HoverPopup.IsOpen=$false})
 $script:Ui.HoverMedia.Add_MediaEnded({$script:Ui.HoverMedia.Position=[TimeSpan]::Zero;$script:Ui.HoverMedia.Play()})
 $script:Ui.MediaList.Add_MouseMove({
  param($sender,$eventArgs)
  if (-not $script:Ui.HoverCheck.IsChecked) {return}
  $container=[Windows.Controls.ItemsControl]::ContainerFromElement($script:Ui.MediaList,$eventArgs.OriginalSource)
  if ($null -eq $container) {Stop-Hover;return}
  $asset=$container.DataContext
  if ($null -ne $asset -and ($null -eq $script:Hovered -or $asset.Id -ne $script:Hovered.Id)) {Stop-Hover;$script:Hovered=$asset;$script:HoverTimer.Start()}
 })
 $script:Ui.MediaList.Add_MouseLeave({Stop-Hover})
 $script:Ui.HoverCheck.Add_Unchecked({Stop-Hover})
 $script:Ui.MediaList.Add_SelectionChanged({if ($null -ne $script:Ui.MediaList.SelectedItem) {Select-Asset $script:Ui.MediaList.SelectedItem}})
 $script:Ui.ImportButton.Add_Click({
  $dialog=New-Object Microsoft.Win32.OpenFileDialog
  $dialog.Multiselect=$true;$dialog.Filter='Media files|*.mp4;*.mov;*.avi;*.wmv;*.m4v;*.mkv;*.webm;*.png;*.jpg;*.jpeg;*.bmp;*.gif;*.tif;*.tiff;*.wav;*.mp3;*.wma;*.m4a;*.aac;*.flac|All files|*.*'
  if ($dialog.ShowDialog($script:Window)) {Add-Files $dialog.FileNames}
 })
 $script:Window.Add_Drop({param($sender,$eventArgs);if ($eventArgs.Data.GetDataPresent([Windows.DataFormats]::FileDrop)) {Add-Files ($eventArgs.Data.GetData([Windows.DataFormats]::FileDrop))}})
 $script:Ui.CategoryList.Add_SelectionChanged({Refresh-Library})
 $script:Ui.SearchInput.Add_TextChanged({Refresh-Library})
 $script:Ui.FavoriteButton.Add_Click({if ($null -ne $script:Current) {$script:Current.Favorite=-not $script:Current.Favorite;Show-Details;Refresh-Library}})
 $script:Ui.NoteInput.Add_TextChanged({if ($null -ne $script:Current) {$script:Current.Note=$script:Ui.NoteInput.Text}})
 $script:Ui.PhotoZoom.Add_ValueChanged({$z=$script:Ui.PhotoZoom.Value;$script:Ui.PhotoTransform.ScaleX=$z;$script:Ui.PhotoTransform.ScaleY=$z})
 $script:Ui.PlayButton.Add_Click({Toggle-Play})
 $script:Ui.MarkIn.Add_Click({Mark-Boundary 'In'})
 $script:Ui.MarkOut.Add_Click({Mark-Boundary 'Out'})
 $script:Ui.AddMarker.Add_Click({Add-Marker})
 $script:Ui.BackFrame.Add_Click({Pause-Media;Seek-To ($script:Position-0.04)})
 $script:Ui.NextFrame.Add_Click({Pause-Media;Seek-To ($script:Position+0.04)})
 $script:Ui.SeekSlider.Add_ValueChanged({if (-not $script:Updating) {Seek-To ([double]$script:Ui.SeekSlider.Value)}})
 $script:Ui.VolumeSlider.Add_ValueChanged({$script:Ui.Media.Volume=$script:Ui.VolumeSlider.Value})
 $script:Ui.MuteCheck.Add_Click({$script:Ui.Media.IsMuted=[bool]$script:Ui.MuteCheck.IsChecked})
 $script:Ui.TimeInput.Add_KeyDown({param($sender,$eventArgs);if ($eventArgs.Key -eq 'Return') {try {$t=[TimeSpan]::Parse($sender.Text,[Globalization.CultureInfo]::InvariantCulture);Seek-To $t.TotalSeconds} catch {Set-Status 'Enter time as 00:00:09.300'};$eventArgs.Handled=$true}})
 $script:Ui.ZoomSlider.Add_ValueChanged({
  if ($script:Duration -gt 0) {$span=$script:Duration/[double]$script:Ui.ZoomSlider.Value;$script:ViewStart=$script:Position-$span/2;Draw-Timeline}
 })
 $script:Ui.FitSource.Add_Click({$script:Ui.ZoomSlider.Value=1;$script:ViewStart=0;Draw-Timeline})
 $script:Ui.FitRange.Add_Click({
  if ($script:OutPoint -gt $script:InPoint) {$script:Ui.ZoomSlider.Value=[Math]::Min(8,$script:Duration/($script:OutPoint-$script:InPoint));$script:ViewStart=$script:InPoint;Draw-Timeline}
 })
 $script:Ui.TimelineCanvas.Add_SizeChanged({Draw-Timeline})
 $script:Ui.TimelineCanvas.Add_MouseLeftButtonDown({
  param($sender,$eventArgs)
  if ($script:Duration -gt 0 -and $sender.ActualWidth -gt 0) {$p=$eventArgs.GetPosition($sender);Seek-To ($script:ViewStart+$p.X/$sender.ActualWidth*$script:Duration/[double]$script:Ui.ZoomSlider.Value)}
 })
 $script:Ui.SaveRange.Add_Click({
  if ($null -eq $script:Current -or $script:OutPoint -le $script:InPoint -or $script:Current.Kind -eq 'Photo') {return}
  $name=$script:Ui.RangeName.Text.Trim()
  if (-not $name) {$name="Range $($script:Current.Ranges.Count+1)"}
  $r=[pscustomobject]@{Name=$name;Start=$script:InPoint;End=$script:OutPoint;Label="$name  $(Format-Time $script:InPoint) - $(Format-Time $script:OutPoint)"}
  [void]$script:Current.Ranges.Add($r);$script:Ui.RangeName.Text='';Refresh-Library
  Set-Status 'Range saved as a reference. No new video file was created.'
 })
 $script:Ui.RangeList.Add_SelectionChanged({
  $r=$script:Ui.RangeList.SelectedItem
  if ($null -ne $r) {$script:InPoint=$r.Start;$script:OutPoint=$r.End;Seek-To $r.Start;Draw-Timeline}
 })
 $script:Ui.DeleteRange.Add_Click({$r=$script:Ui.RangeList.SelectedItem;if ($null -ne $r -and $null -ne $script:Current) {[void]$script:Current.Ranges.Remove($r);Refresh-Library}})
 $script:Ui.MarkerList.Add_SelectionChanged({$m=$script:Ui.MarkerList.SelectedItem;if ($null -ne $m) {Seek-To $m.Time}})
 $script:Ui.RelinkButton.Add_Click({
  if ($null -eq $script:Current) {return}
  $dialog=New-Object Microsoft.Win32.OpenFileDialog;$dialog.FileName=$script:Current.Name
  if ($dialog.ShowDialog($script:Window)) {$a=$script:Current;$a.Path=$dialog.FileName;$a.Name=[IO.Path]::GetFileName($dialog.FileName);$script:Current=$null;Select-Asset $a;Refresh-Library}
 })
 $script:Ui.SaveCollection.Add_Click({
  $dialog=New-Object Microsoft.Win32.SaveFileDialog;$dialog.Filter='MyCut review collection|*.mycut-review.json';$dialog.FileName='MyCut.mycut-review.json'
  if ($dialog.ShowDialog($script:Window)) {Save-State $dialog.FileName;Set-Status 'Collection saved.'}
 })
 $script:Ui.OpenCollection.Add_Click({
  $dialog=New-Object Microsoft.Win32.OpenFileDialog;$dialog.Filter='MyCut review collection|*.mycut-review.json;*.json'
  if ($dialog.ShowDialog($script:Window)) {Load-State $dialog.FileName}
 })
 $script:Ui.ViewMode.Add_Click({
  $script:ListMode=-not $script:ListMode
  $orientation=if ($script:ListMode) {'Vertical'} else {'Horizontal'}
  $panelXaml='<ItemsPanelTemplate xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"><StackPanel Orientation="'+$orientation+'"/></ItemsPanelTemplate>'
  $script:Ui.MediaList.ItemsPanel=[Windows.Markup.XamlReader]::Parse($panelXaml)
  $script:Ui.MediaList.SetValue([Windows.Controls.ScrollViewer]::VerticalScrollBarVisibilityProperty,([Windows.Controls.ScrollBarVisibility]::Auto))
  $script:Ui.ViewMode.Content=if ($script:ListMode) {'Card view'} else {'List view'}
 })
 $script:Ui.Media.Add_MediaOpened({
  if ($null -eq $script:Current -or $script:Current.Kind -eq 'Photo') {return}
  $script:Ui.Media.Pause();$script:Loading=$false
  if ($script:Ui.Media.NaturalDuration.HasTimeSpan) {$script:Duration=$script:Ui.Media.NaturalDuration.TimeSpan.TotalSeconds;$script:Current.Duration=$script:Duration}
  $script:OutPoint=$script:Duration
  if ($script:Current.Kind -eq 'Video') {$script:Current.Resolution="$($script:Ui.Media.NaturalVideoWidth) x $($script:Ui.Media.NaturalVideoHeight)"}
  $script:Current.Summary="$($script:Current.Kind) - $(Format-Time $script:Duration)"
  $script:Ui.SeekSlider.Maximum=[Math]::Max(.001,$script:Duration)
  $script:Ui.DurationLabel.Text='/ '+(Format-Time $script:Duration)
  $script:Ui.PlayButton.IsEnabled=$true
  $script:Ui.Media.Volume=$script:Ui.VolumeSlider.Value
  $script:Ui.Media.IsMuted=[bool]$script:Ui.MuteCheck.IsChecked
  Seek-To $script:Current.LastPosition
  Show-Details;Refresh-Library;Set-Status 'Ready. Select a range with I and O.'
 })
 $script:Ui.Media.Add_MediaFailed({
  param($sender,$eventArgs)
  $script:Loading=$false;$script:Playing=$false;$script:Ui.PlayButton.Content='Play';$script:Ui.PlayButton.IsEnabled=$false
  $script:Ui.EmptyView.Visibility='Visible';$script:Ui.EmptyTitle.Text='This media cannot be decoded by Windows';$script:Ui.EmptyDetail.Text=$eventArgs.ErrorException.Message
  Set-Status 'Format support currently depends on the installed Windows codecs.'
 })
 $script:Ui.Media.Add_MediaEnded({
  if ($script:Ui.LoopCheck.IsChecked -and $script:OutPoint -gt $script:InPoint) {Seek-To $script:InPoint;$script:Ui.Media.Play()} else {Pause-Media}
 })
 $script:Timer=New-Object Windows.Threading.DispatcherTimer
 $script:Timer.Interval=[TimeSpan]::FromMilliseconds(50)
 $script:Timer.Add_Tick({
  if ($script:Playing -and $null -ne $script:Current) {
   $script:Position=$script:Ui.Media.Position.TotalSeconds
   if ($script:Ui.LoopCheck.IsChecked -and $script:OutPoint -gt $script:InPoint -and $script:Position -ge $script:OutPoint) {Seek-To $script:InPoint}
   $script:Current.LastPosition=$script:Position
   Update-PositionUi
  }
 })
 $script:Timer.Start()
 $script:Window.Add_PreviewKeyDown({
  param($sender,$eventArgs)
  if ($eventArgs.OriginalSource -is [Windows.Controls.TextBox]) {return}
  switch ($eventArgs.Key.ToString()) {
   'Space' {Toggle-Play;$eventArgs.Handled=$true}
   'I' {Mark-Boundary 'In';$eventArgs.Handled=$true}
   'O' {Mark-Boundary 'Out';$eventArgs.Handled=$true}
   'M' {Add-Marker;$eventArgs.Handled=$true}
   'Left' {Pause-Media;Seek-To ($script:Position-.04);$eventArgs.Handled=$true}
   'Right' {Pause-Media;Seek-To ($script:Position+.04);$eventArgs.Handled=$true}
   'Home' {Seek-To 0;$eventArgs.Handled=$true}
   'End' {Seek-To $script:Duration;$eventArgs.Handled=$true}
  }
 })
 $script:Window.Add_Closed({
  $script:Timer.Stop();Stop-Hover;$script:Ui.Media.Close()
  try {Save-State $script:DefaultState} catch {Set-Content -LiteralPath $LogPath -Value $_.Exception.ToString()}
 })
 $script:Window.Dispatcher.Add_UnhandledException({
  param($sender,$eventArgs)
  $eventArgs.Handled=$true
  try {Add-Content -LiteralPath $LogPath -Value ($eventArgs.Exception.ToString()+[Environment]::NewLine)} catch {}
  Set-Status ('Action failed: '+$eventArgs.Exception.Message)
 })
 $script:Window.Add_ContentRendered({
  if (Test-Path -LiteralPath $script:DefaultState) {
   try {Load-State $script:DefaultState;return} catch {Set-Status 'Saved collection could not be read; loading demo.'}
  }
  $demo=Join-Path $AppRoot 'Demo'
  if (Test-Path -LiteralPath $demo) {Add-Files (@(Get-ChildItem -LiteralPath $demo -File | Sort-Object Name | ForEach-Object {$_.FullName}))}
 })
 [void]$script:Window.ShowDialog()
 exit 0
} catch {
 try {Set-Content -LiteralPath $LogPath -Value $_.Exception.ToString() -Encoding UTF8} catch {}
 try {[void][Windows.MessageBox]::Show("MyCut could not start.$([Environment]::NewLine)$($_.Exception.Message)$([Environment]::NewLine)$([Environment]::NewLine)See mycut-startup.log in the application folder.",'MyCut startup error')} catch {}
 Write-Error $_
 exit 1
}
