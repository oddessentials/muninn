using BepInEx.Configuration;

namespace GuildTelemetry
{
    internal sealed class PluginConfig
    {
        public PluginConfig(ConfigFile file)
        {
            Url = file.Bind("General", "Url", "", "Ingest endpoint of the guild site, for example https://guild.example.org/api/ingest");
            Secret = file.Bind("General", "Secret", "", "Shared telemetry secret (TELEMETRY_SECRET on the site)");
            HeartbeatSeconds = file.Bind("General", "HeartbeatSeconds", 60, "Seconds between server.heartbeat events");
            FlushSeconds = file.Bind("General", "FlushSeconds", 2, "Seconds between batch flushes");
            BiomeSampleSeconds = file.Bind("General", "BiomeSampleSeconds", 5, "Seconds between biome and distance samples");
            PositionSampleSeconds = file.Bind("General", "PositionSampleSeconds", 20, "Seconds between player.position events");
            JournalMaxMB = file.Bind("General", "JournalMaxMB", 50, "Hard cap of the on-disk journal in megabytes");
            AllowInsecureHttp = file.Bind("General", "AllowInsecureHttp", false, "Allow an http:// Url (local rig only)");
            LogEvents = file.Bind("General", "LogEvents", false, "Log every emitted event to the BepInEx log");
            MapEnabled = file.Bind("General", "MapEnabled", true, "Render the world biome map once per world and upload it to the site");
            CatalogEnabled = file.Bind("General", "CatalogEnabled", true, "Send the comfort pieces of the running game to the site at every server start");
        }

        public ConfigEntry<string> Url { get; }

        public ConfigEntry<string> Secret { get; }

        public ConfigEntry<int> HeartbeatSeconds { get; }

        public ConfigEntry<int> FlushSeconds { get; }

        public ConfigEntry<int> BiomeSampleSeconds { get; }

        public ConfigEntry<int> PositionSampleSeconds { get; }

        public ConfigEntry<int> JournalMaxMB { get; }

        public ConfigEntry<bool> AllowInsecureHttp { get; }

        public ConfigEntry<bool> LogEvents { get; }

        public ConfigEntry<bool> MapEnabled { get; }

        public ConfigEntry<bool> CatalogEnabled { get; }

        public string? Validate()
        {
            string url = Url.Value.Trim();
            if (url.Length == 0)
            {
                return "Url is empty";
            }

            if (url.StartsWith("http://", System.StringComparison.OrdinalIgnoreCase) && !AllowInsecureHttp.Value)
            {
                return "Url uses http:// but AllowInsecureHttp is false";
            }

            if (!url.StartsWith("http://", System.StringComparison.OrdinalIgnoreCase) && !url.StartsWith("https://", System.StringComparison.OrdinalIgnoreCase))
            {
                return "Url must start with https://";
            }

            if (Secret.Value.Trim().Length == 0)
            {
                return "Secret is empty";
            }

            return null;
        }
    }
}
