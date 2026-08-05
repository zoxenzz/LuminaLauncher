Add-Type -AssemblyName System.Drawing

$path = Join-Path $env:TEMP 'lumina-window.png'
if (-not (Test-Path $path)) { Write-Output 'NO_IMAGE'; exit 1 }
$bmp = New-Object System.Drawing.Bitmap($path)
$w = $bmp.Width; $h = $bmp.Height
Write-Output ("SIZE: " + $w + "x" + $h)

$cols = 48
$rows = 26
$cellW = [int]($w / $cols)
$cellH = [int]($h / $rows)

for ($cy = 0; $cy -lt $rows; $cy++) {
  $line = ''
  for ($cx = 0; $cx -lt $cols; $cx++) {
    $sum = 0; $n = 0
    $x0 = $cx * $cellW; $y0 = $cy * $cellH
    for ($y = $y0; $y -lt $y0 + $cellH; $y += 4) {
      for ($x = $x0; $x -lt $x0 + $cellW; $x += 4) {
        $c = $bmp.GetPixel([Math]::Min($x, $w - 1), [Math]::Min($y, $h - 1))
        $sum += ($c.R + $c.G + $c.B) / 3
        $n++
      }
    }
    $avg = $sum / $n
    if ($avg -lt 25) { $line += ' ' }
    elseif ($avg -lt 55) { $line += '.' }
    elseif ($avg -lt 95) { $line += ':' }
    elseif ($avg -lt 140) { $line += '+' }
    elseif ($avg -lt 190) { $line += '#' }
    else { $line += '@' }
  }
  Write-Output $line
}

# Also print a few targeted stats: brightest pixel location (logo?) and any bright pixels in center region
$maxLum = 0; $maxX = 0; $maxY = 0
$centerBright = 0; $centerTotal = 0
for ($y = 0; $y -lt $h; $y += 4) {
  for ($x = 0; $x -lt $w; $x += 4) {
    $c = $bmp.GetPixel($x, $y)
    $lum = ($c.R + $c.G + $c.B) / 3
    if ($lum -gt $maxLum) { $maxLum = $lum; $maxX = $x; $maxY = $y }
    if ($x -gt [int]($w*0.25) -and $x -lt [int]($w*0.75) -and $y -gt [int]($h*0.25) -and $y -lt [int]($h*0.75)) {
      $centerBright += $lum
      $centerTotal++
    }
  }
}
Write-Output ("MAX_LUM: " + [int]$maxLum + " at " + $maxX + "," + $maxY)
Write-Output ("CENTER_AVG: " + [int]($centerBright / $centerTotal))
$bmp.Dispose()
