Param(
    [int]$DurationSeconds = 300,
    [int]$SampleEverySeconds = 2,
    [string]$ProcessName = "node",
    [string]$OutCsv = "results/perf/node_memory_samples.csv"
)

$ErrorActionPreference = "Stop"

$dir = Split-Path -Parent $OutCsv
if ($dir -and -not (Test-Path $dir)) {
    New-Item -Path $dir -ItemType Directory -Force | Out-Null
}

$samples = @()
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "Sampling process '$ProcessName' for $DurationSeconds seconds..."

while ($stopwatch.Elapsed.TotalSeconds -lt $DurationSeconds) {
    $procs = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue

    if ($null -eq $procs) {
        $samples += [PSCustomObject]@{
            timestamp_utc = (Get-Date).ToUniversalTime().ToString("o")
            process = $ProcessName
            pid = ""
            working_set_mb = ""
            private_memory_mb = ""
            note = "process_not_found"
        }
    }
    else {
        foreach ($p in $procs) {
            $samples += [PSCustomObject]@{
                timestamp_utc = (Get-Date).ToUniversalTime().ToString("o")
                process = $p.ProcessName
                pid = $p.Id
                working_set_mb = [math]::Round($p.WorkingSet64 / 1MB, 2)
                private_memory_mb = [math]::Round($p.PrivateMemorySize64 / 1MB, 2)
                note = ""
            }
        }
    }

    Start-Sleep -Seconds $SampleEverySeconds
}

$samples | Export-Csv -Path $OutCsv -NoTypeInformation -Encoding UTF8

$valid = $samples | Where-Object { $_.private_memory_mb -ne "" }
if ($valid.Count -gt 0) {
    $avg = ($valid | Measure-Object -Property private_memory_mb -Average).Average
    $max = ($valid | Measure-Object -Property private_memory_mb -Maximum).Maximum
    $min = ($valid | Measure-Object -Property private_memory_mb -Minimum).Minimum

    Write-Host "\n=== Node Memory Summary (Private MB) ==="
    Write-Host ("Average: {0:N2} MB" -f $avg)
    Write-Host ("Min:     {0:N2} MB" -f $min)
    Write-Host ("Max:     {0:N2} MB" -f $max)
}
else {
    Write-Warning "No valid process samples were collected."
}

Write-Host "CSV saved to: $OutCsv"
