using System;
using System.Collections.Generic;
using BepInEx.Logging;
using GuildTelemetry.Core;

namespace GuildTelemetry
{
    internal sealed class Announcer
    {
        private readonly ManualLogSource log;
        private readonly Telemetry telemetry;
        private readonly AnnouncementScheduler scheduler = new AnnouncementScheduler();

        public Announcer(ManualLogSource log, Telemetry telemetry)
        {
            this.log = log;
            this.telemetry = telemetry;
        }

        public void Update(TelemetryPipeline pipeline, float now)
        {
            IngestResponse? response = pipeline.TakeResponse();
            if (response != null)
            {
                scheduler.Apply(response.Announcements, now);
            }

            List<Banner> banners = scheduler.Due(now);
            foreach (Banner banner in banners)
            {
                Show(banner);
            }
        }

        private void Show(Banner banner)
        {
            if (ZRoutedRpc.instance == null)
            {
                log.LogWarning("GuildTelemetry: no routed RPC yet, announcement " + banner.AnnouncementId + " dropped");
                return;
            }

            try
            {
                ZRoutedRpc.instance.InvokeRoutedRPC(ZRoutedRpc.Everybody, "ShowMessage", (int)MessageHud.MessageType.Center, banner.Text);
            }
            catch (Exception exception)
            {
                log.LogWarning("GuildTelemetry: ShowMessage failed for announcement " + banner.AnnouncementId + ": " + exception.Message);
                return;
            }

            telemetry.AnnouncementShown(banner);
            log.LogInfo("GuildTelemetry: announced \"" + banner.Text + "\" (announcement " + banner.AnnouncementId + ")");
        }
    }
}
