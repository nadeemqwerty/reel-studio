param([Parameter(Mandatory=$true)][string]$JobFile)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
public class ReelWord {
    public string text;
    public double start;
    public int position;
}
public static class ReelNarrator {
    public static ReelWord[] Render(string text, string filename, string voice, int rate) {
        var words = new List<ReelWord>();
        using (var speaker = new SpeechSynthesizer()) {
            if (!String.IsNullOrEmpty(voice)) speaker.SelectVoice(voice);
            speaker.Rate = rate;
            speaker.SpeakProgress += (sender, args) => {
                words.Add(new ReelWord {
                    text = args.Text, start = args.AudioPosition.TotalSeconds,
                    position = args.CharacterPosition
                });
            };
            speaker.SetOutputToWaveFile(filename,
                new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
            speaker.Speak(text);
        }
        return words.ToArray();
    }
}
'@
$jobs = Get-Content -Raw -LiteralPath $JobFile | ConvertFrom-Json
foreach ($job in $jobs) {
    $words = [ReelNarrator]::Render($job.text, $job.wav, $job.voice, 0)
    ConvertTo-Json -InputObject @($words) -Depth 5 | Set-Content -LiteralPath $job.words -Encoding UTF8
}
