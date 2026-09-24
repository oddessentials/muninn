using System;
using System.Collections.Generic;
using Splatform;
using UnityEngine;

namespace GuildTelemetry
{
    internal sealed class ObservedHit
    {
        public ObservedHit(HitData.HitType hitType, ZDOID attacker, DateTime atUtc)
        {
            HitType = hitType;
            Attacker = attacker;
            AtUtc = atUtc;
        }

        public HitData.HitType HitType { get; }

        public ZDOID Attacker { get; }

        public DateTime AtUtc { get; }
    }

    internal sealed class PeerState
    {
        public PeerState(ZNetPeer peer, string platformUserId, string displayId, string platform)
        {
            Peer = peer;
            Uid = peer.m_uid;
            Name = peer.m_playerName ?? string.Empty;
            PlayfabId = string.IsNullOrEmpty(peer.m_playfabId) ? null : peer.m_playfabId;
            HostName = peer.m_socket != null ? peer.m_socket.GetHostName() : string.Empty;
            PlatformUserId = platformUserId;
            DisplayId = displayId;
            Platform = platform;
            JoinedAtUtc = DateTime.UtcNow;
            CharacterId = ZDOID.None;
        }

        public ZNetPeer Peer { get; }

        public long Uid { get; }

        public string Name { get; }

        public string? PlayfabId { get; }

        public string HostName { get; }

        public string PlatformUserId { get; }

        public string DisplayId { get; }

        public string Platform { get; }

        public DateTime JoinedAtUtc { get; }

        public ZDOID CharacterId { get; set; }

        public long PlayerId => Peer.m_playerID;

        public long ProfileId
        {
            get
            {
                ZDO? character = CharacterId.IsNone() || ZDOMan.instance == null ? null : ZDOMan.instance.GetZDO(CharacterId);
                return character != null ? character.GetLong(ZDOVars.s_playerID, 0L) : 0L;
            }
        }

        public bool Spawned { get; set; }

        public string LastBiome { get; set; } = "None";

        public bool HasLastPosition { get; set; }

        public Vector3 LastPosition { get; set; }

        public double DistanceSinceHeartbeat { get; set; }

        public ObservedHit? LastHit { get; set; }

        public DateTime LastDeathUtc { get; set; } = DateTime.MinValue;

        public bool Graceful { get; set; }

        public bool Kicked { get; set; }

        public Vector3 Position => Peer.m_refPos;

        public double SessionSeconds => (DateTime.UtcNow - JoinedAtUtc).TotalSeconds;
    }

    internal sealed class PeerTracker
    {
        private readonly Dictionary<long, PeerState> peers = new Dictionary<long, PeerState>();

        public IEnumerable<PeerState> All => peers.Values;

        public int Count => peers.Count;

        public PeerState? Get(long uid)
        {
            PeerState? state;
            return peers.TryGetValue(uid, out state) ? state : null;
        }

        public PeerState Register(ZNetPeer peer)
        {
            PeerState? existing = Get(peer.m_uid);
            if (existing != null)
            {
                return existing;
            }

            string hostName = peer.m_socket != null ? peer.m_socket.GetHostName() : string.Empty;
            PlatformUserID platformId = ResolvePlatformId(hostName, peer.m_uid);
            string platformUserId = platformId.IsValid ? platformId.ToString() : "Unknown_" + peer.m_uid;
            string displayId = platformId.IsValid ? PlatformUserID.FilterPlatformUserID(platformId).ToString() : platformUserId;
            string platform = platformId.IsValid ? platformId.m_platform.ToString() : "Steam";
            PeerState state = new PeerState(peer, platformUserId, displayId, platform);
            peers[peer.m_uid] = state;
            return state;
        }

        public void Remove(long uid)
        {
            peers.Remove(uid);
        }

        public PeerState? ByCharacter(ZDOID characterId)
        {
            if (characterId.IsNone())
            {
                return null;
            }

            foreach (PeerState state in peers.Values)
            {
                if (state.CharacterId == characterId)
                {
                    return state;
                }
            }

            return null;
        }

        public PeerState? ByProfileId(long profileId)
        {
            if (profileId == 0)
            {
                return null;
            }

            foreach (PeerState state in peers.Values)
            {
                if (state.ProfileId == profileId)
                {
                    return state;
                }
            }

            return null;
        }

        public List<string> NearbyIds(Vector3 point, float radius)
        {
            List<string> ids = new List<string>();
            foreach (PeerState state in peers.Values)
            {
                if (state.CharacterId.IsNone())
                {
                    continue;
                }

                if (DistanceXZ(state.Position, point) <= radius)
                {
                    ids.Add(state.PlatformUserId);
                }
            }

            return ids;
        }

        public static float DistanceXZ(Vector3 a, Vector3 b)
        {
            float dx = a.x - b.x;
            float dz = a.z - b.z;
            return Mathf.Sqrt(dx * dx + dz * dz);
        }

        private static PlatformUserID ResolvePlatformId(string hostName, long uid)
        {
            if (string.IsNullOrEmpty(hostName))
            {
                return PlatformUserID.None;
            }

            if (ZNet.m_onlineBackend == OnlineBackendType.Steamworks)
            {
                return new PlatformUserID(new Platform("Steam"), hostName);
            }

            PlatformUserID parsed;
            if (PlatformUserID.TryParse(hostName, out parsed) && parsed.IsValid)
            {
                return parsed;
            }

            return uid == 0 ? PlatformUserID.None : new PlatformUserID(new Platform("Steam"), hostName);
        }
    }
}
