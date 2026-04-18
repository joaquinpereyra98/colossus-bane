import fs from "fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";

/**
 * Folder where the compiled compendium packs should be located relative to the base module folder.
 * @type {string}
 */
const PACK_DEST = "packs";

/**
 * Folder where source JSON files should be located relative to the module folder.
 * @type {string}
 */
const PACK_SRC = "packs/_source";

const argv = yargs(hideBin(process.argv))
  .command({
    command: "package [action] [pack] [entry]",
    describe: "Manage packages",
    builder: (yargs) => {
      yargs.positional("action", {
        describe: "The action to perform.",
        type: "string",
        choices: ["unpack", "pack", "clean"],
      });
      yargs.positional("pack", {
        describe: "Name of the pack upon which to work.",
        type: "string",
      });
      yargs.positional("entry", {
        describe:
          "Name of any entry within a pack upon which to work. Only applicable to extract & clean commands.",
        type: "string",
      });
    },
    handler: async (argv) => {
      const { action, pack, entry } = argv;
      switch (action) {
        case "clean":
          return await cleanPacks(pack, entry);
        case "pack":
          return await compilePacks(pack);
        case "unpack":
          return await extractPacks(pack, entry);
      }
    },
  })
  .help()
  .alias("help", "h").argv;

/**
 * Removes unwanted flags, permissions, and other data from entries before extracting or compiling.
 * @param {object} data                           Data for a single entry to clean.
 * @param {object} [options={}]
 * @param {number} [options.ownership=0]          Value to reset default ownership to.
 */

function cleanPackEntry(data, { ownership = 0 } = {}) {
  if (data.ownership) data.ownership = { default: ownership };
  delete data.flags?.core?.sourceId;
  delete data.flags?.importSource;
  delete data.flags?.exportSource;
  if (parseInt(data.sort) && parseInt(data.sort) !== 0) data.sort = 0;

  // Remove empty entries in flags
  if (!data.flags) data.flags = {};
  Object.entries(data.flags).forEach(([key, contents]) => {
    if (Object.keys(contents).length === 0) delete data.flags[key];
  });

  const cleanCollection = (collName, ownership = 0) => {
    if (data[collName])
      data[collName].forEach((i) => cleanPackEntry(i, { ownership }));
  };

  cleanCollection("pages", -1);
  cleanCollection("categories");
  cleanCollection("results");
  cleanCollection("items");
  cleanCollection("effects");

  if (data.name) data.name = cleanString(data.name);

  // Adjust `_stats`
  if (data._stats) {
    data._stats.lastModifiedBy = "HotpotBuilder000";
    data._stats.exportSource = null;
  }
}

/**
 * Removes invisible whitespace characters and normalizes single- and double-quotes.
 * @param {string} str - The string to be cleaned.
 * @returns {string} - The cleaned string.
 */
function cleanString(str) {
  return str
    .replace(/\u2060/gu, "")
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"');
}

/**
 * Cleans and formats source JSON files, removing unnecessary permissions and flags and adding the proper spacing.
 * @param {string} [packName] - Name of pack to clean. If none provided, all packs will be cleaned.
 * @param {string} [entryName] - Name of a specific entry to clean.
 */
async function cleanPacks(packName, entryName) {
  entryName = entryName?.toLowerCase();
  const folders = fs
    .readdirSync(PACK_SRC, { withFileTypes: true })
    .filter(
      (file) => file.isDirectory() && (!packName || packName === file.name)
    );

  async function* walkDir(directoryPath) {
    const directory = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of directory) {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) yield* walkDir(entryPath);
      else if (path.extname(entry.name) === ".json") yield entryPath;
    }
  }

  for (const folder of folders) {
    console.log(`Cleaning pack ${folder.name}`);
    for await (const src of walkDir(path.join(PACK_SRC, folder.name))) {
      const json = JSON.parse(await readFile(src, { encoding: "utf8" }));
      if (entryName && entryName !== json.name.toLowerCase()) continue;
      if (!json._id || !json._key) {
        console.log(
          `Failed to clean \x1b[31m${src}\x1b[0m, must have _id and _key.`
        );
        continue;
      }
      cleanPackEntry(json);
      fs.rmSync(src, { force: true });
      writeFile(src, `${JSON.stringify(json, null, 2)}\n`, { mode: 0o664 });
    }
  }
}

/**
 * Compile the source JSON files into compendium packs.
 * @param {string} [packName] - Name of pack to compile. If none provided, all packs will be packed.
 */
async function compilePacks(packName) {
  const folders = fs
    .readdirSync(PACK_SRC, { withFileTypes: true })
    .filter(
      (file) => file.isDirectory() && (!packName || packName === file.name)
    );

  for (const folder of folders) {
    const src = path.join(PACK_SRC, folder.name);
    const dest = path.join(PACK_DEST, folder.name);
    console.log(`Compiling pack ${folder.name}`);
    await compilePack(src, dest, {
      recursive: true,
      log: true,
      transformEntry: cleanPackEntry,
    });
  }
}

/**
 * Extract the contents of compendium packs to JSON files.
 * @param {string} [packName] - Name of pack to extract. If none provided, all packs will be unpacked.
 * @param {string} [entryName] - Name of a specific entry to extract.
 */
async function extractPacks(packName, entryName) {
  entryName = entryName?.toLowerCase();
  const manifest = JSON.parse(
    fs.readFileSync("./module.json", { encoding: "utf8" })
  );
  const packs = manifest.packs.filter((p) => !packName || p.name === packName);

  for (const packInfo of packs) {
    const dest = path.join(PACK_SRC, packInfo.name);
    console.log(`Extracting pack ${packInfo.name}`);

    const folders = {};
    await extractPack(path.join(PACK_DEST, packInfo.name), dest, {
      log: false,
      transformEntry: (e) => {
        if (e._key.startsWith("!folders"))
          folders[e._id] = {
            name: slugify(e.name),
            folder: e.folder,
          };
        return false;
      },
    });

    const buildPath = (collection, entry, parentKey) => {
      let parent = collection[entry[parentKey]];
      entry.path = entry.name;
      while (parent) {
        entry.path = path.join(parent.name, entry.path);
        parent = collection[parent[parentKey]];
      }
    };
    Object.values(folders).forEach((f) => buildPath(folders, f, "folder"));

    await extractPack(path.join(PACK_DEST, packInfo.name), dest, {
      log: true,
      clean: true,
      transformEntry: (entry) => {
        if (entryName && entryName !== entry.name.toLowerCase()) return false;
        cleanPackEntry(entry);
      },
      transformName: (entry) => {
        if (entry._id in folders)
          return path.join(folders[entry._id].path, "_folder.json");
        const outputName = slugify(entry.name);
        const parent = folders[entry.folder];
        return path.join(parent?.path ?? "", `${outputName}-${entry._id}.json`);
      },
    });
  }
}

/**
 * Standardize name format.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace("'", "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+|-{2,}/g, "-");
}
