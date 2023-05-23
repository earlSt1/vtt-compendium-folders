"use strict";
import { FICUtils, FICFolderAPI } from "./fic-folders.js";
import { SidebarMigration } from "./migrateSidebar.js";
export const modName = "Compendium Folders";
const mod = "compendium-folders";
const FOLDER_LIMIT = 8;
const TEMP_ENTITY_NAME = "#[CF_tempEntity]";
const FOLDER_SEPARATOR = "#/CF_SEP/";

// ==========================
// Folder object structure
// ==========================
function defineClasses() {
    class CompendiumEntryCollection extends WorldCollection {
        constructor(...args) {
            super(...args);
        }
        /** @override */
        get entity() {
            return "CompendiumEntry";
        }
        get documentClass() {
            return game.CF.CompendiumEntry;
        }
    }
    class CompendiumEntry {
        constructor(pc, parentId) {
            this._id = pc;
            this.data = {};
            this.data.code = pc;
            this.data.folder = parentId;
            if (!game.customFolders) {
                game.customFolders = new Map();
            }
            if (!game.customFolders.compendium) {
                game.customFolders.compendium = {
                    entries: new game.CF.CompendiumEntryCollection([]),
                    folders: new game.CF.CompendiumFolderCollection([]),
                };
            }
            game.customFolders.compendium.entries.set(this._id, this);
        }
        static get metadata() {
            return {
                collection: "game.customFolders.compendium.entries",
            };
        }
        toJSON() {
            return this.data;
        }
        toObject() {
            return this.data;
        }
        /** @override */
        static create(data = {}) {
            let newEntry = new CompendiumEntry(data);

            return newEntry;
        }
        get packCode() {
            return this.data.code;
        }
        get pack() {
            return game.packs.get(this.data.code);
        }
        get parent() {
            return game.CF.CompendiumFolder.collection.get(this.data.folder);
        }
        get folder() {
            return this.parent;
        }
        set folder(f) {
            this.data.folder = f;
        }
        get all() {
            return [...game?.customFolders?.compendium?.entries];
        }
        get id() {
            return this.data.code;
        }
        get visible() {
            return game.user.isGM || !this.pack.private;
        }
        get name() {
            return this.pack.title;
        }
    }
    let extendedClass = WorldCollection;
    class CompendiumFolderCollection extends extendedClass {
        constructor(...args) {
            super(...args);
        }
        /** @override */
        get entity() {
            return "CompendiumFolder";
        }
        get hidden() {
            return this.find((f) => f.isHidden);
        }
        get default() {
            return this.find((f) => f.isDefault);
        }
        get documentClass() {
            return game.CF.CompendiumFolder;
        }
    }

    class CompendiumFolder {
        constructor(data = {}) {
            this.data = mergeObject(
                {
                    titleText: "New Folder",
                    colorText: "#000000",
                    fontColorText: "#FFFFFF",
                    type: "CompendiumEntry",
                    _id: "cfolder_" + randomID(10),
                    entity: "CompendiumFolder",
                    sorting: "a",
                    parent: null,
                    pathToFolder: [],
                    compendiumList: [],
                    compendiums: [],
                    folderIcon: null,
                    expanded: false,
                    visible: true,
                    children: [],
                },
                data
            );
        }
        _getSaveData() {
            let data = Object.assign({}, this.data);
            delete data.compendiums;
            delete data.content;
            delete data.children;
            return data;
        }
        toJSON() {
            return this.data;
        }
        toObject() {
            return this.data;
        }
        /** @override */
        static create(data = {}) {
            let newFolder = new CompendiumFolder(data);
            if (!game.customFolders) {
                game.customFolders = new Map();
            }
            if (!game.customFolders.compendium) {
                game.customFolders.compendium = {
                    entries: new game.CF.CompendiumEntryCollection([]),
                    folders: new game.CF.CompendiumFolderCollection([]),
                };
            }
            game.customFolders.compendium.folders.set(newFolder.id, newFolder);

            return newFolder;
        }
        static import(data = {}, compendiums) {
            if (data?.pathToFolder?.length > 0) {
                data.parent = data.pathToFolder[data.pathToFolder.length - 1];
            }
            if (compendiums) {
                data.compendiums = compendiums;
            } else {
                data.compendiums = [];
            }
            return CompendiumFolder.create(data);
        }
        // Update using data
        async update(data = this.data, refresh = true) {
            this.data = mergeObject(data, this.data);
            // Update game folder
            this.collection.get(this.id).data = this.data;
            await this.save(refresh);
        }
        // Save object state to game.customFolders and settings
        async save(refresh = true) {
            if (!this.collection.get(this.id)) {
                this.collection.set(this.id, this);
            }
            if (game.user.isGM) {
                let allFolders = game.settings.get(mod, "cfolders");
                let currentFolder = allFolders[this.id];
                if (!currentFolder) {
                    // create folder
                    allFolders[this.id] = this._getSaveData();
                } else {
                    allFolders[this.id] = mergeObject(currentFolder, this._getSaveData());
                }
                await game.settings.set(mod, "cfolders", allFolders);
            }
            game.customFolders.compendium.folders.get(this.id).data = Object.assign({}, this.data);
            if (refresh) {
                await initFolders(false);
                ui.compendium.render(true);
            }
        }
        async delete(refresh = true) {
            let nextFolder = this.parent ? this.parent : this.collection.default;
            for (let pack of this.compendiumList) {
                await nextFolder.addCompendium(pack);
            }

            for (let child of this.children) {
                if (this.parent) {
                    await child.moveFolder(this.parent.id, false);
                } else {
                    await child.moveToRoot();
                }
            }

            if (this.collection.get(this.id)) {
                this.collection.delete(this.id);
            }

            let allFolders = game.settings.get(mod, "cfolders");
            // create folder
            delete allFolders[this.id];

            await game.settings.set(mod, "cfolders", allFolders);
            if (refresh) ui.compendium.render(true);
        }
        async addCompendium(packCode, refresh = true) {
            let entry = game.customFolders.compendium.entries.get(packCode);
            if (entry) {
                //Move from old entry to new entry
                let oldParent = entry.parent;
                this._addPack(entry);
                if (oldParent) {
                    oldParent._removePack(entry);
                    await oldParent.save(false);
                }
                game.customFolders.compendium.entries.set(packCode, entry);
            } else {
                //Create entry and assign to this obj
                entry = new game.CF.CompendiumEntry(packCode, this.id);
                //game.customFolders.compendium.entries.insert(entry);
                this._addPack(entry);
            }
            //update(entry.data);
            await this.save(refresh);
        }
        async removeCompendium(pack, del = false, refresh = true) {
            this._removePack(pack, del);
            if (del) {
                game.customFolders.compendium.entries.delete(pack.packCode);
            } else {
                let entry = game.customFolders.compendium.entries.get(pack.packCode);
                let hiddenFolder = this.collection.hidden;
                hiddenFolder._addPack(entry);
                await hiddenFolder.save(false);
            }
            await this.save(refresh);
        }
        async removeCompendiumByCode(packCode, del = false, refresh = true) {
            await this.removeCompendium(game.customFolders.compendium.entries.get(packCode), del, refresh);
        }
        async moveFolder(destId, updateParent = true) {
            let destFolder = this.collection.get(destId);
            await this._moveToFolder(destFolder, updateParent);
        }
        async moveToRoot() {
            this.path = [];
            this.parent = null;
            await this._updatePath();
            await this.save(false);
        }
        _addPack(pack) {
            if (!this.data.compendiumList.includes(pack.packCode)) {
                this.content = this.content.concat(pack);
                this.data.compendiumList = this.data.compendiumList.concat(pack.packCode);
            }
            pack.folder = this.id;
        }
        _removePack(pack, del = false) {
            this.data.compendiumList = this.data.compendiumList.filter((x) => x != pack.packCode);
            this.content = this.content.filter((x) => x.packCode != pack.packCode);
            if (del && pack.folder) pack.folder = null;
        }
        _removeFolder(child) {
            this.children = this.children.filter((c) => c.id != child.id);
        }
        async _moveToFolder(destFolder, updateParent = true) {
            this.path = destFolder ? destFolder.path.concat(destFolder.id) : [];
            if (this.parent && updateParent) {
                this.parent._removeFolder(this);
                await this.parent.save(false);
            }
            if (destFolder) {
                this.parent = destFolder.id;
                this.parent.children = this.parent.children.concat(this);
                await this.parent.save(false);
                this.path = this.parent.path.concat(destFolder.id);
            } else {
                this.parent = null;
                this.path = [];
            }

            await this.save(false);

            await this._updatePath();
            ui.compendium.refresh();
        }
        // Update path of this and all child folders
        async _updatePath(currentFolder = this, parent = this) {
            if (currentFolder.id != parent.id) {
                currentFolder.path = parent.path.concat(parent.id);
                await currentFolder.update(currentFolder.data, false);
            }
            if (currentFolder.children) {
                for (let child of currentFolder.children) {
                    child._updatePath(child, currentFolder);
                }
            }
        }
        /** @override */
        get collection() {
            return game?.customFolders?.compendium?.folders;
        }
        /** @override */
        get entity() {
            return this.data.entity;
        }

        /** @override */
        get content() {
            return this.data.compendiums;
        }

        /** @override */
        set content(c) {
            this.data.compendiums = c;
        }

        /** @override */
        get children() {
            return this.collection.filter((f) => f.data.parent === this.id).map((c) => c.id);
        }

        set children(c) {
            this.data.children = c;
        }
        /** @override */
        static get collection() {
            return game?.customFolders?.compendium?.folders;
        }

        get name() {
            return this.data.titleText;
        }
        set name(n) {
            this.data.titleText = n;
        }
        get color() {
            return this.data.colorText;
        }
        set color(c) {
            this.data.colorText = c;
        }
        get fontColor() {
            return this.data.fontColorText;
        }
        set fontColor(fc) {
            this.data.fontColorText = fc;
        }
        get icon() {
            return this.data.folderIcon;
        }
        set icon(i) {
            this.folderIcon = i;
        }
        get compendiumList() {
            return this.data.compendiumList;
        }
        set compendiumList(c) {
            this.data.compendiumList = c;
        }
        set folderIcon(i) {
            this.data.folderIcon = i;
        }
        get path() {
            return this.data.pathToFolder;
        }
        set path(p) {
            this.data.pathToFolder = p;
        }
        get parent() {
            return this.collection.get(this.data.parent);
        }
        set parent(p) {
            this.data.parent = p;
        }
        get isDefault() {
            return this.id === "default";
        }
        get isHidden() {
            return this.id === "hidden";
        }
        set expanded(e) {
            this.data.expanded = e;
        }
        get id() {
            return this.data._id;
        }
        get displayed() {
            return this.data.visible;
        }
        // Recursively generate a pretty name
        get pathName() {
            if (this.parent) return this.parent.pathName + "/" + this.name;
            return this.name;
        }
        get folder() {
            return this.parent ?? null;
        }
        set displayed(d) {
            this.data.visible = d;
        }
        set depth(d) {
            this.data.depth = d;
        }
    }

    CONFIG.CompendiumEntry = { documentClass: CompendiumEntry };
    CONFIG.CompendiumFolder = { documentClass: CompendiumFolder };
    CONFIG.CompendiumEntryCollection = {
        documentClass: CompendiumEntryCollection,
    };
    CONFIG.CompendiumFolderCollection = {
        documentClass: CompendiumFolderCollection,
    };

    game.CF = {
        CompendiumEntry,
        CompendiumFolder,
        CompendiumEntryCollection,
        CompendiumFolderCollection,
        TEMP_ENTITY_NAME,
        FOLDER_SEPARATOR,
        FICFolderAPI,
        cleanupCompendium,
    };
}
class MigrateCompendiumConfig extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "compendium-folder-migrate";
        options.template = "modules/compendium-folders/templates/migrate-compendium.html";
        options.width = 500;
        return options;
    }
    get title() {
        return game.i18n.localize("CF.migrateButtonLabel");
    }
    async getData(options) {
        return {
            packs: game.packs.contents.filter((pack) => {
                return !pack.locked && pack.index.some((doc) => doc.name === TEMP_ENTITY_NAME);
            }),
        };
    }
    async _updateObject(event, formData) {
        let packCode = formData.pack;
        ui.notifications.notify("Migrating compendium " + game.packs.get(packCode).title + "...");
        await FICFolderAPI.migrateCompendium(packCode);
        ui.notifications.notify("Migration complete!");
    }
}
class ImportExportConfig extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "compendium-folder-edit";
        options.template = "modules/compendium-folders/templates/import-export.html";
        options.width = 500;
        return options;
    }
    get title() {
        return game.i18n.localize("CF.importExportLabel");
    }
    async getData(options) {
        return {
            exportData: JSON.stringify(game.settings.get(mod, "cfolders")),
            submitText: "Import",
        };
    }
    async _updateObject(event, formData) {
        let importData = formData.importData;
        if (importData != null && importData.length > 0) {
            try {
                let importJson = JSON.parse(importData);
                let success = true;
                Object.keys(importJson).forEach(function (key) {
                    if (importJson[key].pathToFolder != null && importJson[key].pathToFolder.length > FOLDER_LIMIT) {
                        success = false;
                    }
                });
                if (success) {
                    game.settings.set(mod, "cfolders", importJson).then(async function () {
                        game.customFolders.compendium = null;
                        await initFolders();
                        //ui.compendium.refresh();
                        ui.notifications.info(game.i18n.localize("CF.folderImportSuccess"));
                    });
                } else {
                    ui.notifications.error(game.i18n.localize("CF.folderImportMaxDepth") + " (" + FOLDER_LIMIT + ")");
                }
            } catch (error) {
                ui.notifications.error(game.i18n.localize("CF.folderImportFailure"));
            }
        }
    }
}

// ==========================
// For cleaning folder data from a compendium pack
// This is accessible from the module settings
// ==========================
async function cleanupCompendium(pack) {
    ui.notifications.notify(game.i18n.format("CF.cleanupNotificationStart", { pack: pack }));
    let p = game.packs.get(pack);
    let index = await p.getIndex();
    let allData = await p.getDocuments();
    for (let entry of allData) {
        if (entry.name === TEMP_ENTITY_NAME) {
            await FICUtils.packDeleteEntity(p, entry.id);
        } else {
            let matchingIndex = index.find((i) => i._id === entry.id);
            let data = await entry.toCompendium();
            if (data.flags.cf != null) {
                data.flags["cf"] = null;
            }
            if (matchingIndex) {
                data.id = matchingIndex._id;
            }
            await FICUtils.packUpdateEntity(p, data);
        }
    }
    ui.notifications.notify(game.i18n.localize("CF.cleanupNotificationFinish"));
}
class CleanupPackConfig extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "cleanup-compendium";
        options.template = "modules/compendium-folders/templates/cleanup-compendium.html";
        //options.width = 500;
        return options;
    }
    get title() {
        return game.i18n.localize("CF.cleanupTitle");
    }
    /** @override */
    async getData(options) {
        return {
            packs: game.packs.contents.filter((x) => !x.locked),
        };
    }

    /** @override */
    async _updateObject(event, formData) {
        let pack = formData.pack;
        if (pack != null) {
            await cleanupCompendium(pack);
        }
    }
}

//==========================
// Settings utilities
//==========================
export class Settings {
    static registerSettings() {
        game.settings.registerMenu(mod, "migrateMenu", {
            name: game.i18n.localize("CF.migrateLabel"),
            label: game.i18n.localize("CF.migrateButtonLabel"),
            icon: "fas fa-refresh",
            type: MigrateCompendiumConfig,
            restricted: true,
        });
        game.settings.registerMenu(mod, "settingsMenu", {
            name: game.i18n.localize("CF.configuration"),
            label: game.i18n.localize("CF.importExportLabel"),
            icon: "fas fa-cog",
            type: ImportExportConfig,
            restricted: true,
        });
        game.settings.register(mod, "cfolders", {
            scope: "world",
            config: false,
            type: Object,
            default: {},
        });
        game.settings.register(mod, "hasMigratedTov11", {
            scope: "world",
            config: false,
            type: Boolean,
            default: false,
        });
        game.settings.registerMenu(mod, "cleanupCompendiums", {
            name: game.i18n.localize("CF.cleanup"),
            icon: "fas fa-atlas",
            label: game.i18n.localize("CF.cleanupHint"),
            type: CleanupPackConfig,
            restricted: true,
        });

        let FolderCollection = CONFIG.CompendiumFolderCollection.documentClass;
        let EntryCollection = CONFIG.CompendiumFolderCollection.documentClass;

        if (game.customFolders) {
            game.customFolders.compendium = {
                folders: new FolderCollection([]),
                entries: new EntryCollection([]),
            };
        } else {
            game.customFolders = {
                compendium: {
                    folders: new FolderCollection([]),
                    entries: new EntryCollection([]),
                },
            };
        }
    }
    static updateFolder(folderData) {
        let existingFolders = game.settings.get(mod, "cfolders");
        existingFolders[folderData._id] = folderData;
        game.settings.set(mod, "cfolders", existingFolders);
    }
    static updateFolders(folders) {
        game.settings.set(mod, "cfolders", folders);
    }
    static addFolder(title, color, compendiums) {
        let existingFolders = game.settings.get(mod, "cfolders");
        let newFolders = existingFolders;
        newFolders.push({
            title: title,
            color: color,
            compendiums: compendiums,
        });
        game.settings.set(mod, "cfolders", newFolders);
    }
    static getFolders() {
        return game.settings.get(mod, "cfolders");
    }
}
// ==========================
// Main hook setup
// ==========================
async function initFolders(refresh = false) {
    let CompendiumFolder = CONFIG.CompendiumFolder.documentClass;
    let CompendiumEntry = CONFIG.CompendiumEntry.documentClass;

    let allFolders = game.settings.get(mod, "cfolders");
    game.customFolders.compendium = null;
    // let refresh = false;
    let assigned = [];
    let toRemove = [];
    for (let folder of Object.values(allFolders)) {
        let compendiums = [];
        folder.compendiums = [];
        for (let pack of folder.compendiumList) {
            let existingPack = game.customFolders?.compendium?.entries?.get(pack);
            if (game.packs.has(pack)) {
                if (!existingPack) compendiums.push(new CompendiumEntry(pack, folder._id));
                else compendiums.push(existingPack);
            } else {
                toRemove.push(pack);
            }
            if (folder._id != "default") assigned.push(pack);
        }
        CompendiumFolder.import(folder, compendiums);
    }

    if (game.customFolders.compendium != null) {
        // Set child folders
        let allEntries = [...game.customFolders.compendium.folders.values()];
        for (let cf of allEntries) {
            let directChildren = allEntries.filter(
                (f) => f.data?.pathToFolder?.length > 0 && f.data.pathToFolder[f.data.pathToFolder.length - 1] === cf._id
            );
            cf.children = directChildren;
        }

        if (game.user.isGM) game.settings.set(mod, "cfolders", allFolders);
    }
}
async function migrateSidebar() {
    ui.notifications.notify(modName + " | Migrating compendium sidebar to v11 folders");
    await SidebarMigration.migrate();
    await game.settings.set(mod, "cfolders", {});
    ui.notifications.notify(modName + " | Migration complete!");
}
async function runEOLPrompt() {
    const contentHtml = await renderTemplate("modules/compendium-folders/templates/eol-prompt.html");
    Dialog.prompt({
        title: "Compendium Folders and v11",
        label: "Begin Sidebar Migration",
        content: contentHtml,
        callback: async (html) => {
            await migrateSidebar();
            await game.settings.set(mod, "hasMigratedTov11", true);
        },
        options: {
            jQuery: false,
            height: "600px",
        },
    });
}
Hooks.once("init", async function () {
    defineClasses();
    Settings.registerSettings();
    Hooks.once("ready", async function () {
        await initFolders(true);
        if (!game.settings.get(mod, "hasMigratedTov11")) {
            await runEOLPrompt();
        }
    });
});
