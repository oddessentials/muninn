using System;
using System.Text;
using System.Threading;
using BepInEx.Logging;
using GuildTelemetry.Core;

namespace GuildTelemetry
{
    internal static class ComfortCatalogueSender
    {
        private static int started;

        public static void Start(ManualLogSource log, string ingestUrl, string secret)
        {
            if (Interlocked.Exchange(ref started, 1) == 1)
            {
                return;
            }

            try
            {
                ComfortCatalogue? catalogue = ComfortReader.Read(out string? problem);
                if (catalogue == null)
                {
                    log.LogWarning("GuildTelemetry: comfort catalogue not sent: " + problem);
                    return;
                }

                if (catalogue.Pieces.Count == 0)
                {
                    log.LogWarning("GuildTelemetry: comfort catalogue not sent: the game data yielded no comfort pieces");
                    return;
                }

                byte[] body = Encoding.UTF8.GetBytes(catalogue.ToJson());
                string url = ingestUrl.TrimEnd('/') + "/catalogue";
                string summary = catalogue.Pieces.Count + " comfort pieces for game " + catalogue.GameVersion;
                Thread worker = new Thread(() => Send(log, url, secret, body, summary));
                worker.Name = "GuildTelemetry catalogue";
                worker.IsBackground = true;
                worker.Priority = System.Threading.ThreadPriority.BelowNormal;
                worker.Start();
            }
            catch (Exception exception)
            {
                log.LogWarning("GuildTelemetry: comfort catalogue could not be read: " + exception);
            }
        }

        private static void Send(ManualLogSource log, string url, string secret, byte[] body, string summary)
        {
            try
            {
                OneShotUpload upload = new OneShotUpload(new HttpTransport(), Thread.Sleep, () => DateTime.UtcNow);
                UploadOutcome outcome = upload.Send(url, secret, body, "application/json", message => log.LogWarning("GuildTelemetry: comfort catalogue " + message));
                if (outcome == UploadOutcome.Stored)
                {
                    log.LogInfo("GuildTelemetry: sent " + summary);
                }
            }
            catch (Exception exception)
            {
                log.LogWarning("GuildTelemetry: comfort catalogue upload failed: " + exception);
            }
        }
    }
}
