Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path){
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # background: purple -> pink diagonal gradient circle, matching the app's
  # storm-gradient identity
  $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $c1 = [System.Drawing.Color]::FromArgb(255, 124, 58, 237)   # #7c3aed
  $c2 = [System.Drawing.Color]::FromArgb(255, 236, 72, 153)   # #ec4899
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
  $g.FillEllipse($brush, 0, 0, $size, $size)

  # lightning bolt, white, drawn as a polygon scaled to the icon size
  $pts = @(
    [System.Drawing.PointF]::new($size*0.56, $size*0.10),
    [System.Drawing.PointF]::new($size*0.24, $size*0.58),
    [System.Drawing.PointF]::new($size*0.46, $size*0.58),
    [System.Drawing.PointF]::new($size*0.40, $size*0.92),
    [System.Drawing.PointF]::new($size*0.78, $size*0.40),
    [System.Drawing.PointF]::new($size*0.54, $size*0.40)
  )
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillPolygon($white, $pts)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 16  "$PSScriptRoot\icons\icon16.png"
New-Icon 48  "$PSScriptRoot\icons\icon48.png"
New-Icon 128 "$PSScriptRoot\icons\icon128.png"
Write-Output "icons generated"
