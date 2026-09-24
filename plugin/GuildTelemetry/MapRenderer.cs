using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Threading;
using BepInEx.Logging;
using GuildTelemetry.Core;
using UnityEngine;

namespace GuildTelemetry
{
    internal static class MapRenderer
    {
        public const int Size = 2048;
        public const float RadiusMetres = 10000f;
        public const float WaterLevel = 30f;
        private const int UploadAttempts = 10;
        private const int UploadRetryMs = 30_000;

        private static readonly byte[][] Palette =
        {
            new byte[] { 39, 75, 138 },
            new byte[] { 109, 184, 107 },
            new byte[] { 47, 107, 42 },
            new byte[] { 110, 90, 85 },
            new byte[] { 232, 232, 234 },
            new byte[] { 217, 200, 106 },
            new byte[] { 76, 74, 90 },
            new byte[] { 176, 52, 44 },
            new byte[] { 223, 233, 240 },
            new byte[] { 0, 0, 0 }
        };

        private static int started;

        public static string MarkerPath(string directory, long worldUid)
        {
            return Path.Combine(directory, "map-" + worldUid.ToString(CultureInfo.InvariantCulture) + ".uploaded");
        }

        public static void Start(ManualLogSource log, string directory, long worldUid, string ingestUrl, string secret)
        {
            if (Interlocked.Exchange(ref started, 1) == 1)
            {
                return;
            }

            if (File.Exists(MarkerPath(directory, worldUid)))
            {
                log.LogInfo("GuildTelemetry: map for world " + worldUid + " was uploaded earlier, skipping the render");
                return;
            }

            WorldGenerator generator = WorldGenerator.instance;
            if (generator == null)
            {
                log.LogWarning("GuildTelemetry: no world generator, the map is not rendered");
                return;
            }

            Thread worker = new Thread(() => Run(log, generator, directory, worldUid, ingestUrl, secret));
            worker.Name = "GuildTelemetry map";
            worker.IsBackground = true;
            worker.Priority = System.Threading.ThreadPriority.BelowNormal;
            worker.Start();
        }

        private static byte PaletteIndex(Heightmap.Biome biome)
        {
            switch (biome)
            {
                case Heightmap.Biome.Meadows:
                    return 1;
                case Heightmap.Biome.BlackForest:
                    return 2;
                case Heightmap.Biome.Swamp:
                    return 3;
                case Heightmap.Biome.Mountain:
                    return 4;
                case Heightmap.Biome.Plains:
                    return 5;
                case Heightmap.Biome.Mistlands:
                    return 6;
                case Heightmap.Biome.AshLands:
                    return 7;
                case Heightmap.Biome.DeepNorth:
                    return 8;
                case Heightmap.Biome.Ocean:
                    return 0;
                default:
                    return 9;
            }
        }

        public static byte[] Render(WorldGenerator generator, Action<int>? progress)
        {
            byte[] pixels = new byte[Size * Size];
            float step = RadiusMetres * 2f / Size;
            for (int y = 0; y < Size; y++)
            {
                float wz = RadiusMetres - (y + 0.5f) * step;
                for (int x = 0; x < Size; x++)
                {
                    float wx = -RadiusMetres + (x + 0.5f) * step;
                    Heightmap.Biome biome = generator.GetBiome(wx, wz);
                    byte index;
                    if (biome == Heightmap.Biome.Ocean)
                    {
                        index = 0;
                    }
                    else
                    {
                        Color mask;
                        float height = generator.GetBiomeHeight(biome, wx, wz, out mask);
                        index = height < WaterLevel ? (byte)0 : PaletteIndex(biome);
                    }

                    pixels[y * Size + x] = index;
                }

                if (progress != null && (y + 1) % 512 == 0)
                {
                    progress(y + 1);
                }
            }

            return pixels;
        }

        private static void Run(ManualLogSource log, WorldGenerator generator, string directory, long worldUid, string ingestUrl, string secret)
        {
            try
            {
                Stopwatch watch = Stopwatch.StartNew();
                byte[] pixels = Render(generator, rows => log.LogInfo("GuildTelemetry: map render " + rows + "/" + Size + " rows"));
                byte[] png = PngEncoder.EncodeIndexed(Size, Size, pixels, Palette);
                log.LogInfo("GuildTelemetry: map rendered in " + (watch.ElapsedMilliseconds / 1000) + " s, " + png.Length + " bytes");
                Upload(log, png, directory, worldUid, ingestUrl, secret);
            }
            catch (Exception exception)
            {
                log.LogWarning("GuildTelemetry: map rendering failed: " + exception);
            }
        }

        private static void Upload(ManualLogSource log, byte[] png, string directory, long worldUid, string ingestUrl, string secret)
        {
            string url = ingestUrl.TrimEnd('/');
            url += "/map";
            RequestSigner signer = new RequestSigner(secret);
            HttpTransport transport = new HttpTransport();
            string digest = RequestSigner.Sha256Hex(png);
            for (int attempt = 1; attempt <= UploadAttempts; attempt++)
            {
                long unix = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
                Dictionary<string, string> headers = new Dictionary<string, string>
                {
                    { RequestSigner.TimestampHeader, unix.ToString(CultureInfo.InvariantCulture) },
                    { RequestSigner.SignatureHeader, signer.Sign(unix, digest) },
                    { "X-World-Uid", worldUid.ToString(CultureInfo.InvariantCulture) },
                    { "X-Map-Size", Size.ToString(CultureInfo.InvariantCulture) },
                    { "X-Map-Radius", RadiusMetres.ToString(CultureInfo.InvariantCulture) }
                };
                SendResult result = transport.Post(url, png, "image/png", headers, 120_000);
                if (result.StatusCode >= 200 && result.StatusCode < 300)
                {
                    Directory.CreateDirectory(directory);
                    File.WriteAllText(MarkerPath(directory, worldUid), JsonWriter.Timestamp(DateTime.UtcNow) + "\n");
                    log.LogInfo("GuildTelemetry: map uploaded for world " + worldUid);
                    return;
                }

                if (result.StatusCode == 401 || result.StatusCode == 413 || result.StatusCode == 422)
                {
                    log.LogWarning("GuildTelemetry: map upload refused (HTTP " + result.StatusCode + "): " + result.Error);
                    return;
                }

                log.LogWarning("GuildTelemetry: map upload attempt " + attempt + " failed (" + (result.Error ?? ("HTTP " + result.StatusCode)) + ")");
                Thread.Sleep(UploadRetryMs);
            }
        }
    }
}
