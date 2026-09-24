using System;
using System.Collections.Generic;
using System.Reflection;
using HarmonyLib;
using UnityEngine;

namespace GuildTelemetry
{
    internal static class Hooks
    {
        private static Telemetry? telemetry;
        private static int onDeathHash;
        private static int damageHash;
        private static int showMessageHash;
        private static int spawnBossHash;
        private static int chatMessageHash;
        private static int sayHash;
        private static int registerKillHash;
        private static ZDOID characterBeforeRpc = ZDOID.None;

        public static List<string> Install(Harmony harmony, Telemetry target)
        {
            telemetry = target;
            onDeathHash = "OnDeath".GetStableHashCode();
            damageHash = "RPC_Damage".GetStableHashCode();
            showMessageHash = "ShowMessage".GetStableHashCode();
            spawnBossHash = "RPC_SpawnBoss".GetStableHashCode();
            chatMessageHash = "ChatMessage".GetStableHashCode();
            sayHash = "Say".GetStableHashCode();
            registerKillHash = "RPC_RegisterKill".GetStableHashCode();
            List<string> missing = new List<string>();
            Type self = typeof(Hooks);
            Patch(harmony, missing, typeof(ZNet), "RPC_PeerInfo", new[] { typeof(ZRpc), typeof(ZPackage) }, null, self.GetMethod(nameof(AfterPeerInfo), BindingFlags.Static | BindingFlags.NonPublic));
            Patch(harmony, missing, typeof(ZNet), "RPC_CharacterID", new[] { typeof(ZRpc), typeof(ZDOID) }, self.GetMethod(nameof(BeforeCharacterId), BindingFlags.Static | BindingFlags.NonPublic), self.GetMethod(nameof(AfterCharacterId), BindingFlags.Static | BindingFlags.NonPublic));
            Patch(harmony, missing, typeof(ZNet), "RPC_Disconnect", new[] { typeof(ZRpc) }, self.GetMethod(nameof(BeforeRpcDisconnect), BindingFlags.Static | BindingFlags.NonPublic), null);
            Patch(harmony, missing, typeof(ZNet), "InternalKick", new[] { typeof(ZNetPeer) }, self.GetMethod(nameof(BeforeKick), BindingFlags.Static | BindingFlags.NonPublic), null);
            Patch(harmony, missing, typeof(ZNet), "Disconnect", new[] { typeof(ZNetPeer) }, self.GetMethod(nameof(BeforeDisconnect), BindingFlags.Static | BindingFlags.NonPublic), null);
            Patch(harmony, missing, typeof(ZNet), "Shutdown", new[] { typeof(bool) }, self.GetMethod(nameof(BeforeShutdown), BindingFlags.Static | BindingFlags.NonPublic), null);
            Patch(harmony, missing, typeof(ZoneSystem), "RPC_SetGlobalKey", new[] { typeof(long), typeof(string) }, self.GetMethod(nameof(BeforeSetGlobalKey), BindingFlags.Static | BindingFlags.NonPublic), null);
            Patch(harmony, missing, typeof(RandEventSystem), "SetRandomEvent", new[] { typeof(RandomEvent), typeof(Vector3) }, self.GetMethod(nameof(BeforeSetRandomEvent), BindingFlags.Static | BindingFlags.NonPublic), null);
            Patch(harmony, missing, typeof(ZRoutedRpc), "RPC_RoutedRPC", new[] { typeof(ZRpc), typeof(ZPackage) }, self.GetMethod(nameof(BeforeRoutedRpc), BindingFlags.Static | BindingFlags.NonPublic), null);
            Patch(harmony, missing, typeof(ZRoutedRpc), "InvokeRoutedRPC", new[] { typeof(long), typeof(ZDOID), typeof(string), typeof(object[]) }, self.GetMethod(nameof(BeforeInvokeRoutedRpc), BindingFlags.Static | BindingFlags.NonPublic), null);
            Patch(harmony, missing, typeof(ZDOMan), "CreateNewZDO", new[] { typeof(ZDOID), typeof(Vector3), typeof(int) }, null, self.GetMethod(nameof(AfterCreateNewZdo), BindingFlags.Static | BindingFlags.NonPublic));
            Patch(harmony, missing, typeof(ZDO), "Deserialize", new[] { typeof(ZPackage) }, null, self.GetMethod(nameof(AfterZdoDeserialize), BindingFlags.Static | BindingFlags.NonPublic));
            try
            {
                ZNet.WorldSaveStarted += OnWorldSaveStarted;
                ZNet.WorldSaveFinished += OnWorldSaveFinished;
            }
            catch (Exception exception)
            {
                missing.Add("ZNet.WorldSaveStarted");
                GuildTelemetryPlugin.Log.LogWarning("GuildTelemetry: save events unavailable: " + exception.Message);
            }

            return missing;
        }

        public static void Uninstall()
        {
            ZNet.WorldSaveStarted -= OnWorldSaveStarted;
            ZNet.WorldSaveFinished -= OnWorldSaveFinished;
        }

        private static bool destroyHooked;

        public static void EnsureDestroyHook()
        {
            if (destroyHooked || ZDOMan.instance == null)
            {
                return;
            }

            ZDOMan.instance.m_onZDODestroyed += OnZdoDestroyed;
            destroyHooked = true;
        }

        private static void Patch(Harmony harmony, List<string> missing, Type type, string name, Type[] parameters, MethodInfo? prefix, MethodInfo? postfix)
        {
            string label = type.Name + "." + name;
            try
            {
                MethodInfo original = AccessTools.Method(type, name, parameters);
                if (original == null)
                {
                    missing.Add(label);
                    GuildTelemetryPlugin.Log.LogWarning("GuildTelemetry: hook target missing: " + label);
                    return;
                }

                harmony.Patch(original, prefix != null ? new HarmonyMethod(prefix) : null, postfix != null ? new HarmonyMethod(postfix) : null);
            }
            catch (Exception exception)
            {
                missing.Add(label);
                GuildTelemetryPlugin.Log.LogWarning("GuildTelemetry: hook failed for " + label + ": " + exception.Message);
            }
        }

        private static void Guard(string hook, Action action)
        {
            try
            {
                if (telemetry != null)
                {
                    action();
                }
            }
            catch (Exception exception)
            {
                GuildTelemetryPlugin.Log.LogWarning("GuildTelemetry: " + hook + " failed: " + exception);
            }
        }

        private static void AfterPeerInfo(ZNet __instance, ZRpc rpc)
        {
            Guard("RPC_PeerInfo", () =>
            {
                if (!__instance.IsServer())
                {
                    return;
                }

                ZNetPeer peer = __instance.GetPeer(rpc);
                if (peer != null && peer.IsReady() && telemetry!.Peers.Get(peer.m_uid) == null)
                {
                    telemetry.PeerJoined(peer);
                }
            });
        }

        private static void BeforeCharacterId(ZNet __instance, ZRpc rpc)
        {
            Guard("RPC_CharacterID prefix", () =>
            {
                ZNetPeer peer = __instance.GetPeer(rpc);
                characterBeforeRpc = peer != null ? peer.m_characterID : ZDOID.None;
            });
        }

        private static void AfterCharacterId(ZNet __instance, ZRpc rpc, ZDOID characterID)
        {
            Guard("RPC_CharacterID", () =>
            {
                ZNetPeer peer = __instance.GetPeer(rpc);
                if (peer == null)
                {
                    return;
                }

                PeerState? state = telemetry!.Peers.Get(peer.m_uid);
                if (state == null)
                {
                    return;
                }

                if (!characterID.IsNone())
                {
                    if (state.CharacterId != characterID)
                    {
                        telemetry.PeerSpawned(state, characterID);
                    }

                    return;
                }

                if (!characterBeforeRpc.IsNone())
                {
                    telemetry.PeerDied(state);
                    state.CharacterId = ZDOID.None;
                }
            });
        }

        private static void BeforeRpcDisconnect(ZNet __instance, ZRpc rpc)
        {
            Guard("RPC_Disconnect", () =>
            {
                ZNetPeer peer = __instance.GetPeer(rpc);
                PeerState? state = peer != null ? telemetry!.Peers.Get(peer.m_uid) : null;
                if (state != null)
                {
                    state.Graceful = true;
                }
            });
        }

        private static void BeforeKick(ZNetPeer peer)
        {
            Guard("InternalKick", () =>
            {
                PeerState? state = peer != null ? telemetry!.Peers.Get(peer.m_uid) : null;
                if (state != null)
                {
                    state.Kicked = true;
                }
            });
        }

        private static void BeforeDisconnect(ZNetPeer peer)
        {
            Guard("Disconnect", () =>
            {
                PeerState? state = peer != null ? telemetry!.Peers.Get(peer.m_uid) : null;
                if (state == null)
                {
                    return;
                }

                string reason = state.Kicked ? "kicked" : state.Graceful ? "disconnect" : "timeout";
                telemetry!.PeerLeft(state, reason);
            });
        }

        private static void BeforeShutdown()
        {
            Guard("Shutdown", () => telemetry!.Stopping());
        }

        private static void OnWorldSaveStarted()
        {
            Guard("WorldSaveStarted", () => telemetry!.SaveStarted());
        }

        private static void OnWorldSaveFinished()
        {
            Guard("WorldSaveFinished", () => telemetry!.SaveFinished());
        }

        private static void BeforeSetGlobalKey(long sender, string name)
        {
            Guard("RPC_SetGlobalKey", () => telemetry!.GlobalKey(sender, name));
        }

        private static void BeforeSetRandomEvent(RandEventSystem __instance, RandomEvent ev, Vector3 pos)
        {
            Guard("SetRandomEvent", () =>
            {
                if (ZNet.instance == null || !ZNet.instance.IsServer())
                {
                    return;
                }

                telemetry!.RaidChanged(__instance.m_randomEvent, ev, pos);
            });
        }

        private static void BeforeRoutedRpc(ZPackage pkg)
        {
            Guard("RPC_RoutedRPC", () =>
            {
                int position = pkg.GetPos();
                ZRoutedRpc.RoutedRPCData data = new ZRoutedRpc.RoutedRPCData();
                data.Deserialize(pkg);
                pkg.SetPos(position);
                HandleRouted(data);
            });
        }

        private static void BeforeInvokeRoutedRpc(long targetPeerID, ZDOID targetZDO, string methodName, object[] parameters)
        {
            Guard("InvokeRoutedRPC", () =>
            {
                if (methodName != "ChatMessage" || parameters.Length < 4)
                {
                    return;
                }

                Vector3 position = parameters[0] is Vector3 ? (Vector3)parameters[0] : Vector3.zero;
                int type = parameters[1] is int ? (int)parameters[1] : 0;
                UserInfo? user = parameters[2] as UserInfo;
                string text = parameters[3] as string ?? string.Empty;
                string kind = type == 3 ? "ping" : type == 2 ? "shout" : "say";
                telemetry!.Chat(0, kind, kind == "ping" ? null : text, position, user != null && user.UserId.IsValid ? user.UserId.ToString() : null);
            });
        }

        private static void HandleRouted(ZRoutedRpc.RoutedRPCData data)
        {
            int hash = data.m_methodHash;
            ZPackage parameters = data.m_parameters;
            parameters.SetPos(0);
            if (hash == onDeathHash)
            {
                PeerState? victim = telemetry!.Peers.ByCharacter(data.m_targetZDO);
                if (victim != null)
                {
                    telemetry.PeerDied(victim);
                }

                return;
            }

            if (hash == damageHash)
            {
                PeerState? target = telemetry!.Peers.ByCharacter(data.m_targetZDO);
                if (target != null)
                {
                    HitData hit = new HitData();
                    hit.Deserialize(ref parameters);
                    telemetry.RecordHit(target, hit);
                }

                return;
            }

            if (hash == showMessageHash)
            {
                parameters.ReadInt();
                string text = parameters.ReadString();
                telemetry!.BossAlert(data.m_senderPeerID, text);
                return;
            }

            if (hash == spawnBossHash)
            {
                Vector3 point = parameters.ReadVector3();
                telemetry!.BossSummonRpc(data.m_senderPeerID, data.m_targetZDO, point);
                return;
            }

            if (hash == chatMessageHash)
            {
                Vector3 position = parameters.ReadVector3();
                int type = parameters.ReadInt();
                UserInfo user = new UserInfo();
                user.Deserialize(ref parameters);
                string text = parameters.ReadString();
                string kind = type == 3 ? "ping" : type == 2 ? "shout" : "say";
                telemetry!.Chat(data.m_senderPeerID, kind, kind == "ping" ? null : text, position, user.UserId.IsValid ? user.UserId.ToString() : null);
                return;
            }

            if (hash == sayHash)
            {
                int type = parameters.ReadInt();
                UserInfo user = new UserInfo();
                user.Deserialize(ref parameters);
                string text = parameters.ReadString();
                string kind = type == 2 ? "shout" : "say";
                telemetry!.Chat(data.m_senderPeerID, kind, text, null, user.UserId.IsValid ? user.UserId.ToString() : null);
                return;
            }

            if (hash == registerKillHash)
            {
                string enemyName = parameters.ReadString();
                telemetry!.KillCredited(data.m_targetPeerID, enemyName);
            }
        }

        private static void AfterCreateNewZdo(ZDOID uid, int prefabHashIn)
        {
            Guard("CreateNewZDO", () => telemetry!.ZdoCreated(uid, prefabHashIn));
        }

        private static void AfterZdoDeserialize(ZDO __instance)
        {
            Guard("ZDO.Deserialize", () => telemetry!.ZdoDeserialized(__instance));
        }

        private static void OnZdoDestroyed(ZDO zdo)
        {
            Guard("ZDO destroyed", () => telemetry!.ZdoDestroyed(zdo));
        }
    }
}
