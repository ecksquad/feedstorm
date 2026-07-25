Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path, [double]$scale){
  if(-not $scale){ $scale = 1.0 }
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # background: purple -> pink diagonal gradient circle, matching the app's
  # storm-gradient identity. $scale < 1 shrinks the circle with transparent
  # padding around it - needed for maskable icons so Android's circular crop
  # doesn't clip the bolt.
  $d = $size * $scale
  $off = ($size - $d) / 2
  $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $c1 = [System.Drawing.Color]::FromArgb(255, 124, 58, 237)   # #7c3aed
  $c2 = [System.Drawing.Color]::FromArgb(255, 236, 72, 153)   # #ec4899
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
  $g.FillEllipse($brush, $off, $off, $d, $d)

  # lightning bolt, white, drawn as a polygon scaled to the icon size
  $pts = @(
    [System.Drawing.PointF]::new($off + $d*0.56, $off + $d*0.10),
    [System.Drawing.PointF]::new($off + $d*0.24, $off + $d*0.58),
    [System.Drawing.PointF]::new($off + $d*0.46, $off + $d*0.58),
    [System.Drawing.PointF]::new($off + $d*0.40, $off + $d*0.92),
    [System.Drawing.PointF]::new($off + $d*0.78, $off + $d*0.40),
    [System.Drawing.PointF]::new($off + $d*0.54, $off + $d*0.40)
  )
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillPolygon($white, $pts)

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
