Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path, [double]$scale){
  if(-not $scale){ $scale = 1.0 }
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded-square tile in the same teal accent used by the sibling BYD app
  # (Stormbull), not a gradient circle - one fixed brand color, no theme
  # dependency, since a static PNG can't react to light/dark mode. $scale < 1
  # shrinks the tile with transparent padding for maskable icons, so
  # Android's circular crop doesn't clip the bolt.
  $d = $size * $scale
  $off = ($size - $d) / 2
  $radius = $d * 0.23

  $tile = New-Object System.Drawing.Color
  $tile = [System.Drawing.Color]::FromArgb(255, 51, 224, 194)   # #33e0c2
  $tileBrush = New-Object System.Drawing.SolidBrush($tile)

  $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r2 = $radius * 2
  $path2.AddArc($off, $off, $r2, $r2, 180, 90)
  $path2.AddArc($off + $d - $r2, $off, $r2, $r2, 270, 90)
  $path2.AddArc($off + $d - $r2, $off + $d - $r2, $r2, $r2, 0, 90)
  $path2.AddArc($off, $off + $d - $r2, $r2, $r2, 90, 90)
  $path2.CloseFigure()
  $g.FillPath($tileBrush, $path2)

  # bolt cutout, dark teal ink (#022420) - same polygon proportions as the
  # header SVG mark, so the favicon/app icon matches what's in the page
  $pts = @(
    [System.Drawing.PointF]::new($off + $d*0.567, $off + $d*0.20),
    [System.Drawing.PointF]::new($off + $d*0.30,  $off + $d*0.533),
    [System.Drawing.PointF]::new($off + $d*0.467, $off + $d*0.533),
    [System.Drawing.PointF]::new($off + $d*0.40,  $off + $d*0.833),
    [System.Drawing.PointF]::new($off + $d*0.70,  $off + $d*0.467),
    [System.Drawing.PointF]::new($off + $d*0.533, $off + $d*0.467)
  )
  $inkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 2, 36, 32))  # #022420
  $g.FillPolygon($inkBrush, $pts)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 16  "$PSScriptRoot\icons\icon16.png"
New-Icon 48  "$PSScriptRoot\icons\icon48.png"
New-Icon 128 "$PSScriptRoot\icons\icon128.png"
New-Icon 192 "$PSScriptRoot\icons\icon-192.png"
New-Icon 512 "$PSScriptRoot\icons\icon-512.png"
New-Icon 512 "$PSScriptRoot\icons\icon-512-maskable.png" 0.72
Write-Output "icons generated"
