[CmdletBinding()]
param(
    [string]$InstallDir = $(if ($env:VALHEIM_SERVER_PATH) { $env:VALHEIM_SERVER_PATH } else { 'E:\valheim-server' }),
    [string]$SteamCmdDir = (Join-Path $env:LOCALAPPDATA 'SteamCMD'),
    [int]$MaxAttempts = 4
)

$ErrorActionPreference = 'Stop'
$appId = 896660
$steamCmdExe = Join-Path $SteamCmdDir 'steamcmd.exe'
$serverExe = Join-Path $InstallDir 'valheim_server.exe'
$assemblyPath = Join-Path $InstallDir 'valheim_server_Data\Managed\assembly_valheim.dll'

function Get-ValheimVersion {
    param([string]$AssemblyPath)
    $sizes = @{}
    foreach ($field in [System.Reflection.Emit.OpCodes].GetFields([System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::Static)) {
        $op = $field.GetValue($null)
        $size = switch ($op.OperandType.ToString()) {
            'InlineNone' { 0 }
            'ShortInlineBrTarget' { 1 }
            'ShortInlineI' { 1 }
            'ShortInlineVar' { 1 }
            'InlineVar' { 2 }
            'InlineI8' { 8 }
            'InlineR' { 8 }
            'ShortInlineR' { 4 }
            'InlineSwitch' { -1 }
            default { 4 }
        }
        $sizes[([int]$op.Value) -band 0xFFFF] = $size
    }
    $stream = [System.IO.File]::OpenRead($AssemblyPath)
    try {
        $pe = [System.Reflection.PortableExecutable.PEReader]::new($stream)
        $md = [System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
        $game = $null
        $network = $null
        foreach ($th in $md.TypeDefinitions) {
            $td = $md.GetTypeDefinition($th)
            if ($md.GetString($td.Name) -ne 'Version' -or $md.GetString($td.Namespace) -ne '') { continue }
            foreach ($fh in $td.GetFields()) {
                $fd = $md.GetFieldDefinition($fh)
                if ($md.GetString($fd.Name) -eq 'c_networkVersion') {
                    $constant = $md.GetConstant($fd.GetDefaultValue())
                    $network = $md.GetBlobReader($constant.Value).ReadUInt32()
                }
            }
            foreach ($mh in $td.GetMethods()) {
                $m = $md.GetMethodDefinition($mh)
                if ($md.GetString($m.Name) -ne '.cctor') { continue }
                $il = [System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe, $m.RelativeVirtualAddress).GetILBytes()
                $ints = New-Object System.Collections.Generic.List[int]
                $candidate = $null
                $i = 0
                while ($i -lt $il.Length -and -not $game) {
                    $b = [int]$il[$i]
                    $key = $b
                    $operandStart = $i + 1
                    if ($b -eq 0xFE) { $key = 0xFE00 -bor [int]$il[$i + 1]; $operandStart = $i + 2 }
                    $size = $sizes[$key]
                    if ($null -eq $size) { throw "Unknown IL opcode $key at offset $i" }
                    if ($b -ge 0x16 -and $b -le 0x1E) { $ints.Add($b - 0x16) }
                    elseif ($b -eq 0x15) { $ints.Add(-1) }
                    elseif ($b -eq 0x1F) { $ints.Add([int][sbyte]$il[$operandStart]) }
                    elseif ($b -eq 0x20) { $ints.Add([System.BitConverter]::ToInt32($il, $operandStart)) }
                    elseif ($b -eq 0x73 -or $b -eq 0x80) {
                        $token = [System.BitConverter]::ToInt32($il, $operandStart)
                        $row = $token -band 0xFFFFFF
                        $table = ($token -shr 24) -band 0xFF
                        if ($b -eq 0x73 -and $table -eq 0x06) {
                            $ctor = $md.GetMethodDefinition([System.Reflection.Metadata.Ecma335.MetadataTokens]::MethodDefinitionHandle($row))
                            $owner = $md.GetTypeDefinition($ctor.GetDeclaringType())
                            if ($md.GetString($owner.Name) -eq 'GameVersion' -and $ints.Count -ge 3) {
                                $candidate = @($ints[$ints.Count - 3], $ints[$ints.Count - 2], $ints[$ints.Count - 1])
                            }
                        }
                        if ($b -eq 0x80 -and $table -eq 0x04) {
                            $fd = $md.GetFieldDefinition([System.Reflection.Metadata.Ecma335.MetadataTokens]::FieldDefinitionHandle($row))
                            if ($md.GetString($fd.Name) -eq '<CurrentVersion>k__BackingField' -and $candidate) {
                                $game = ($candidate -join '.')
                            }
                        }
                    }
                    if ($size -eq -1) {
                        $n = [System.BitConverter]::ToInt32($il, $operandStart)
                        $i = $operandStart + 4 + 4 * $n
                    } else {
                        $i = $operandStart + $size
                    }
                }
            }
        }
        return [pscustomobject]@{ Game = $game; Network = $network }
    } finally {
        $stream.Dispose()
    }
}

if (-not (Test-Path $steamCmdExe)) {
    Write-Host "Downloading SteamCMD into $SteamCmdDir"
    New-Item -ItemType Directory -Force -Path $SteamCmdDir | Out-Null
    $zip = Join-Path $SteamCmdDir 'steamcmd.zip'
    Invoke-WebRequest -Uri 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip' -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $SteamCmdDir -Force
    Remove-Item $zip
}

$attempt = 0
$exitCode = -1
do {
    $attempt++
    Write-Host "SteamCMD attempt $attempt of ${MaxAttempts}: app $appId into $InstallDir"
    & $steamCmdExe +force_install_dir $InstallDir +login anonymous +app_update $appId validate +quit
    $exitCode = $LASTEXITCODE
    Write-Host "SteamCMD exited with code $exitCode"
} while (($exitCode -ne 0 -or -not (Test-Path $serverExe)) -and $attempt -lt $MaxAttempts)

if (-not (Test-Path $serverExe)) {
    throw "SteamCMD did not produce $serverExe after $attempt attempts (last exit code $exitCode)"
}
if (-not (Test-Path $assemblyPath)) {
    throw "Expected $assemblyPath after the download"
}

$version = Get-ValheimVersion -AssemblyPath $assemblyPath
Write-Host "Valheim dedicated server $($version.Game) (network version $($version.Network)) installed in $InstallDir"
