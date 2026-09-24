using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using BepInEx.Logging;
using GuildTelemetry.Core;
using UnityEngine;

namespace GuildTelemetry
{
    internal sealed class KillCredit
    {
        public KillCredit(string enemyName, string platformUserId, DateTime atUtc)
        {
            EnemyName = enemyName;
            PlatformUserId = platformUserId;
            AtUtc = atUtc;
        }

        public string EnemyName { get; }

        public string PlatformUserId { get; }

        public DateTime AtUtc { get; }
    }

    internal sealed class RecentDeath
    {
        public RecentDeath(string prefab, Vector3 position, DateTime atUtc)
        {
            Prefab = prefab;
            Position = position;
            AtUtc = atUtc;
        }

        public string Prefab { get; }

        public Vector3 Position { get; }

        public DateTime AtUtc { get; }
    }

    internal sealed class Telemetry
    {
        public const float BossNearbyRadius = 200f;
        public const float CreatureNearbyRadius = 100f;
        public const float TeleportThresholdMetres = 500f;

        private readonly ManualLogSource log;
        private readonly PluginConfig config;
        private TelemetryPipeline? pipeline;
        private readonly List<TelemetryEvent> buffered = new List<TelemetryEvent>();
        private readonly List<string> missingHooks;
        private long seq;
        private readonly float startedRealtime = Time.realtimeSinceStartup;
        private Stopwatch? saveWatch;
        private DateTime? lastSaveFinishedUtc;
        private readonly Dictionary<ZDOID, DateTime> engagedBosses = new Dictionary<ZDOID, DateTime>();
        private readonly Dictionary<string, DateTime> summonedByPrefab = new Dictionary<string, DateTime>(StringComparer.Ordinal);
        private readonly List<RecentDeath> recentDeaths = new List<RecentDeath>();
        private readonly List<KillCredit> recentCredits = new List<KillCredit>();
        private readonly Dictionary<string, DateTime> recentChat = new Dictionary<string, DateTime>(StringComparer.Ordinal);
        private readonly HashSet<ZDOID> pendingCreated = new HashSet<ZDOID>();
        private float lastActiveBosses;
        private string? currentRaid;
        private DateTime currentRaidStartedUtc;

        public Telemetry(ManualLogSource log, PluginConfig config, List<string> missingHooks)
        {
            this.log = log;
            this.config = config;
            this.missingHooks = missingHooks;
        }

        public void AttachPipeline(TelemetryPipeline started)
        {
            pipeline = started;
            foreach (TelemetryEvent telemetryEvent in buffered)
            {
                started.Enqueue(telemetryEvent);
            }

            buffered.Clear();
        }

        public string RunId { get; } = Guid.NewGuid().ToString();

        public PeerTracker Peers { get; } = new PeerTracker();

        public PrefabCatalog Catalog { get; } = new PrefabCatalog();

        public bool Started { get; private set; }

        public TelemetryPipeline? Pipeline => pipeline;

        public int QueueDepth => pipeline != null ? pipeline.QueueDepth : buffered.Count;

        public long DroppedEvents => pipeline != null ? pipeline.DroppedEvents : 0;

        public double UptimeSeconds => Time.realtimeSinceStartup - startedRealtime;

        public int WorldDay()
        {
            if (EnvMan.instance != null)
            {
                return EnvMan.instance.GetDay();
            }

            return ZNet.instance != null ? (int)(ZNet.instance.GetTimeSeconds() / 1800.0) : 0;
        }

        public static string BiomeAt(Vector3 position)
        {
            if (WorldGenerator.instance == null)
            {
                return "None";
            }

            return WorldGenerator.instance.GetBiome(position).ToString();
        }

        public void Emit(string type, string dataJson)
        {
            TelemetryEvent telemetryEvent = new TelemetryEvent(Guid.NewGuid().ToString(), Interlocked.Increment(ref seq), RunId, DateTime.UtcNow, type, WorldDay(), dataJson);
            if (pipeline == null)
            {
                if (buffered.Count < 1000)
                {
                    buffered.Add(telemetryEvent);
                }
            }
            else if (!pipeline.Enqueue(telemetryEvent))
            {
                log.LogWarning("GuildTelemetry: queue full, dropped " + type);
            }

            if (config.LogEvents.Value)
            {
                log.LogInfo("GuildTelemetry: " + type + " " + dataJson);
            }
        }

        private static JsonWriter Position(JsonWriter writer, Vector3 position)
        {
            return writer.Property("x", Math.Round(position.x, 1)).Property("z", Math.Round(position.z, 1));
        }

        private CreatorAccounts ScanCreators()
        {
            try
            {
                int scanned;
                long elapsedMs;
                CreatorAccounts creators = Creators.Scan(out scanned, out elapsedMs);
                log.LogInfo("GuildTelemetry: found " + creators.Count + " piece creators among " + scanned + " objects in " + elapsedMs + " ms");
                return creators;
            }
            catch (Exception exception)
            {
                log.LogWarning("GuildTelemetry: the piece creator scan failed: " + exception.Message);
                return new CreatorAccounts();
            }
        }

        private string? BuilderAccount(ZDO zdo, long creator)
        {
            if (creator == 0)
            {
                return null;
            }

            string? account = Creators.AccountOf(zdo, Creators.History());
            if (account != null)
            {
                return account;
            }

            PeerState? builder = Peers.ByProfileId(creator);
            return builder != null ? builder.PlatformUserId : null;
        }

        public void ServerStarted()
        {
            if (Started || ZNet.instance == null)
            {
                return;
            }

            Started = true;
            Catalog.EnsureBuilt();
            CreatorAccounts creators = ScanCreators();
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("game_version", global::Version.CurrentVersion.ToString())
                .Property("network_version", (long)GameVersions.NetworkVersion())
                .Property("plugin_version", MyPluginInfo.PLUGIN_VERSION)
                .Property("bepinex_version", typeof(BepInEx.Paths).Assembly.GetName().Version.ToString())
                .Property("unity_version", Application.unityVersion)
                .Property("world_name", ZNet.instance.GetWorldName() ?? string.Empty)
                .Property("world_uid", ZNet.instance.GetWorldUID())
                .Property("net_time", Math.Round(ZNet.instance.GetTimeSeconds(), 1))
                .Property("world_day", WorldDay())
                .StringArray("global_keys", ZoneSystem.instance != null ? ZoneSystem.instance.GetGlobalKeys() : new List<string>())
                .StringArray("missing_hooks", missingHooks);
            creators.Write(writer, "creators").EndObject();
            Emit("server.started", writer.ToString());
            log.LogInfo("GuildTelemetry: server.started sent for world " + ZNet.instance.GetWorldName() + " with " + Catalog.Count + " classified prefabs");
        }

        public void Heartbeat()
        {
            if (!Started || ZNet.instance == null)
            {
                return;
            }

            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("uptime_s", Math.Round(UptimeSeconds, 1))
                .Property("net_time", Math.Round(ZNet.instance.GetTimeSeconds(), 1))
                .Property("world_day", WorldDay())
                .Name("last_save_age_s");
            if (lastSaveFinishedUtc.HasValue)
            {
                writer.Value(Math.Round((DateTime.UtcNow - lastSaveFinishedUtc.Value).TotalSeconds, 1));
            }
            else
            {
                writer.Null();
            }

            writer.Property("queue_depth", QueueDepth)
                .Property("dropped_events", DroppedEvents)
                .Name("players").BeginArray();
            foreach (PeerState peer in Peers.All)
            {
                Vector3 position = peer.Position;
                writer.BeginObject()
                    .Property("platform_user_id", peer.PlatformUserId)
                    .Property("name", peer.Name)
                    .Property("character_id", peer.PlayerId)
                    .Property("biome", peer.Spawned ? BiomeAt(position) : peer.LastBiome);
                Position(writer, position)
                    .Property("distance_since_last_m", Math.Round(peer.DistanceSinceHeartbeat, 1))
                    .EndObject();
                peer.DistanceSinceHeartbeat = 0;
            }

            writer.EndArray().EndObject();
            Emit("server.heartbeat", writer.ToString());
        }

        public void SampleBiomes()
        {
            foreach (PeerState peer in Peers.All)
            {
                if (!peer.Spawned)
                {
                    continue;
                }

                Vector3 position = peer.Position;
                if (peer.HasLastPosition)
                {
                    float moved = PeerTracker.DistanceXZ(position, peer.LastPosition);
                    if (moved < TeleportThresholdMetres)
                    {
                        peer.DistanceSinceHeartbeat += moved;
                    }
                }

                peer.LastPosition = position;
                peer.HasLastPosition = true;
                string biome = BiomeAt(position);
                if (biome != peer.LastBiome)
                {
                    string previous = peer.LastBiome;
                    peer.LastBiome = biome;
                    JsonWriter writer = new JsonWriter();
                    writer.BeginObject()
                        .Property("platform_user_id", peer.PlatformUserId)
                        .Property("from", previous)
                        .Property("to", biome);
                    Position(writer, position).EndObject();
                    Emit("player.biome_changed", writer.ToString());
                }
            }
        }

        public void SamplePositions()
        {
            foreach (PeerState peer in Peers.All)
            {
                if (!peer.Spawned)
                {
                    continue;
                }

                Vector3 position = peer.Position;
                JsonWriter writer = new JsonWriter();
                writer.BeginObject().Property("platform_user_id", peer.PlatformUserId);
                Position(writer, position).Property("biome", BiomeAt(position)).EndObject();
                Emit("player.position", writer.ToString());
            }
        }

        public void PeerJoined(ZNetPeer peer)
        {
            PeerState state = Peers.Register(peer);
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("platform_user_id", state.PlatformUserId)
                .Property("display_id", state.DisplayId)
                .Property("platform", state.Platform)
                .Property("name", state.Name)
                .Property("peer_uid", state.Uid)
                .Property("playfab_id", state.PlayfabId)
                .EndObject();
            Emit("player.joined", writer.ToString());
            log.LogInfo("GuildTelemetry: player joined " + state.Name + " (" + state.HostName + ") uid " + state.Uid);
        }

        public void PeerLeft(PeerState state, string reason)
        {
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("platform_user_id", state.PlatformUserId)
                .Property("name", state.Name)
                .Property("session_s", Math.Round(state.SessionSeconds, 1))
                .Property("reason", reason)
                .EndObject();
            Emit("player.left", writer.ToString());
            Peers.Remove(state.Uid);
            log.LogInfo("GuildTelemetry: player left " + state.Name + " (" + state.HostName + ") uid " + state.Uid + " reason " + reason);
        }

        public void PeerSpawned(PeerState state, ZDOID characterId)
        {
            bool respawn = state.Spawned;
            state.CharacterId = characterId;
            state.Spawned = true;
            Vector3 position = state.Position;
            string biome = BiomeAt(position);
            state.LastBiome = biome;
            state.LastPosition = position;
            state.HasLastPosition = true;
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("platform_user_id", state.PlatformUserId)
                .Property("name", state.Name)
                .Property("character_id", state.PlayerId)
                .Property("respawn", respawn);
            Position(writer, position).Property("biome", biome).EndObject();
            Emit("player.spawned", writer.ToString());
        }

        public void PeerDied(PeerState state)
        {
            DateTime now = DateTime.UtcNow;
            if ((now - state.LastDeathUtc).TotalSeconds < 15)
            {
                return;
            }

            state.LastDeathUtc = now;
            Vector3 position = state.Position;
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("platform_user_id", state.PlatformUserId)
                .Property("name", state.Name)
                .Property("character_id", state.PlayerId);
            Position(writer, position).Property("biome", BiomeAt(position));
            ObservedHit? hit = state.LastHit;
            if (hit != null && (now - hit.AtUtc).TotalSeconds <= 10)
            {
                PeerState? attackerPeer = Peers.ByCharacter(hit.Attacker);
                string? attackerPrefab = null;
                if (attackerPeer == null && !hit.Attacker.IsNone() && ZDOMan.instance != null)
                {
                    ZDO attackerZdo = ZDOMan.instance.GetZDO(hit.Attacker);
                    if (attackerZdo != null)
                    {
                        attackerPrefab = Catalog.NameOf(attackerZdo.GetPrefab());
                    }
                }

                writer.Name("observed_cause").BeginObject()
                    .Property("hit_type", hit.HitType.ToString())
                    .Property("attacker_prefab", attackerPrefab)
                    .Property("attacker_platform_user_id", attackerPeer != null ? attackerPeer.PlatformUserId : null)
                    .Property("at", JsonWriter.Timestamp(hit.AtUtc))
                    .EndObject();
            }
            else
            {
                writer.PropertyNull("observed_cause");
            }

            writer.EndObject();
            Emit("player.died", writer.ToString());
        }

        public void RecordHit(PeerState target, HitData hit)
        {
            target.LastHit = new ObservedHit(hit.m_hitType, hit.m_attacker, DateTime.UtcNow);
        }

        public void SaveStarted()
        {
            saveWatch = Stopwatch.StartNew();
            Emit("world.save_started", "{}");
        }

        public void SaveFinished()
        {
            long duration = saveWatch != null ? saveWatch.ElapsedMilliseconds : 0;
            saveWatch = null;
            lastSaveFinishedUtc = DateTime.UtcNow;
            JsonWriter writer = new JsonWriter();
            writer.BeginObject().Property("duration_ms", duration).EndObject();
            Emit("world.saved", writer.ToString());
        }

        public void Stopping()
        {
            List<PeerState> peers = new List<PeerState>(Peers.All);
            foreach (PeerState peer in peers)
            {
                PeerLeft(peer, "server_stop");
            }

            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("uptime_s", Math.Round(UptimeSeconds, 1))
                .Property("online_count", peers.Count)
                .EndObject();
            Emit("server.stopping", writer.ToString());
            if (pipeline != null)
            {
                pipeline.FlushSync(1500);
            }
        }

        public void GlobalKey(long sender, string line)
        {
            string value;
            GlobalKeys parsed;
            string key = ZoneSystem.GetKeyValue(line.ToLowerInvariant(), out value, out parsed);
            bool existed = ZoneSystem.instance != null && ZoneSystem.instance.GetGlobalKey(key);
            PrefabInfo? creature = CreatureForDefeatKey(key);
            if (creature != null && creature.IsBoss)
            {
                BossDefeated(sender, key, !existed);
                return;
            }

            if (key == "activebosses")
            {
                float count;
                float.TryParse(value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out count);
                if (count > lastActiveBosses)
                {
                    BossEngagedByCount(sender);
                }

                lastActiveBosses = count;
                return;
            }

            PeerState? senderPeer = Peers.Get(sender);
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("key", key)
                .Property("value", value.Length > 0 ? value : null)
                .Property("first_time", !existed)
                .Property("prefab", creature != null ? creature.Name : null)
                .Property("name_key", creature != null && creature.CharacterName.Length > 0 ? creature.CharacterName : null)
                .Property("sender_platform_user_id", senderPeer != null ? senderPeer.PlatformUserId : null)
                .StringArray("nearby", senderPeer != null ? Peers.NearbyIds(senderPeer.Position, CreatureNearbyRadius) : new List<string>())
                .EndObject();
            Emit("global_key.set", writer.ToString());
        }

        private PrefabInfo? CreatureForDefeatKey(string key)
        {
            PrefabInfo? first = null;
            foreach (int hash in Catalog.HashesForDefeatKey(key))
            {
                PrefabInfo? info = Catalog.Get(hash);
                if (info == null)
                {
                    continue;
                }

                if (info.IsBoss)
                {
                    return info;
                }

                if (first == null)
                {
                    first = info;
                }
            }

            return first;
        }

        private ZDO? FindBossZdo(List<int> hashes, Vector3? near, bool requireNotEngaged)
        {
            if (ZDOMan.instance == null || hashes.Count == 0)
            {
                return null;
            }

            ZDO? best = null;
            float bestDistance = float.MaxValue;
            foreach (ZDO zdo in ZDOMan.instance.m_objectsByID.Values)
            {
                if (!hashes.Contains(zdo.GetPrefab()))
                {
                    continue;
                }

                if (requireNotEngaged && engagedBosses.ContainsKey(zdo.m_uid))
                {
                    continue;
                }

                float distance = near.HasValue ? PeerTracker.DistanceXZ(zdo.GetPosition(), near.Value) : 0f;
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    best = zdo;
                }
            }

            return best;
        }

        private void BossDefeated(long sender, string key, bool firstTime)
        {
            PeerState? senderPeer = Peers.Get(sender);
            Vector3? senderPosition = senderPeer != null ? senderPeer.Position : (Vector3?)null;
            List<int> hashes = Catalog.HashesForDefeatKey(key);
            ZDO? boss = FindBossZdo(hashes, senderPosition, false);
            PrefabInfo? info = boss != null ? Catalog.Get(boss.GetPrefab()) : null;
            List<string> participants = new List<string>();
            if (boss != null)
            {
                foreach (PeerState peer in Peers.All)
                {
                    if (boss.GetBool(ZDOVars.s_attackers + peer.Name))
                    {
                        participants.Add(peer.PlatformUserId);
                    }
                }

                engagedBosses.Remove(boss.m_uid);
            }

            Vector3 centre = boss != null ? boss.GetPosition() : (senderPosition ?? Vector3.zero);
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("key", key)
                .Property("first_time", firstTime)
                .Property("sender_platform_user_id", senderPeer != null ? senderPeer.PlatformUserId : null)
                .StringArray("nearby", Peers.NearbyIds(centre, BossNearbyRadius))
                .Property("prefab", info != null ? info.Name : null)
                .Property("name_key", info != null && info.CharacterName.Length > 0 ? info.CharacterName : null)
                .StringArray("participants", participants)
                .EndObject();
            Emit("boss.defeated", writer.ToString());
        }

        private void BossEngagedByCount(long sender)
        {
            if (ZDOMan.instance == null)
            {
                return;
            }

            PeerState? senderPeer = Peers.Get(sender);
            Vector3? senderPosition = senderPeer != null ? senderPeer.Position : (Vector3?)null;
            ZDO? best = null;
            float bestDistance = float.MaxValue;
            foreach (ZDO zdo in ZDOMan.instance.m_objectsByID.Values)
            {
                PrefabInfo? info = Catalog.Get(zdo.GetPrefab());
                if (info == null || !info.IsBoss || engagedBosses.ContainsKey(zdo.m_uid))
                {
                    continue;
                }

                float distance = senderPosition.HasValue ? PeerTracker.DistanceXZ(zdo.GetPosition(), senderPosition.Value) : 0f;
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    best = zdo;
                }
            }

            if (best != null)
            {
                BossEngaged(best, Catalog.Get(best.GetPrefab())!, null);
            }
        }

        public void BossAlert(long sender, string message)
        {
            int hash;
            if (!Catalog.TryPrefabForAlert(message, out hash))
            {
                return;
            }

            PeerState? senderPeer = Peers.Get(sender);
            Vector3? senderPosition = senderPeer != null ? senderPeer.Position : (Vector3?)null;
            ZDO? boss = FindBossZdo(new List<int> { hash }, senderPosition, false);
            PrefabInfo? info = Catalog.Get(hash);
            if (info == null)
            {
                return;
            }

            if (boss != null)
            {
                BossEngaged(boss, info, message);
            }
            else if (senderPosition.HasValue)
            {
                EmitEngaged(info, senderPosition.Value, message);
            }
        }

        private void BossEngaged(ZDO boss, PrefabInfo info, string? message)
        {
            if (engagedBosses.ContainsKey(boss.m_uid))
            {
                return;
            }

            engagedBosses[boss.m_uid] = DateTime.UtcNow;
            EmitEngaged(info, boss.GetPosition(), message ?? info.AlertMessage);
        }

        private void EmitEngaged(PrefabInfo info, Vector3 position, string message)
        {
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("prefab", info.Name)
                .Property("name_key", info.CharacterName);
            Position(writer, position)
                .Property("biome", BiomeAt(position))
                .Property("alert_message", message)
                .StringArray("nearby", Peers.NearbyIds(position, BossNearbyRadius))
                .EndObject();
            Emit("boss.engaged", writer.ToString());
        }

        public void BossSummonRpc(long sender, ZDOID altarId, Vector3 point)
        {
            if (ZDOMan.instance == null)
            {
                return;
            }

            ZDO altar = ZDOMan.instance.GetZDO(altarId);
            PrefabInfo? altarInfo = altar != null ? Catalog.Get(altar.GetPrefab()) : null;
            if (altarInfo == null || !altarInfo.IsAltar)
            {
                return;
            }

            PrefabInfo? boss = Catalog.Get(altarInfo.BossPrefabName.GetStableHashCode());
            if (boss == null || !boss.IsBoss)
            {
                return;
            }

            PeerState? senderPeer = Peers.Get(sender);
            EmitSummoned(altarInfo.BossPrefabName, boss.CharacterName, point, senderPeer != null ? senderPeer.PlatformUserId : null, "spawn_rpc");
        }

        private void EmitSummoned(string prefab, string nameKey, Vector3 position, string? summoner, string method)
        {
            summonedByPrefab[prefab] = DateTime.UtcNow;
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("prefab", prefab)
                .Property("name_key", nameKey);
            Position(writer, position)
                .Property("biome", BiomeAt(position))
                .Property("summoner_platform_user_id", summoner)
                .Property("method", method)
                .EndObject();
            Emit("boss.summoned", writer.ToString());
        }

        public void Chat(long sender, string kind, string? text, Vector3? position, string? fallbackUserId)
        {
            PeerState? senderPeer = Peers.Get(sender);
            string platformUserId = senderPeer != null ? senderPeer.PlatformUserId : (!string.IsNullOrEmpty(fallbackUserId) ? fallbackUserId! : "Server_" + (ZNet.m_ServerName ?? "server"));
            Vector3 point = position ?? (senderPeer != null ? senderPeer.Position : Vector3.zero);
            string dedupeKey = platformUserId + "|" + kind + "|" + (text ?? string.Empty);
            DateTime now = DateTime.UtcNow;
            DateTime last;
            if (recentChat.TryGetValue(dedupeKey, out last) && (now - last).TotalSeconds < 2)
            {
                return;
            }

            recentChat[dedupeKey] = now;
            if (recentChat.Count > 256)
            {
                recentChat.Clear();
            }

            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("platform_user_id", platformUserId)
                .Property("kind", kind)
                .Property("text", text);
            Position(writer, point).Property("biome", BiomeAt(point)).EndObject();
            Emit("chat.message", writer.ToString());
        }

        public void AnnouncementShown(Banner banner)
        {
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("announcement_id", banner.AnnouncementId)
                .Property("kind", banner.Kind)
                .Property("text", banner.Text);
            if (banner.RemainingSeconds == null)
            {
                writer.PropertyNull("remaining_s");
            }
            else
            {
                writer.Property("remaining_s", banner.RemainingSeconds.Value);
            }

            writer.Property("final", banner.Final).EndObject();
            Emit("announcement.shown", writer.ToString());
        }

        public void KillCredited(long targetPeer, string enemyName)
        {
            PeerState? peer = Peers.Get(targetPeer);
            if (peer == null)
            {
                return;
            }

            DateTime now = DateTime.UtcNow;
            recentCredits.RemoveAll(credit => (now - credit.AtUtc).TotalSeconds > 15);
            recentCredits.Add(new KillCredit(enemyName, peer.PlatformUserId, now));
        }

        public void ZdoCreated(ZDOID id, int prefabHash)
        {
            if (prefabHash == 0)
            {
                pendingCreated.Add(id);
                return;
            }

            ZDO? zdo = ZDOMan.instance != null ? ZDOMan.instance.GetZDO(id) : null;
            if (zdo != null)
            {
                Classify(zdo, prefabHash);
            }
        }

        public void ZdoDeserialized(ZDO zdo)
        {
            if (!pendingCreated.Remove(zdo.m_uid))
            {
                return;
            }

            Classify(zdo, zdo.GetPrefab());
        }

        public void ZdoDestroyed(ZDO zdo)
        {
            pendingCreated.Remove(zdo.m_uid);
            engagedBosses.Remove(zdo.m_uid);
            PrefabInfo? info = Catalog.Get(zdo.GetPrefab());
            if (info == null)
            {
                return;
            }

            if (info.IsPiece)
            {
                long creator = zdo.GetLong(ZDOVars.s_creator, 0L);
                Vector3 position = zdo.GetPosition();
                JsonWriter writer = new JsonWriter();
                writer.BeginObject().Property("prefab", info.Name);
                Position(writer, position).Property("biome", BiomeAt(position)).Name("creator_character_id");
                if (creator != 0)
                {
                    writer.Value(creator);
                }
                else
                {
                    writer.Null();
                }

                writer.Property("creator_platform_user_id", BuilderAccount(zdo, creator)).EndObject();
                Emit("structure.destroyed", writer.ToString());
                return;
            }

            if (info.IsCharacter && !info.IsPlayer)
            {
                float health = zdo.GetFloat(ZDOVars.s_health, 1f);
                if (health > 0f)
                {
                    return;
                }

                CreatureDied(info.Name, info, zdo.GetInt(ZDOVars.s_level, 1), zdo.GetPosition());
            }
        }

        private void Classify(ZDO zdo, int prefabHash)
        {
            PrefabInfo? info = Catalog.Get(prefabHash);
            if (info == null)
            {
                return;
            }

            Vector3 position = zdo.GetPosition();
            if (info.IsPiece)
            {
                long creator = zdo.GetLong(ZDOVars.s_creator, 0L);
                JsonWriter writer = new JsonWriter();
                writer.BeginObject().Property("prefab", info.Name);
                Position(writer, position)
                    .Property("biome", BiomeAt(position))
                    .Property("creator_character_id", creator)
                    .Property("creator_platform_user_id", BuilderAccount(zdo, creator))
                    .EndObject();
                Emit("structure.built", writer.ToString());
                return;
            }

            if (info.IsRagdoll)
            {
                string creature = info.CreatureForRagdoll.Length > 0 ? info.CreatureForRagdoll : info.Name;
                PrefabInfo? creatureInfo = Catalog.Get(creature.GetStableHashCode());
                if (creatureInfo != null && creatureInfo.IsPlayer)
                {
                    return;
                }

                CreatureDied(creature, creatureInfo, zdo.GetInt(ZDOVars.s_level, 1), position);
                return;
            }

            if (info.IsBoss)
            {
                DateTime last;
                if (summonedByPrefab.TryGetValue(info.Name, out last) && (DateTime.UtcNow - last).TotalSeconds < 120)
                {
                    return;
                }

                PeerState? owner = Peers.Get(zdo.GetOwner());
                EmitSummoned(info.Name, info.CharacterName, position, owner != null ? owner.PlatformUserId : null, "zdo");
            }
        }

        private void CreatureDied(string prefab, PrefabInfo? creatureInfo, int level, Vector3 position)
        {
            DateTime now = DateTime.UtcNow;
            recentDeaths.RemoveAll(death => (now - death.AtUtc).TotalSeconds > 10);
            foreach (RecentDeath death in recentDeaths)
            {
                if (death.Prefab == prefab && PeerTracker.DistanceXZ(death.Position, position) < 20f)
                {
                    return;
                }
            }

            recentDeaths.Add(new RecentDeath(prefab, position, now));
            List<string> credited = new List<string>();
            string characterName = creatureInfo != null ? creatureInfo.CharacterName : string.Empty;
            recentCredits.RemoveAll(credit => (now - credit.AtUtc).TotalSeconds > 15);
            for (int i = recentCredits.Count - 1; i >= 0; i--)
            {
                KillCredit credit = recentCredits[i];
                if (characterName.Length > 0 && credit.EnemyName == characterName && !credited.Contains(credit.PlatformUserId))
                {
                    credited.Add(credit.PlatformUserId);
                    recentCredits.RemoveAt(i);
                }
            }

            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("prefab", prefab)
                .Property("level", Math.Max(1, level));
            Position(writer, position)
                .Property("biome", BiomeAt(position))
                .StringArray("credited", credited)
                .StringArray("nearby", Peers.NearbyIds(position, CreatureNearbyRadius))
                .EndObject();
            Emit("creature.died", writer.ToString());
        }

        public void RaidChanged(RandomEvent? previous, RandomEvent? next, Vector3 position)
        {
            if (previous != null && currentRaid != null)
            {
                JsonWriter ended = new JsonWriter();
                ended.BeginObject()
                    .Property("name", currentRaid)
                    .Property("elapsed_s", Math.Round((DateTime.UtcNow - currentRaidStartedUtc).TotalSeconds, 1))
                    .Property("active_s", Math.Round(previous.m_time, 1))
                    .EndObject();
                Emit("raid.ended", ended.ToString());
                currentRaid = null;
            }

            if (next == null)
            {
                return;
            }

            currentRaid = next.m_name;
            currentRaidStartedUtc = DateTime.UtcNow;
            JsonWriter writer = new JsonWriter();
            writer.BeginObject().Property("name", next.m_name);
            Position(writer, position)
                .Property("biome", BiomeAt(position))
                .Property("duration_s", Math.Round(next.m_duration, 1))
                .StringArray("nearby", Peers.NearbyIds(position, next.m_eventRange))
                .EndObject();
            Emit("raid.started", writer.ToString());
        }
    }
}
