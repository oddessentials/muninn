![Muninn: a live website for your guild's Valheim server](https://raw.githubusercontent.com/oddessentials/muninn/main/site/assets/banner.jpg)

Muninn gives your Valheim guild its own website. This plugin runs on the dedicated server and reports what happens in the world to your guild's Muninn site. Players install nothing.

![The Muninn dashboard](https://raw.githubusercontent.com/oddessentials/muninn/main/site/assets/dashboard.jpg)

## Only in Muninn

- **World clock**: the in-game day and hour on a bronze dial, live from the server, in its own pop-out window if you like.
- **Zone leader**: each player measures their machine in the browser, and the guild sees who should host the fight.
- **Comfort planner**: every comfort piece from the game your server runs, with icons and recipes; it adds up comfort, Rested time and materials.

![The comfort planner](https://raw.githubusercontent.com/oddessentials/muninn/main/site/assets/comfort-planner.jpg)

Also: who is online, bosses, raids, deaths, structures, the world map, the activity feed and chat.

## Install

This plugin only works with a Muninn site.

1. Deploy the site: https://oddessentials.github.io/muninn/
2. Open `/admin` on your site, set the password, and download `com.guildsite.telemetry.cfg` from the Plugin page.
3. Install this package on the server with BepInExPack_Valheim, or copy `GuildTelemetry.dll` to `BepInEx/plugins/`.
4. Put the config in `BepInEx/config/` and restart the server. The Plugin page shows when it first reports in.

## What it sends

Only to the address in its config, signed with the secret from your site:

- Server starts, stops and heartbeats, world saves and global keys
- Players joining, spawning and leaving, with their platform id (for example a Steam id) and character name
- Deaths, creatures killed near players, biome changes and each online player's position every 20 seconds
- Boss summons, fights and defeats, raids, and structures built and destroyed
- Chat messages
- The world's biome map image and the comfort pieces of the running game

It also shows the site admins' announcements in game. Site admins can hide chat, positions, the map and platform ids on the site.

Source and licence (MIT): https://github.com/oddessentials/muninn
