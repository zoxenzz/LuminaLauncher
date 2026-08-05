Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Cap {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

function Analyze-Bitmap($bmp) {
  $w = $bmp.Width; $h = $bmp.Height
  $total = 0; $rSum = 0; $gSum = 0; $bSum = 0
  $blackPx = 0; $lightPx = 0; $nonUniform = 0
  $prev = -1
  for ($y = 0; $y -lt $h; $y += 8) {
    for ($x = 0; $x -lt $w; $x += 8) {
      $c = $bmp.GetPixel($x, $y)
      $total++
      $rSum += $c.R; $gSum += $c.G; $bSum += $c.B
      if ($c.R -lt 12 -and $c.G -lt 12 -and $c.B -lt 12) { $blackPx++ }
      if ($c.R -gt 140 -and $c.G -gt 140 -and $c.B -gt 140) { $lightPx++ }
      $lum = ($c.R + $c.G + $c.B) / 3
      if ($prev -ge 0 -and [Math]::Abs($lum - $prev) -gt 30) { $nonUniform++ }
      $prev = $lum
    }
  }
  return @{
    samples = $total
    avgR = [int]($rSum / $total); avgG = [int]($gSum / $total); avgB = [int]($bSum / $total)
    blackPct = [int](100 * $blackPx / $total)
    lightPct = [int](100 * $lightPx / $total)
    nonUniformPct = [int](100 * $nonUniform / $total)
  }
}

$proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*Lumina*' } | Select-Object -First 1
if (-not $proc) {
  Write-Output 'NO_LUMINA_WINDOW_FOUND'
  exit 1
}
$hWnd = $proc.MainWindowHandle
Write-Output ("WINDOW_TITLE: " + $proc.MainWindowTitle)
Write-Output ("PID: " + $proc.Id)
Write-Output ("VISIBLE: " + [Win32Cap]::IsWindowVisible($hWnd))
$rect = New-Object Win32Cap+RECT
[Win32Cap]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
Write-Output ("RECT: " + $rect.Left + "," + $rect.Top + " " + $w + "x" + $h)
if ($w -le 0 -or $h -le 0) { Write-Output 'INVALID_RECT'; exit 1 }

# Window region capture
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
$out = Join-Path $env:TEMP 'lumina-window.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$stats = Analyze-Bitmap $bmp
Write-Output ("WIN_AVG_RGB: " + $stats.avgR + "," + $stats.avgG + "," + $stats.avgB)
Write-Output ("WIN_BLACK_PCT: " + $stats.blackPct)
Write-Output ("WIN_LIGHT_PCT: " + $stats.lightPct)
Write-Output ("WIN_NON_UNIFORM_PCT: " + $stats.nonUniformPct)
$g.Dispose(); $bmp.Dispose()

# Full screen capture
$sw = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Add-Type -AssemblyName System.Windows.Forms | Out-Null
$bmp2 = New-Object System.Drawing.Bitmap($sw.Width, $sw.Height)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.CopyFromScreen(0, 0, 0, 0, $bmp2.Size)
$out2 = Join-Path $env:TEMP 'lumina-screen.png'
$bmp2.Save($out2, [System.Drawing.Imaging.ImageFormat]::Png)
$stats2 = Analyze-Bitmap $bmp2
Write-Output ("SCRN_AVG_RGB: " + $stats2.avgR + "," + $stats2.avgG + "," + $stats2.avgB)
Write-Output ("SCRN_BLACK_PCT: " + $stats2.blackPct)
Write-Output ("SCRN_LIGHT_PCT: " + $stats2.lightPct)
Write-Output ("SCRN_NON_UNIFORM_PCT: " + $stats2.nonUniformPct)
Write-Output ("SAVED_WIN: " + $out)
Write-Output ("SAVED_SCRN: " + $out2)
$g2.Dispose(); $bmp2.Dispose()
