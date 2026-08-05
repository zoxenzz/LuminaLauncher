Add-Type -AssemblyName System.Drawing

function Show-Region($bmp, $x0, $y0, $x1, $y1, $cols) {
  $w = $x1 - $x0; $h = $y1 - $y0
  $rows = [int]($cols * $h / $w)
  $cellW = [int]($w / $cols); $cellH = [int]($h / $rows)
  Write-Output ("--- REGION " + $x0 + "," + $y0 + " " + $w + "x" + $h + " ---")
  for ($cy = 0; $cy -lt $rows; $cy++) {
    $line = ''
    for ($cx = 0; $cx -lt $cols; $cx++) {
      $sum = 0; $n = 0
      for ($y = $y0 + $cy * $cellH; $y -lt $y0 + ($cy + 1) * $cellH; $y += 2) {
        for ($x = $x0 + $cx * $cellW; $x -lt $x0 + ($cx + 1) * $cellW; $x += 2) {
          if ($x -ge $bmp.Width -or $y -ge $bmp.Height) { continue }
          $c = $bmp.GetPixel($x, $y)
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
}

$path = Join-Path $env:TEMP 'lumina-window.png'
$bmp = New-Object System.Drawing.Bitmap($path)
Show-Region $bmp 250 60 700 260 60
Show-Region $bmp 1500 60 1936 260 60
Show-Region $bmp 650 300 1300 750 60
$bmp.Dispose()
