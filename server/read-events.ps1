$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

try {
    $events = @(
        Get-WinEvent -FilterHashtable @{
            LogName = "Security"
            Id = 4625
        } -MaxEvents 100 -ErrorAction Stop
    )
}
catch {
    if ($_.FullyQualifiedErrorId -like "NoMatchingEventsFound*") {
        $events = @()
    }
    else {
        [Console]::Error.WriteLine($_.Exception.Message)
        exit 1
    }
}

$result = @(
    foreach ($event in $events) {
        $xml = [xml]$event.ToXml()
        $fields = @{}

        foreach ($item in $xml.Event.EventData.Data) {
            $fields[$item.GetAttribute("Name")] = $item.InnerText
        }

        [PSCustomObject]@{
            id = "WIN-4625-$($event.RecordId)"
            eventId = $event.Id
            recordId = $event.RecordId
            timestamp = $event.TimeCreated.ToUniversalTime().ToString("o")
            computer = $event.MachineName
            username = $fields["TargetUserName"]
            sourceIp = $fields["IpAddress"]
            logonType = $fields["LogonType"]
            processName = $fields["ProcessName"]
            statusCode = $fields["Status"]
            subStatusCode = $fields["SubStatus"]
        }
    }
)

ConvertTo-Json -InputObject $result -Depth 4