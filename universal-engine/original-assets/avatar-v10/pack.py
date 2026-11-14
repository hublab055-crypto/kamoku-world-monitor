"""Pack the six Anime Compact GLBs from the Universal Engine Avatar V10 backup.

Run with the path to the backup's dist/models directory. Original V10 models are
CC0-1.0. Keep the rig, authored colors, game outfits and motion geometry.
"""
import argparse
from copy import deepcopy
import gzip
import json
from pathlib import Path
import struct

PRESETS = {
    "lyra": (.939, .057, .046 * .99, 1.632, 1.587, 1.548),
    "mina": (.939, .046, .046 * 1.08, 1.635, 1.587, 1.550),
    "sera": (.939, .061, .046 * .96, 1.635, 1.587, 1.545),
    "ren": (1, .056, .048 * 1.015, 1.635, 1.584, 1.542),
    "noah": (1, .049, .048 * .99, 1.633, 1.584, 1.545),
    "elio": (1, .053, .048 * 1.06, 1.636, 1.584, 1.542),
}
ANIMATIONS = {"Idle", "Walk", "Run", "Seated", "Wave", "Sleeping", "Eat"}
OUTFITS = {"work", "casual", "space"}
GEOMETRY = {
    "COLOR_0": ("f", "B", 5121, 255, 3),
    "NORMAL": ("f", "b", 5120, 127, 3),
    "JOINTS_0": ("H", "B", 5121, 1, 4),
    "WEIGHTS_0": ("f", "B", 5121, 255, 4),
}


def pack(source, destination, landmarks):
    data = source.read_bytes()
    magic, version, size, json_size, _ = struct.unpack_from("<4sIIII", data)
    if (magic, version, size) != (b"glTF", 2, len(data)):
        raise ValueError(f"Invalid GLB: {source}")
    original = json.loads(data[20:20 + json_size])
    binary = memoryview(data)[28 + json_size:]
    result = {name: deepcopy(original[name]) for name in
              ("asset", "scene", "scenes", "nodes", "skins", "materials")}
    extra = result["asset"]["extras"]
    extra["avatarPack"] = "v10"
    scale, leg_lift, eye_x, eye_y, nose_y, mouth_y = landmarks
    extra["faceLandmarks"] = [scale, leg_lift, eye_x, eye_y, nose_y, mouth_y]
    result["extensionsUsed"] = ["KHR_mesh_quantization"]
    result["extensionsRequired"] = result["extensionsUsed"]
    output = bytearray()
    result.update(accessors=[], bufferViews=[], meshes=[], animations=[])
    accessors = {}

    def accessor_data(index):
        a = original["accessors"][index]
        v = original["bufferViews"][a["bufferView"]]
        if a.get("byteOffset", 0) or v.get("byteStride") or a.get("sparse"):
            raise ValueError("Expected tightly packed preview accessors")
        start = v.get("byteOffset", 0)
        return a, v, binary[start:start + v["byteLength"]]

    def store(accessor, raw, target=None, stride=None):
        while len(output) % 4:
            output.append(0)
        view = {"buffer": 0, "byteOffset": len(output), "byteLength": len(raw)}
        if target:
            view["target"] = target
        if stride:
            view["byteStride"] = stride
        result["bufferViews"].append(view)
        result["accessors"].append({**accessor, "bufferView": len(result["bufferViews"]) - 1})
        output.extend(raw)
        return len(result["accessors"]) - 1

    def copy_accessor(index, semantic=None):
        key = (index, semantic)
        if key in accessors:
            return accessors[key]
        original_acc, view, raw = accessor_data(index)
        a = deepcopy(original_acc)
        stride = None
        if semantic in GEOMETRY:
            source_type, target_type, component, factor, width = GEOMETRY[semantic]
            length = struct.calcsize(source_type) * width
            if len(raw) != a["count"] * length:
                raise ValueError(f"Unexpected {semantic} data")
            rows = struct.iter_unpack("<" + source_type * width, raw)
            # Mesh attributes must be aligned to four bytes inside each vertex.
            format_string = "<" + target_type * width + "x" * (4 - width)
            raw = b"".join(struct.pack(format_string, *(round(x * factor) for x in row)) for row in rows)
            stride = 4
            a["componentType"] = component
            a["normalized"] = semantic != "JOINTS_0"
        accessors[key] = store(a, raw, view.get("target"), stride)
        return accessors[key]

    removed = set()
    for index, node in enumerate(result["nodes"]):
        if "mesh" not in node:
            continue
        outfits = node.get("extras", {}).get("wardrobe", [])
        if outfits and not (OUTFITS & set(outfits)):
            removed.add(index)
            continue
        mesh = deepcopy(original["meshes"][node["mesh"]])
        node["mesh"] = len(result["meshes"])
        names = mesh.get("extras", {}).get("targetNames", [])
        morphs = [names.index(name) for name in ("Blink", "Smile") if name in names]
        if morphs:
            mesh["extras"]["targetNames"] = [names[i] for i in morphs]
            mesh["weights"] = [0] * len(morphs)
        for primitive in mesh["primitives"]:
            primitive["attributes"] = {name: copy_accessor(i, name) for name, i in primitive["attributes"].items()}
            primitive["indices"] = copy_accessor(primitive["indices"])
            if morphs:
                primitive["targets"] = [{"POSITION": copy_accessor(primitive["targets"][i]["POSITION"])}
                                        for i in morphs]
        result["meshes"].append(mesh)
    for index in removed:
        result["nodes"][index].pop("mesh")
    for scene in result["scenes"]:
        scene["nodes"] = [index for index in scene["nodes"] if index not in removed]
    for skin in result["skins"]:
        skin["inverseBindMatrices"] = copy_accessor(skin["inverseBindMatrices"])

    for source_animation in original["animations"]:
        if source_animation["name"] not in ANIMATIONS:
            continue
        animation = deepcopy(source_animation)
        # The editor idles, and a seated player stays in the first seated pose.
        # Ordinary motion retains 20 samples per second from the authored clip.
        interval = 10000 if animation["name"] == "Seated" else 3
        for sampler in animation["samplers"]:
            source_in, _, times = accessor_data(sampler["input"])
            source_out, _, samples = accessor_data(sampler["output"])
            width = len(samples) // source_out["count"]
            indexes = list(range(0, source_in["count"] - 1, interval)) + [source_in["count"] - 1]
            for name, template, raw, size in (("input", source_in, times, 4),
                                                ("output", source_out, samples, width)):
                points = b"".join(raw[index * size:(index + 1) * size] for index in indexes)
                new_index = store({**template, "count": len(indexes)}, points)
                sampler[name] = new_index
        result["animations"].append(animation)

    output.extend(b"\0" * (-len(output) % 4))
    result["buffers"] = [{"byteLength": len(output)}]
    manifest = json.dumps(result, separators=(",", ":"), ensure_ascii=True).encode()
    manifest += b" " * (-len(manifest) % 4)
    header = struct.pack("<4sIIII", b"glTF", 2, 28 + len(manifest) + len(output), len(manifest), 0x4E4F534A)
    glb = header + manifest + struct.pack("<II", len(output), 0x004E4942) + output
    destination.write_bytes(gzip.compress(glb, compresslevel=9, mtime=0))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Path to the backup's dist/models folder")
    args = parser.parse_args()
    for model, landmarks in PRESETS.items():
        pack(args.source / f"anime-{model}-compact.glb", Path(__file__).with_name(f"{model}.glb.gz"), landmarks)
