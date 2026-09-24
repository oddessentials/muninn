using System;
using System.Collections.Generic;
using System.IO;
using BepInEx;
using BepInEx.Logging;
using GuildTelemetry.Core;
using HarmonyLib;
using UnityEngine;

namespace GuildTelemetry
{
    [BepInPlugin(MyPluginInfo.PLUGIN_GUID, MyPluginInfo.PLUGIN_NAME, MyPluginInfo.PLUGIN_VERSION)]
    [BepInProcess("valheim_server.exe")]
    public sealed class GuildTelemetryPlugin : BaseUnityPlugin
    {
        private static ManualLogSource? log;
        private Harmony? harmony;
        private PluginConfig? config;
        private TelemetryPipeline? pipeline;
        private Telemetry? telemetry;
        private Announcer? announcer;
        private readonly List<string> missingHooks = new List<string>();
        private bool disabled;
        private float nextBiomeSample;
        private float nextPositionSample;
        private float nextHeartbeat;

        internal static ManualLogSource Log
        {
            get { return log ?? throw new InvalidOperationException("GuildTelemetry has not been loaded."); }
        }

        private void Awake()
        {
            log = Logger;
            Log.LogInfo(string.Format(
                "{0} {1} loaded on Valheim {2} (network version {3})",
                MyPluginInfo.PLUGIN_NAME,
                MyPluginInfo.PLUGIN_VERSION,
                global::Version.GetVersionString(),
                GameVersions.NetworkVersion()));
            try
            {
                config = new PluginConfig(Config);
                string? problem = config.Validate();
                if (problem != null)
                {
                    disabled = true;
                    Log.LogError("GuildTelemetry: configuration invalid (" + problem + "); set Url and Secret in " + Config.ConfigFilePath + " and restart. The plugin stays inactive.");
                    return;
                }

                telemetry = new Telemetry(Log, config, missingHooks);
                announcer = new Announcer(Log, telemetry);
                harmony = new Harmony(MyPluginInfo.PLUGIN_GUID);
                missingHooks.AddRange(Hooks.Install(harmony, telemetry));
                Log.LogInfo("GuildTelemetry: hooks installed" + (missingHooks.Count > 0 ? " (missing: " + string.Join(", ", missingHooks.ToArray()) + ")" : string.Empty));
            }
            catch (Exception exception)
            {
                disabled = true;
                Log.LogError("GuildTelemetry: initialisation failed, the plugin stays inactive: " + exception);
            }
        }

        private void Update()
        {
            if (disabled || telemetry == null || config == null)
            {
                return;
            }

            try
            {
                if (!telemetry.Started)
                {
                    if (ZNet.instance == null || !ZNet.instance.IsServer() || ZoneSystem.instance == null || WorldGenerator.instance == null || ZNetScene.instance == null)
                    {
                        return;
                    }

                    StartPipeline();
                    telemetry.ServerStarted();
                    if (config.MapEnabled.Value)
                    {
                        MapRenderer.Start(Log, Path.Combine(Paths.ConfigPath, "GuildTelemetry"), ZNet.instance.GetWorldUID(), config.Url.Value.Trim(), config.Secret.Value.Trim());
                    }

                    if (config.CatalogEnabled.Value)
                    {
                        ComfortCatalogueSender.Start(Log, config.Url.Value.Trim(), config.Secret.Value.Trim());
                    }

                    float now = Time.realtimeSinceStartup;
                    nextBiomeSample = now + config.BiomeSampleSeconds.Value;
                    nextPositionSample = now + config.PositionSampleSeconds.Value;
                    nextHeartbeat = now + config.HeartbeatSeconds.Value;
                }

                Hooks.EnsureDestroyHook();
                float time = Time.realtimeSinceStartup;
                if (time >= nextBiomeSample)
                {
                    nextBiomeSample = time + Math.Max(1, config.BiomeSampleSeconds.Value);
                    telemetry.SampleBiomes();
                }

                if (time >= nextPositionSample)
                {
                    nextPositionSample = time + Math.Max(1, config.PositionSampleSeconds.Value);
                    telemetry.SamplePositions();
                }

                if (time >= nextHeartbeat)
                {
                    nextHeartbeat = time + Math.Max(5, config.HeartbeatSeconds.Value);
                    telemetry.Heartbeat();
                }

                if (pipeline != null && announcer != null)
                {
                    announcer.Update(pipeline, time);
                }
            }
            catch (Exception exception)
            {
                Log.LogWarning("GuildTelemetry: update failed: " + exception.Message);
            }
        }

        private void StartPipeline()
        {
            if (telemetry == null || config == null)
            {
                return;
            }

            string serverName = ZNet.m_ServerName ?? string.Empty;
            string worldName = ZNet.instance.GetWorldName() ?? string.Empty;
            long worldUid = ZNet.instance.GetWorldUID();
            BatchMetadata metadata = new BatchMetadata(
                MyPluginInfo.PLUGIN_NAME,
                MyPluginInfo.PLUGIN_VERSION,
                global::Version.CurrentVersion.ToString(),
                (int)GameVersions.NetworkVersion(),
                serverName,
                worldName,
                worldUid);
            EventJournal journal = new EventJournal(Path.Combine(Paths.ConfigPath, "GuildTelemetry"), Math.Max(1, config.JournalMaxMB.Value) * 1024L * 1024L);
            PipelineOptions options = new PipelineOptions
            {
                Url = config.Url.Value.Trim(),
                Secret = config.Secret.Value.Trim(),
                FlushIntervalMs = Math.Max(500, config.FlushSeconds.Value * 1000)
            };
            pipeline = new TelemetryPipeline(options, metadata, journal, new HttpTransport(), message => Log.LogInfo("GuildTelemetry: " + message));
            pipeline.Start();
            telemetry.AttachPipeline(pipeline);
            Log.LogInfo("GuildTelemetry: sending to " + options.Url + " for server \"" + serverName + "\" world \"" + worldName + "\"");
        }

        private void OnDestroy()
        {
            Hooks.Uninstall();
            harmony?.UnpatchSelf();
            pipeline?.Dispose();
        }
    }
}
