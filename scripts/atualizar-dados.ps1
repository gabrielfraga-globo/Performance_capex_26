<#
.SYNOPSIS
  Atualiza os dados do painel direto do Power BI Desktop aberto.

.DESCRIPTION
  1. Encontra o modelo "[SM] Acompanhamento Mensal Caixa" aberto no Power BI Desktop
     (porta local do Analysis Services).
  2. Roda cada consulta public\data\*.dax e grava o CSV ao lado (mesmo formato do
     DAX Query View: separador ";", decimal ",").
  3. Grava public\data\_extracao.json com a data da extração (vira a data de referência do painel).
  4. Confere se as consultas abertas fecham com a consulta agregada (R26, medidas do BI); se não fecharem, para.
  5. Opcional: -Build roda "npm run build"; -Publicar faz commit + push (deploy no Vercel via Git)
     ou "vercel --prod" se -VercelCli for informado.

.EXAMPLE
  .\scripts\atualizar-dados.ps1
  .\scripts\atualizar-dados.ps1 -Build
  .\scripts\atualizar-dados.ps1 -Build -Publicar
  .\scripts\atualizar-dados.ps1 -Porta 52341          # se houver mais de um Desktop aberto
#>
param(
  [int]$Porta = 0,
  [switch]$Build,
  [switch]$Publicar,
  [switch]$VercelCli,
  [string]$TabelaAssinatura = "ListaRCsConsolidada",
  [string[]]$Opcionais = @("D01_responsaveis")
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $raiz "public\data"
$ptBR = [System.Globalization.CultureInfo]::GetCultureInfo("pt-BR")

# ---------------------------------------------------------------- ADOMD
$candidatos = @(
  "$env:ProgramFiles\Microsoft Power BI Desktop\bin\Microsoft.PowerBI.AdomdClient.dll",
  "${env:ProgramFiles(x86)}\Microsoft Power BI Desktop\bin\Microsoft.PowerBI.AdomdClient.dll",
  "$env:ProgramFiles\DAX Studio\bin\Microsoft.AnalysisServices.AdomdClient.dll",
  "$env:ProgramFiles\DAX Studio\Microsoft.AnalysisServices.AdomdClient.dll",
  "$env:ProgramFiles\Tabular Editor 3\Microsoft.AnalysisServices.AdomdClient.dll",
  "${env:ProgramFiles(x86)}\Tabular Editor\Microsoft.AnalysisServices.AdomdClient.dll",
  "$env:ProgramFiles\Tabular Editor\Microsoft.AnalysisServices.AdomdClient.dll"
)
$dll = $candidatos | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $dll) {
  $dll = Get-ChildItem -Path "$env:ProgramFiles", "${env:ProgramFiles(x86)}" -Recurse -Filter "*AdomdClient.dll" -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $dll) {
  throw "Não encontrei a biblioteca ADOMD (vem com o Power BI Desktop instalado por .exe, DAX Studio ou Tabular Editor). Alternativa: rode os .dax no DAX Query View e salve os CSVs em public\data."
}
Add-Type -Path $dll
$ns = if ($dll -like "*PowerBI.AdomdClient*") { "Microsoft.AnalysisServices.AdomdClient" } else { "Microsoft.AnalysisServices.AdomdClient" }
Write-Host "ADOMD: $dll"

# ---------------------------------------------------------------- porta do Desktop
function Get-Portas {
  $pastas = @(
    "$env:LOCALAPPDATA\Microsoft\Power BI Desktop\AnalysisServicesWorkspaces",
    "$env:USERPROFILE\Microsoft\Power BI Desktop Store App\AnalysisServicesWorkspaces"
  )
  foreach ($p in $pastas) {
    if (-not (Test-Path $p)) { continue }
    Get-ChildItem $p -Directory | ForEach-Object {
      $f = Join-Path $_.FullName "Data\msmdsrv.port.txt"
      if (Test-Path $f) { [int](([System.IO.File]::ReadAllText($f, [System.Text.Encoding]::Unicode)).Trim()) }
    }
  }
}

function Open-Conexao([int]$p) {
  $c = New-Object "$ns.AdomdConnection" "Data Source=localhost:$p"
  $c.Open()
  return $c
}

$conn = $null
$portas = if ($Porta -gt 0) { @($Porta) } else { @(Get-Portas) }
if (-not $portas) { throw "Nenhum Power BI Desktop aberto. Abra o PBIP do Acompanhamento Mensal Caixa e rode de novo." }
foreach ($p in $portas) {
  try {
    $c = Open-Conexao $p
    $cmd = $c.CreateCommand()
    $cmd.CommandText = "EVALUATE ROW(""n"", COUNTROWS('$TabelaAssinatura'))"
    [void]$cmd.ExecuteScalar()
    $conn = $c
    Write-Host "Modelo encontrado na porta $p"
    break
  } catch {
    if ($c) { $c.Close() }
  }
}
if (-not $conn) { throw "Nenhum Desktop aberto tem a tabela '$TabelaAssinatura'. Informe -Porta." }

# ---------------------------------------------------------------- CSV no formato do DAX Query View
function Format-Valor($v) {
  if ($null -eq $v -or $v -is [System.DBNull]) { return "" }
  switch ($v.GetType().FullName) {
    "System.String"   { return '"' + $v.Replace('"', '""') + '"' }
    "System.Boolean"  { if ($v) { return "True" } else { return "False" } }
    "System.DateTime" { return $v.ToString("yyyy-MM-dd HH:mm:ss,fff") }
    "System.Double"   { return $v.ToString("R", $ptBR) }
    "System.Decimal"  { return $v.ToString($ptBR) }
    default           { return [string]::Format($ptBR, "{0}", $v) }
  }
}

$arquivos = Get-ChildItem $dataDir -Filter "*.dax" | Sort-Object Name
$resumo = @()
foreach ($a in $arquivos) {
  $nome = [System.IO.Path]::GetFileNameWithoutExtension($a.Name)
  $dax = Get-Content $a.FullName -Raw -Encoding UTF8
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $dax
    $cmd.CommandTimeout = 600
    $r = $cmd.ExecuteReader()
    $sb = New-Object System.Text.StringBuilder
    $cols = @(); for ($i = 0; $i -lt $r.FieldCount; $i++) { $cols += $r.GetName($i) }
    [void]$sb.AppendLine(($cols | ForEach-Object { $_ }) -join ";")
    $linhas = 0
    while ($r.Read()) {
      $vals = @(); for ($i = 0; $i -lt $r.FieldCount; $i++) { $vals += (Format-Valor $r.GetValue($i)) }
      [void]$sb.AppendLine($vals -join ";")
      $linhas++
    }
    $r.Close()
    $csv = Join-Path $dataDir "$nome.csv"
    [System.IO.File]::WriteAllText($csv, $sb.ToString(), (New-Object System.Text.UTF8Encoding($true)))
    Write-Host ("  {0,-32} {1,6} linhas  {2,5:N1}s" -f $nome, $linhas, $sw.Elapsed.TotalSeconds)
    $resumo += @{ consulta = $nome; linhas = $linhas }
  } catch {
    Write-Warning "  $nome falhou: $($_.Exception.Message)"
    $resumo += @{ consulta = $nome; erro = $_.Exception.Message }
  }
}
$conn.Close()

$ext = @{
  data       = (Get-Date).ToString("yyyy-MM-dd")
  extraidoEm = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
  origem     = "Power BI Desktop (porta local) via scripts/atualizar-dados.ps1"
  consultas  = $resumo
}
$ext | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $dataDir "_extracao.json") -Encoding UTF8
Write-Host "Extração concluída: $($ext.extraidoEm)"

$falhas = $resumo | Where-Object { $_.erro -and ($Opcionais -notcontains $_.consulta) }
if ($falhas) { throw "Algumas consultas falharam; o painel não foi gerado. Corrija e rode de novo." }

Push-Location $raiz
try {
  # Modo estrito: se D02/D05a não fecharem com a R26 (medidas do BI), nada é gerado nem publicado.
  $env:BGR_ESTRITO = "1"
  npm run data
  if ($LASTEXITCODE -eq 2) { throw "Conferência com o modelo falhou (D02/D05a não fecham com a R26). Nada foi publicado. Veja o detalhe acima." }
  if ($LASTEXITCODE -ne 0) { throw "Falha ao gerar bundle.json" }
  if ($Build -or $Publicar) {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Falha no build" }
  }
  if ($Publicar) {
    if ($VercelCli) {
      vercel --prod
    } else {
      git add public/data
      git commit -m "dados: extração $($ext.extraidoEm)"
      git push
    }
  }
} finally { Pop-Location }
