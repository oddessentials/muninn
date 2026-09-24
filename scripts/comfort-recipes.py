import argparse
import csv
import io
import json
import os

import UnityPy
from PIL import Image
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator

CELL = 64
GUTTER = 2
COLUMNS = 16
QUALITY = 80
ALPHA_QUALITY = 90
STATUS_EFFECTS = ("Resting", "Rested", "Shelter", "CampFire")
DATA_FILES = ("globalgamemanagers", "globalgamemanagers.assets", "resources.assets", "level0", "sharedassets0.assets")
REPOSITORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(REPOSITORY, "web", "src", "lib", "world")


def data_directory(game_root):
    for entry in sorted(os.listdir(game_root)):
        path = os.path.join(game_root, entry)
        if entry.endswith("_Data") and os.path.isdir(os.path.join(path, "StreamingAssets")):
            return path
    raise SystemExit(f"no Unity data directory under {game_root}")


def load(game_root):
    data = data_directory(game_root)
    bundles = os.path.join(data, "StreamingAssets", "SoftRef", "Bundles")
    files = [os.path.join(bundles, name) for name in sorted(os.listdir(bundles))]
    files += [os.path.join(data, name) for name in DATA_FILES if os.path.exists(os.path.join(data, name))]
    environment = UnityPy.load(*files)
    unity = next(
        file.unity_version
        for file in environment.files.values()
        if isinstance(getattr(file, "unity_version", None), str) and file.unity_version
    )
    generator = TypeTreeGenerator(unity)
    generator.load_local_game(game_root)
    environment.typetree_generator = generator
    return environment


def is_null(pointer):
    return pointer is None or pointer.path_id == 0


def script_of(behaviour):
    try:
        return behaviour.m_Script.read().m_ClassName
    except Exception:
        return None


def behaviour_of(game_object, script):
    for pair in game_object.m_Component:
        pointer = pair.component if hasattr(pair, "component") else pair[1]
        reader = pointer.deref()
        if reader.type.name != "MonoBehaviour":
            continue
        behaviour = reader.read()
        if script_of(behaviour) == script:
            return behaviour
    return None


def managers(environment):
    found = {}
    for reader in environment.objects:
        if reader.type.name != "MonoBehaviour":
            continue
        try:
            behaviour = reader.read()
        except Exception:
            continue
        script = script_of(behaviour)
        if script in ("ZNetScene", "ObjectDB") and script not in found:
            found[script] = behaviour
            if len(found) == 2:
                return found["ZNetScene"], found["ObjectDB"]
    raise SystemExit("ZNetScene or ObjectDB not found")


def english(environment):
    names = {}
    for reader in environment.objects:
        if reader.type.name != "TextAsset":
            continue
        asset = reader.read()
        if not asset.m_Name.lower().startswith("localization"):
            continue
        text = asset.m_Script if isinstance(asset.m_Script, str) else asset.m_Script.decode("utf-8", "replace")
        rows = csv.reader(io.StringIO(text))
        header = next(rows, None)
        if not header:
            continue
        column = header.index("English") if "English" in header else 1
        for row in rows:
            if len(row) > column and row[0] and not row[0].startswith("//"):
                names.setdefault(row[0], row[column])
    return names


def translate(names, token):
    return names.get(token.lstrip("$"), token) if token else ""


def sprite(pointer):
    image = pointer.read().image.convert("RGBA")
    if image.width > CELL or image.height > CELL:
        image.thumbnail((CELL, CELL), Image.LANCZOS)
    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("game_root")
    parser.add_argument("game_version")
    arguments = parser.parse_args()

    environment = load(arguments.game_root)
    scene, objectdb = managers(environment)
    names = english(environment)

    prefabs = {}
    for pointer in scene.m_prefabs:
        if not is_null(pointer):
            game_object = pointer.read()
            prefabs.setdefault(game_object.m_Name, game_object)

    items = {}
    buildable = set()
    for name, game_object in prefabs.items():
        item = behaviour_of(game_object, "ItemDrop")
        if item is None:
            continue
        items[name] = item
        table = item.m_itemData.m_shared.m_buildPieces
        if is_null(table):
            continue
        for piece in table.read().m_pieces:
            if not is_null(piece):
                buildable.add(piece.read().m_Name)

    icons = {}
    stations = {}
    materials = {}
    pieces = {}
    for name in sorted(buildable, key=str.lower):
        if name in items or name not in prefabs:
            continue
        piece = behaviour_of(prefabs[name], "Piece")
        if piece is None or piece.m_comfort <= 0:
            continue
        station = None
        if not is_null(piece.m_craftingStation):
            crafting = piece.m_craftingStation.read()
            station = crafting.m_GameObject.read().m_Name
            if station not in stations:
                stations[station] = translate(names, crafting.m_name)
                icons[f"station:{station}"] = sprite(crafting.m_icon)
        recipe = []
        for requirement in piece.m_resources:
            if is_null(requirement.m_resItem):
                continue
            drop = requirement.m_resItem.read()
            material = drop.m_GameObject.read().m_Name
            if material not in materials:
                shared = drop.m_itemData.m_shared
                materials[material] = translate(names, shared.m_name)
                icons[f"item:{material}"] = sprite(shared.m_icons[0])
            recipe.append({"item": material, "amount": requirement.m_amount})
        pieces[name] = {
            "station": station,
            "materials": recipe,
            "description": translate(names, piece.m_description),
        }
        icons[f"piece:{name}"] = sprite(piece.m_icon)

    for pointer in objectdb.m_StatusEffects:
        effect = pointer.read()
        if effect.m_Name in STATUS_EFFECTS:
            icons[f"status:{effect.m_Name}"] = sprite(effect.m_icon)

    keys = sorted(icons, key=str.lower)
    rows = (len(keys) + COLUMNS - 1) // COLUMNS
    pitch = CELL + 2 * GUTTER
    atlas = Image.new("RGBA", (COLUMNS * pitch, rows * pitch), (0, 0, 0, 0))
    for index, key in enumerate(keys):
        image = icons[key]
        left = (index % COLUMNS) * pitch + GUTTER + (CELL - image.width) // 2
        top = (index // COLUMNS) * pitch + GUTTER + (CELL - image.height) // 2
        atlas.paste(image, (left, top))
    atlas.save(
        os.path.join(OUTPUT, "comfort-icons.webp"),
        "WEBP",
        quality=QUALITY,
        alpha_quality=ALPHA_QUALITY,
        method=6,
    )

    document = {
        "game_version": arguments.game_version,
        "atlas": {"cell": CELL, "gutter": GUTTER, "columns": COLUMNS, "rows": rows},
        "icons": {key: index for index, key in enumerate(keys)},
        "stations": dict(sorted(stations.items(), key=lambda entry: entry[0].lower())),
        "materials": dict(sorted(materials.items(), key=lambda entry: entry[0].lower())),
        "pieces": pieces,
    }
    with open(os.path.join(OUTPUT, "comfort-recipes.json"), "w", encoding="utf-8", newline="\n") as file:
        json.dump(document, file, indent=2, ensure_ascii=False)
        file.write("\n")
    print(f"{len(pieces)} pieces, {len(materials)} materials, {len(stations)} stations, {len(keys)} icons")


if __name__ == "__main__":
    main()
