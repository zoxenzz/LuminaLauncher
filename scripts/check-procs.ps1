Get-Process | Where-Object { $_.ProcessName -match 'Lumina|theseus|vite|node|electron' } | Select-Object Id,ProcessName,StartTime | Format-Table -AutoSize
Write-Output '---PORTS---'
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 1420,1430 } | Select-Object LocalPort,OwningProcess | Format-Table -AutoSize
