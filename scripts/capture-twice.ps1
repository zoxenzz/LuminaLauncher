Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Cap2 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

function Capture($path) {
  $proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*Lumina*' } | Select-Object -First 1
  if (-not $proc) { Write-Output 'NO_WINDOW'; return $null }
  $hWnd = $proc.MainWindowHandle
  [Win32Cap2]::SetForegroundWindow($hWnd) | Out-Null
  Start-Sleep -Milliseconds 400
  $rect = New-Object Win32Cap2+RECT
  [Win32Cap2]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
  $w = $rect.Right - $rect.Left; $h = $rect.Bottom - $rect.Top
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  return $bmp
}

function Show-Map($bmp) {
  $w = $bmp.Width; $h = $bmp.Height
  $cols = 56; $rows = 24
  $cellW = [int]($w / $cols); $cellH = [int]($h / $rows)
  for ($cy = 0; $cy -lt $rows; $cy++) {
    $line = ''
    for ($cx = 0; $cx -lt $cols; $cx++) {
      $sum = 0; $n = 0
      for ($y = $cy * $cellH; $y -lt ($cy + 1) * $cellH; $y += 4) {
        for ($x = $cx * $cellW; $x -lt ($cx + 1) * $cellW; $x += 4) {
          if ($x -ge $w -or $y -ge $h) { continue }
          $c = $bmp.GetPixel($x, $y)
          $sum += ($c.R + $c.G + $c.B) / 3; $n++
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

$bmp1 = Capture (Join-Path $env:TEMP 'cap1.png')
if ($bmp1) {
  Write-Output '===== CAPTURE 1 ====='
  Show-Map $bmp1
  $bmp1.Dispose()
}
Start-Sleep -Seconds 6
$bmp2 = Capture (Join-Path $env:TEMP 'cap2.png')
if ($bmp2) {
  Write-Output '===== CAPTURE 2 (6s later) ====='
  Show-Map $bmp2
  $bmp2.Dispose()
}
