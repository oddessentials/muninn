using System;
using System.Collections.Generic;
using UnityEngine;

namespace GuildTelemetry
{
    internal sealed class PrefabInfo
    {
        public PrefabInfo(string name)
        {
            Name = name;
        }

        public string Name { get; }

        public bool IsPiece { get; set; }

        public bool IsCharacter { get; set; }

        public bool IsPlayer { get; set; }

        public bool IsBoss { get; set; }

        public bool IsRagdoll { get; set; }

        public bool IsAltar { get; set; }

        public string CharacterName { get; set; } = string.Empty;

        public string DefeatKey { get; set; } = string.Empty;

        public string AlertMessage { get; set; } = string.Empty;

        public string BossPrefabName { get; set; } = string.Empty;

        public string CreatureForRagdoll { get; set; } = string.Empty;
    }

    internal sealed class PrefabCatalog
    {
        private readonly Dictionary<int, PrefabInfo> byHash = new Dictionary<int, PrefabInfo>();
        private readonly Dictionary<string, List<int>> hashesByDefeatKey = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, int> hashByAlertMessage = new Dictionary<string, int>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> prefabByCharacterName = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<int, string> creatureByRagdollHash = new Dictionary<int, string>();
        private bool built;

        public bool Ready => built;

        public int Count => byHash.Count;

        public void EnsureBuilt()
        {
            if (built || ZNetScene.instance == null)
            {
                return;
            }

            foreach (GameObject prefab in ZNetScene.instance.m_prefabs)
            {
                if (prefab == null)
                {
                    continue;
                }

                Classify(prefab);
            }

            foreach (KeyValuePair<int, string> pair in creatureByRagdollHash)
            {
                PrefabInfo? ragdoll = Get(pair.Key);
                if (ragdoll != null)
                {
                    ragdoll.CreatureForRagdoll = pair.Value;
                }
            }

            built = true;
        }

        public PrefabInfo? Get(int hash)
        {
            PrefabInfo? info;
            if (byHash.TryGetValue(hash, out info))
            {
                return info;
            }

            if (ZNetScene.instance == null)
            {
                return null;
            }

            GameObject prefab = ZNetScene.instance.GetPrefab(hash);
            if (prefab == null)
            {
                return null;
            }

            return Classify(prefab);
        }

        public string NameOf(int hash)
        {
            PrefabInfo? info = Get(hash);
            return info != null ? info.Name : hash.ToString();
        }

        public List<int> HashesForDefeatKey(string key)
        {
            List<int>? hashes;
            return hashesByDefeatKey.TryGetValue(key, out hashes) ? hashes : new List<int>();
        }

        public bool TryPrefabForAlert(string message, out int hash)
        {
            return hashByAlertMessage.TryGetValue(message, out hash);
        }

        public string PrefabForCharacterName(string characterName)
        {
            string? prefab;
            return prefabByCharacterName.TryGetValue(characterName, out prefab) ? prefab : characterName;
        }

        private PrefabInfo Classify(GameObject prefab)
        {
            int hash = prefab.name.GetStableHashCode();
            PrefabInfo info = new PrefabInfo(prefab.name);
            info.IsPiece = prefab.GetComponent<Piece>() != null;
            info.IsRagdoll = prefab.GetComponent<Ragdoll>() != null;
            Character character = prefab.GetComponent<Character>();
            if (character != null)
            {
                info.IsCharacter = true;
                info.IsPlayer = character is Player;
                info.IsBoss = character.m_boss;
                info.CharacterName = character.m_name ?? string.Empty;
                info.DefeatKey = character.m_defeatSetGlobalKey ?? string.Empty;
                BaseAI ai = prefab.GetComponent<BaseAI>();
                if (ai != null)
                {
                    info.AlertMessage = ai.m_alertedMessage ?? string.Empty;
                }

                if (info.CharacterName.Length > 0 && !prefabByCharacterName.ContainsKey(info.CharacterName))
                {
                    prefabByCharacterName[info.CharacterName] = prefab.name;
                }

                if (info.DefeatKey.Length > 0)
                {
                    List<int>? list;
                    if (!hashesByDefeatKey.TryGetValue(info.DefeatKey, out list))
                    {
                        list = new List<int>();
                        hashesByDefeatKey[info.DefeatKey] = list;
                    }

                    list.Add(hash);
                }

                if (info.IsBoss && info.AlertMessage.Length > 0)
                {
                    hashByAlertMessage[info.AlertMessage] = hash;
                }

                if (character.m_deathEffects != null && character.m_deathEffects.m_effectPrefabs != null)
                {
                    foreach (EffectList.EffectData effect in character.m_deathEffects.m_effectPrefabs)
                    {
                        if (effect != null && effect.m_prefab != null && effect.m_prefab.GetComponent<Ragdoll>() != null)
                        {
                            creatureByRagdollHash[effect.m_prefab.name.GetStableHashCode()] = prefab.name;
                        }
                    }
                }
            }

            OfferingBowl altar = prefab.GetComponent<OfferingBowl>();
            if (altar != null && altar.m_bossPrefab != null)
            {
                info.IsAltar = true;
                info.BossPrefabName = altar.m_bossPrefab.name;
            }

            string? creature;
            if (creatureByRagdollHash.TryGetValue(hash, out creature))
            {
                info.CreatureForRagdoll = creature;
            }

            byHash[hash] = info;
            return info;
        }
    }
}
