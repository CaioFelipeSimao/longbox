Add-Type -AssemblyName System.Drawing
$dir = $args[0]
$ids = Get-Content $args[1]
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L
$rnd = New-Object System.Random 7
foreach ($id in $ids) {
  $bmp = New-Object System.Drawing.Bitmap 968, 1500
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb($rnd.Next(256),$rnd.Next(256),$rnd.Next(256)))
  for ($k = 0; $k -lt 400; $k++) {
    $b = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($rnd.Next(80,255),$rnd.Next(256),$rnd.Next(256),$rnd.Next(256)))
    $g.FillEllipse($b, $rnd.Next(-100,968), $rnd.Next(-100,1500), $rnd.Next(10,300), $rnd.Next(10,300))
    $b.Dispose()
  }
  $g.Dispose()
  $bmp.Save((Join-Path $dir $id), $codec, $ep)
  $bmp.Dispose()
}
