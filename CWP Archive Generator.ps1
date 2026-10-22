param(
    [Parameter(Mandatory=$true)]
    [string]$SourceFolder,

    [Parameter(Mandatory=$true)]
    [string]$OutputCwp
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Resolve-ExistingFolderFromCurrentDirectory {
    param([string]$PathValue)

    $resolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PathValue)

    if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
        throw "SourceFolder does not exist or is not a directory: $PathValue"
    }

    return $resolved
}

function Resolve-OutputFileFromCurrentDirectory {
    param([string]$PathValue)

    # Resolve relative paths against the current PowerShell directory ($PWD),
    # avoiding unintended resolution against C:\Windows\System32.
    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    $combined = Join-Path -Path $PWD.Path -ChildPath $PathValue
    return [System.IO.Path]::GetFullPath($combined)
}

function Get-RelativePathCompat {
    param(
        [Parameter(Mandatory=$true)][string]$BasePath,
        [Parameter(Mandatory=$true)][string]$FullPath
    )

    $base = [System.IO.Path]::GetFullPath($BasePath)
    $full = [System.IO.Path]::GetFullPath($FullPath)

    if (-not $base.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $base += [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = New-Object System.Uri($base)
    $fileUri = New-Object System.Uri($full)
    $relativeUri = $baseUri.MakeRelativeUri($fileUri)

    $relative = [System.Uri]::UnescapeDataString($relativeUri.ToString())
    return $relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Is-TextFile {
    param([string]$FilePath)

    $ext = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()

    $textExts = @(
        ".js", ".json", ".wjson", ".html", ".htm", ".css", ".txt",
        ".xml", ".svg", ".md", ".map", ".ts", ".tsx", ".jsx"
    )

    return $textExts -contains $ext
}

function Normalize-TextBytesUtf8NoBomLf {
    param([byte[]]$Bytes)

    if ($Bytes.Length -eq 0) {
        return $Bytes
    }

    # Remove the UTF-8 BOM when present.
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
        if ($Bytes.Length -eq 3) {
            $Bytes = New-Object byte[] 0
        }
        else {
            $Bytes = $Bytes[3..($Bytes.Length - 1)]
        }
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false, $true)

    try {
        $text = $utf8NoBom.GetString($Bytes)
    }
    catch {
        throw "The text file is not valid UTF-8. Fix its encoding before building the CWP."
    }

    # Normalize line endings to LF.
    $text = $text -replace "`r`n", "`n"
    $text = $text -replace "`r", "`n"

    return $utf8NoBom.GetBytes($text)
}

$src = Resolve-ExistingFolderFromCurrentDirectory $SourceFolder
$outFull = Resolve-OutputFileFromCurrentDirectory $OutputCwp
$outDir = [System.IO.Path]::GetDirectoryName($outFull)

if ($outDir -and -not (Test-Path -LiteralPath $outDir -PathType Container)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

if (Test-Path -LiteralPath $outFull) {
    Remove-Item -LiteralPath $outFull -Force
}

Write-Host "PWD       : $($PWD.Path)"
Write-Host "Source    : $src"
Write-Host "OutputCwp : $outFull"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$rootName = Split-Path -Leaf $src

$fileStream = New-Object System.IO.FileStream(
    $outFull,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
)

try {
    $zip = New-Object System.IO.Compression.ZipArchive(
        $fileStream,
        [System.IO.Compression.ZipArchiveMode]::Create,
        $false
    )

    try {
        # Files only; no explicit directory entries.
        $files = Get-ChildItem -LiteralPath $src -Recurse -File | Sort-Object FullName

        foreach ($file in $files) {
            $relative = Get-RelativePathCompat -BasePath $src -FullPath $file.FullName

            # Internal paths use backslashes and include the root directory.
            $zipEntryName = $rootName + "\" + ($relative -replace "/", "\")

            $entry = $zip.CreateEntry($zipEntryName, [System.IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = [DateTimeOffset]::new($file.LastWriteTime)

            $bytes = [System.IO.File]::ReadAllBytes($file.FullName)

            if (Is-TextFile $file.FullName) {
                $bytes = Normalize-TextBytesUtf8NoBomLf $bytes
            }

            $entryStream = $entry.Open()
            try {
                $entryStream.Write($bytes, 0, $bytes.Length)
            }
            finally {
                $entryStream.Dispose()
            }
        }
    }
    finally {
        $zip.Dispose()
    }
}
finally {
    $fileStream.Dispose()
}

Write-Host "CWP generated successfully: $outFull"
