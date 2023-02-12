import { libWrapper } from "./shim.js";
import { Settings } from "./compendium-folders.js";
const mod = "compendium-folders";
const modName = "Compendium Folders";

export class FICUtils {
    static async packUpdateEntity(pack, data, o = {}) {
        const document = await pack.getDocument(data.id);
        const options = foundry.utils.mergeObject({ pack: pack.collection }, o);
        return await document.update(data, options);
    }
    static async packDeleteEntity(pack, id) {
        const document = await pack.getDocument(id);
        const options = { pack: pack.collection };
        return await document.delete(options);
    }
    static async packUpdateEntities(pack, updateData) {
        const cls = pack.documentClass;
        return await cls.updateDocuments(updateData, { pack: pack.collection });
    }
    static async packDeleteEntities(pack, deleteData) {
        const cls = pack.documentClass;
        return await cls.deleteDocuments(deleteData, { pack: pack.collection });
    }
    /*
     *Generating path for world folder
     */
    static getFolderPath(folder) {
        if (folder === null) {
            return "";
        }
        if (!folder.name) {
            folder = folder.folder;
        }
        let path = folder.name;
        let currentFolder = folder;
        while (currentFolder.folder != null) {
            path = currentFolder.folder.name + game.CF.FOLDER_SEPARATOR + path;
            currentFolder = currentFolder.folder;
        }
        return path;
    }
    /*
     * Getting FIC path from folder path (using new API changes)
     */
    static getPathFromFolderPath(folder) {
        const allFolders = game.customFolders.fic.folders;
        const path = folder.folderPath.map((x) => allFolders.get(x).name);
        path.push(folder.name);
        return path;
    }
    static getRenderedFolderPath(folder) {
        let path = folder.querySelector("h3").innerText;
        let currentFolder = folder;

        while (currentFolder.parentElement.parentElement.parentElement.tagName === "LI") {
            path = currentFolder.parentElement.parentElement.parentElement.querySelector("h3").innerText + game.CF.FOLDER_SEPARATOR + path;
            currentFolder = currentFolder.parentElement.parentElement.parentElement;
        }
        return path;
    }

    static generateRandomFolderName(prefix) {
        return Math.random()
            .toString(36)
            .replace("0.", prefix || "");
    }
    static shouldCreateFolders() {
        return !FICManager.allHooksFinished();
    }
    static async removeStaleOpenFolderSettings(packCode) {
        let openFolders = game.settings.get(mod, "open-temp-folders");
        let newSettings = {};
        newSettings[packCode] = openFolders[packCode];
        await game.settings.set(mod, "open-temp-folders", newSettings);
    }
    static getTempEntityData(entityType, folder) {
        switch (entityType) {
            case "Actor":
                return {
                    name: game.CF.TEMP_ENTITY_NAME,
                    type: Object.keys(CONFIG.Actor.typeLabels)[0],
                    flags: { cf: folder },
                };

            case "Item":
                return {
                    name: game.CF.TEMP_ENTITY_NAME,
                    type: Object.keys(CONFIG.Item.typeLabels)[0],
                    flags: { cf: folder },
                };

            case "Macro":
                return {
                    name: game.CF.TEMP_ENTITY_NAME,
                    type: "chat",
                    command: "",
                    flags: { cf: folder },
                };

            default:
                return {
                    name: game.CF.TEMP_ENTITY_NAME,
                    flags: { cf: folder },
                };
        }
    }
    static async removeTempEntities(entityType) {
        let collection = null;
        switch (entityType) {
            case "Actor":
                collection = game.actors;
                break;
            case "Cards":
                collection = game.cards;
                break;
            case "Item":
                collection = game.items;
                break;
            case "JournalEntry":
                collection = game.journal;
                break;
            case "Macro":
                collection = game.macros;
                break;
            case "Playlist":
                collection = game.playlists;
                break;
            case "RollTable":
                collection = game.tables;
                break;
            case "Scene":
                collection = game.scenes;
        }
        if (collection != null) {
            let tempEntities = collection.contents.filter((x) => x.name.includes(game.CF.TEMP_ENTITY_NAME)).map((y) => y.id);
            let tempEntitiesTmp = duplicate(tempEntities);
            for (let tempEntity of tempEntitiesTmp) {
                let entity = collection.get(tempEntity);
                try {
                    await entity.delete();
                } catch (e) {
                    console.debug(modName + "| Entity no longer exists in collection");
                }
            }
        }
    }
    static alphaSortFolders(folders, selector) {
        folders.sort(function (first, second) {
            if (first[selector] < second[selector]) {
                return -1;
            }
            if (first[selector] > second[selector]) {
                return 1;
            }
            return 0;
        });
        return folders;
    }
    static arraysEqual(array1, array2) {
        return (
            array1.length === array2.length &&
            array1.every(function (value, index) {
                return value === array2[index];
            })
        );
    }
    static arrayContentsEqual(array1, array2) {
        const set1 = new Set(array1);
        const set2 = new Set(array2);
        return set1.equals(set2);
    }
    static async getFolderData(packCode, tempEntityId) {
        let pack = game.packs.get(packCode);
        let tempEntity = await pack.getDocument(tempEntityId);
        return tempEntity.flags.cf;
    }
    static canDragDrop(event, packCode) {
        return event.currentTarget.dataset.pack === packCode;
    }
    static async handleMoveDocumentToFolder(data, targetFolderElement) {
        //Moving Document to Folder
        const movingDocumentId = data.documentId;
        if (movingDocumentId) {
            console.log(modName + " | Moving document " + movingDocumentId + " to new folder.");
            let packCode = targetFolderElement.closest(".directory.compendium").getAttribute("data-pack");
            const newFolderId = targetFolderElement.getAttribute("data-folder-id");
            const folders = await FICFolderAPI.getFolders(packCode);
            const newFICFolder = folders.get(newFolderId);
            FICFolderAPI.moveDocumentIntoFolder(movingDocumentId, newFICFolder);
        }
    }
    static async handleMoveFolderToFolder(data, targetFolderElement) {
        const movingFolderId = data.id;
        const targetFolderId = targetFolderElement.dataset.folderId;

        let movingFolder = game.customFolders.fic.folders.get(movingFolderId);
        let targetFolder = game.customFolders.fic.folders.get(targetFolderId);
        if (targetFolderElement.hasAttribute("collapsed")) {
            // IF FOLDER CLOSED and NOT at root - Move before folder
            await FICFolderAPI.insertFolder(movingFolder, targetFolder);
        } else {
            await FICFolderAPI.moveFolder(movingFolder, targetFolder);
        }
        //TODO
    }
    static async handleMoveDocumentToDocument(event, data, element) {
        const movingDocumentId = data.id;
        if (data.id && data.type != "FICFolder") {
            const targetDocumentId = element.getAttribute("data-document-id");
            //Check if target is in same folder
            // if it is not, skip and let folder drop listener trigger
            const oldFolderId = element
                .closest("ol.directory-list")
                .querySelector("li.directory-item[data-document-id='" + movingDocumentId + "']")
                .getAttribute("data-folder-doc-id");
            const folderId = element.getAttribute("data-folder-doc-id");
            const isInSameFolder = oldFolderId === folderId;

            if (isInSameFolder) {
                event.stopPropagation();
                console.log(modName + " | Moving document " + movingDocumentId + " above target document " + targetDocumentId);
                const folderId = element.getAttribute("data-folder-id");
                let packCode = element.closest(".directory.compendium").getAttribute("data-pack");
                const folders = await FICFolderAPI.getFolders(packCode);
                let folder = folders.get(folderId);
                await FICFolderAPI.insertDocument(movingDocumentId, targetDocumentId, folder);
            } else {
                console.debug(modName + " | Target document not in same folder, falling back to moving to new folder");
            }
        }
    }
    static async handleMoveToRoot(data) {
        if (data.type === "FICFolder") {
            //Move folder to root
            await FICFolderAPI.moveFolderToRoot(game.customFolders.fic.folders.get(data.id));
        } else {
            //Move document to root
            await FICFolderAPI.moveDocumentToRoot(data.pack, data.id);
        }
    }
}
export class FICFolder {
    constructor(data = {}) {
        this.data = mergeObject(
            {
                id: FICUtils.generateRandomFolderName("temp_"),
                folderPath: [],
                color: "#000000",
                fontColor: "#FFFFFF",
                name: "New Folder",
                children: [],
                icon: null,
                sorting: "a",
            },
            data
        );
    }
    toJSON() {
        return {
            _id: this.documentId,
            data: this.data,
        };
    }
    getSaveData() {
        let saveData = this.data;
        saveData.version = game.modules.get("compendium-folders").version;
        delete saveData.documentId;
        delete saveData.parent;
        return {
            id: this.documentId,
            _id: this.documentId,
            flags: {
                cf: saveData,
            },
        };
    }
    async save(render = false) {
        await FICUtils.packUpdateEntity(this.pack, this.getSaveData());
    }
    async saveNoRefresh() {
        await FICUtils.packUpdateEntity(this.pack, this.getSaveData());
    }
    /** @override */
    static create(data = {}, documentId, packCode) {
        let newFolder = new FICFolder(data);
        newFolder.documentId = documentId;
        newFolder.packCode = packCode;
        if (game.customFolders?.fic?.folders) {
            game.customFolders.fic.folders.set(newFolder.id, newFolder);
        }

        return newFolder;
    }
    static import(packCode, contents, folder = {}) {
        let data = folder.flags?.cf ?? folder.data.flags.cf;

        if (data?.folderPath?.length > 0) {
            data.parent = data.folderPath[data.folderPath.length - 1];
        }
        data.contents = contents ?? [];
        return FICFolder.create(data, folder.id, packCode);
    }
    async removeDocument(documentId, save = true) {
        var index = this.data.contents.indexOf(documentId);
        if (index !== -1) {
            this.data.contents.splice(index, 1);
            if (save) await this.save(false);
        }
    }
    async addDocument(documentId, save = true) {
        this.data.contents.push(documentId);
        if (save) await this.save(false);
    }

    // GETTERS AND SETTERS
    get parent() {
        return game.customFolders.fic.folders.contents.find((x) => x.id === this.parentId);
    }
    get parentId() {
        return this.data.parent ?? this.data.folderPath[this.data.folderPath.length - 1];
    }
    get id() {
        return this.data.id;
    }
    get _id() {
        return this.data.id;
    }
    get children() {
        return this.data.children;
    }
    get childrenObjects() {
        return this.data.children.map((c) => game.customFolders.fic.folders.get(c));
    }
    get orderedChildren() {
        return this.data.children || game.customFolders.fic.folders.contents.filter((f) => f.data.parent === this.id);
    }
    get contents() {
        return this.data.contents ?? [];
    }
    get name() {
        return game.i18n.has(this.data.name) ? game.i18n.localize(this.data.name) : this.data.name;
    }
    get color() {
        return this.data.color;
    }
    get fontColor() {
        return this.data.fontColor;
    }
    get icon() {
        return this.data.icon;
    }
    get folderPath() {
        return this.data.folderPath;
    }
    get pack() {
        return game.packs.get(this.packCode);
    }
    get path() {
        const path = this.data.folderPath.map((p) => game.customFolders.fic.folders.get(p).name);
        path.push(this.name);
        return path.join(game.CF.FOLDER_SEPARATOR);
    }
    get sorting() {
        return this.data.sorting;
    }
    get version() {
        return this.data.version;
    }

    set name(n) {
        this.data.name = n;
    }
    set color(c) {
        this.data.color = c;
    }
    set fontColor(fc) {
        this.data.fontColor = fc;
    }
    set icon(i) {
        this.data.icon = i;
    }
    set folderPath(fp) {
        this.data.folderPath = fp;
    }
    set sorting(s) {
        this.data.sorting = s;
    }
    set contents(c) {
        this.data.contents = c;
    }
    set children(c) {
        this.data.children = c;
    }
    set childrenObjects(childFolders) {
        this.data.children = childFolders.map((x) => x.id);
    }
    set version(v) {
        this.data.version = v;
    }
}
export class FICFolderCollection extends WorldCollection {
    constructor(...args) {
        super(...args);
    }
    /** @override */
    get entity() {
        return "FICFolder";
    }
    get documentClass() {
        return FICFolder;
    }
}
class FICFolderCreateDialog extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "fic-folder-create";
        options.template = "modules/compendium-folders/templates/fic-folder-create.html";

        return options;
    }

    get title() {
        return `${game.i18n.localize("FOLDER.Create")}: ${this.object.name}`;
    }
    async getData(options) {
        return {
            name: "New Folder",
            color: "#000000",
            fontColor: "#FFFFFF",
            id: this.object.id,
            sorting: game.settings.get(mod, "default-cf-sort") === "a",
        };
    }
    async _updateObject(options, formData) {
        let folderObj = {
            id: this.object.id,
            name: formData.name,
            color: formData.color,
            fontColor: formData.fontColor,
            icon: formData.icon,
            sorting: formData.sorting,
            contents: [],
            children: [],
        };
        await FICManager.createNewFolderWithinCompendium(folderObj, this.object.packCode, this.object.parentId);
        //pack.apps[0].element.find('.cfolders-container').remove();

        //folderObj.path = newPath
        //await createFolderInCache(folderObj.packCode,folderObj);
    }
}
class FICFolderEditDialog extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "fic-folder-edit";
        options.template = "modules/compendium-folders/templates/fic-folder-edit.html";
        options.width = 350;
        return options;
    }

    get title() {
        return `${game.i18n.localize("FOLDER.Update")}: ${this.object.name}`;
    }
    async getData(options) {
        return {
            name: this.object.name,
            color: this.object.color,
            fontColor: this.object.fontColor,
            id: this.object.id,
            icon: this.object.icon,
            sorting: this.object.sorting === "a",
        };
    }
    async _updateObject(options, formData) {
        let folderObj = {
            id: this.object.id,
            name: formData.name,
            color: formData.color,
            icon: formData.icon,
            fontColor: formData.fontColor,
            sorting: formData.sorting,
        };
        await FICManager.updateFolderWithinCompendium(folderObj, this.object.packCode, this.object.tempEntityId);
    }
}
//Cache - TODO Refactor
export class FICCache {
    static async cacheFolderStructure(packCode, folders) {
        if (!game.user.isGM || folders == null) return;
        const cache = {
            pack: packCode,
            folders: folders.map((f) => f.toJSON()),
        };
        await game.settings.set(mod, "cached-folder", cache);
        console.debug(modName + " | Cached folder structure");
        // Now store folder structures in game.customFolders.fic.folders
        //await FICFolderAPI.loadFolders(packCode);
    }
    static loadCachedFolderStructure(packCode) {
        let cache = game.settings.get(mod, "cached-folder");
        if (Object.keys(cache).length === 0) {
            console.debug(modName + " | No cached folder structure available");
            return null;
        }
        if (cache.pack === packCode) {
            let allFolders = cache.folders.map((f) => FICFolder.create(f.data, f._id, packCode));
            let folderCollection = new FICFolderCollection([]);
            for (const folder of allFolders) {
                folderCollection.set(folder.id, folder);
            }
            // game.customFolders.fic.folders = folderCollection
            return folderCollection;
        }
    }
    static async updateCache(packCode, updateData) {
        let cache = game.settings.get(mod, "cached-folder");
        if (Object.keys(cache).length === 0) {
            console.debug(modName + " | No cached folder structure available");
            return null;
        }
        if (cache.pack === packCode) {
            for (const update of updateData) {
                let cacheFolder = cache.folders.find((c) => c._id === (update._id ?? update.id));
                if (cacheFolder) {
                    cacheFolder.data = foundry.utils.mergeObject(cacheFolder.data, update.flags.cf);
                }
            }
            await game.settings.set(mod, "cached-folder", cache);
        }
    }
    static async resetCache() {
        if (!game.user.isGM) return;
        await game.settings.set(mod, "cached-folder", {});
        console.debug(modName + " | Cleared cached folder structure");
    }
}
//------------------------
// Main manager class
//------------------------
export class FICManager {
    static recompileSearchIndex(d) {
        if (d.compendium && game.system.id === "pf2e") {
            ui.compendium.compileSearchIndex();
        }
    }
    static setup() {
        if (game.settings.get(mod, "disable-fic")) {
            return;
        }
        // Hooking into the update/create methods to extract
        // folder data from the entity
        // and create folders based on them
        Hooks.on("createActor", async function (a) {
            if (a.isOwner && FICUtils.shouldCreateFolders()) {
                await FICManager.importFolderData(a);
            }
            FICManager.recompileSearchIndex(a);
        });
        Hooks.on("createCards", async function (c) {
            if (c.isOwner && FICUtils.shouldCreateFolders()) await FICManager.importFolderData(c);
            FICManager.recompileSearchIndex(c);
        });
        Hooks.on("createItem", async function (i) {
            if (i.isOwner && !i.isEmbedded && FICUtils.shouldCreateFolders()) await FICManager.importFolderData(i);
            FICManager.recompileSearchIndex(i);
        });
        Hooks.on("createJournalEntry", async function (j) {
            if (j.isOwner && FICUtils.shouldCreateFolders()) await FICManager.importFolderData(j);
            FICManager.recompileSearchIndex(j);
        });
        Hooks.on("createMacro", async function (m) {
            if (m.isOwner && FICUtils.shouldCreateFolders()) await FICManager.importFolderData(m);
            FICManager.recompileSearchIndex(m);
        });
        Hooks.on("createPlaylist", async function (p) {
            if (p.isOwner && FICUtils.shouldCreateFolders()) await FICManager.importFolderData(p);
            FICManager.recompileSearchIndex(p);
        });
        Hooks.on("createRollTable", async function (r) {
            if (r.isOwner && FICUtils.shouldCreateFolders()) await FICManager.importFolderData(r);
            FICManager.recompileSearchIndex(r);
        });
        Hooks.on("createScene", async function (s) {
            if (s.isOwner && FICUtils.shouldCreateFolders()) await FICManager.importFolderData(s);
            FICManager.recompileSearchIndex(s);
        });

        Hooks.on("updateActor", async function (a) {
            if (a.isOwner && game.actors.contents.some((x) => x.name === a.name) && FICUtils.shouldCreateFolders()) {
                await FICManager.importFolderData(a);
            }
            FICManager.recompileSearchIndex(a);
        });
        Hooks.on("updateCards", async function (c) {
            if (c.isOwner && game.cards.contents.some((x) => x.name === c.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(c);
            FICManager.recompileSearchIndex(c);
        });
        Hooks.on("updateItem", async function (i) {
            if (i.isOwner && game.items.contents.some((x) => x.name === i.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(i);
            FICManager.recompileSearchIndex(i);
        });
        Hooks.on("updateJournalEntry", async function (j) {
            if (j.isOwner && game.journal.contents.some((x) => x.name === j.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(j);
            FICManager.recompileSearchIndex(j);
        });
        Hooks.on("updateMacro", async function (m) {
            if (m.isOwner && game.macros.contents.some((x) => x.name === m.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(m);
            FICManager.recompileSearchIndex(m);
        });
        Hooks.on("updatePlaylist", async function (p) {
            if (p.isOwner && game.playlists.contents.some((x) => x.name === p.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(p);
            FICManager.recompileSearchIndex(p);
        });
        Hooks.on("updateRollTable", async function (r) {
            if (r.isOwner && game.tables.contents.some((x) => x.name === r.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(r);
            FICManager.recompileSearchIndex(r);
        });
        Hooks.on("updateScene", async function (s) {
            if (s.isOwner && game.scenes.contents.some((x) => x.name === s.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(s);
            FICManager.recompileSearchIndex(s);
        });

        // Adding the export button to all folders
        // ONLY if it contains an entity (either direct child or in child folder)
        // Adding export buttons to context menus for folders
        let newContextOption = {
            name: "CF.exportFolderHint",
            icon: '<i class="fas fa-upload"></i>',
            condition: (header) => {
                return game.user?.isGM && header.parent().find(".document").length > 0;
            },
            callback: async (header) => {
                const li = header.parent()[0];
                const quietMode = game.settings.get(mod, "quiet-mode");
                await FICFolderAPI.exportFolderWithDialog(game.folders.get(li.dataset.folderId), quietMode);
            },
        };

        libWrapper.register(
            mod,
            "ActorDirectory.prototype._getFolderContextOptions",
            function (wrapped, ...args) {
                return wrapped(...args).concat(newContextOption);
            },
            "WRAPPER"
        );
        libWrapper.register(
            mod,
            "CardsDirectory.prototype._getFolderContextOptions",
            function (wrapped, ...args) {
                return wrapped(...args).concat(newContextOption);
            },
            "WRAPPER"
        );
        libWrapper.register(
            mod,
            "ItemDirectory.prototype._getFolderContextOptions",
            function (wrapped, ...args) {
                return wrapped(...args).concat(newContextOption);
            },
            "WRAPPER"
        );

        libWrapper.register(
            mod,
            "JournalDirectory.prototype._getFolderContextOptions",
            function (wrapped, ...args) {
                return wrapped(...args).concat(newContextOption);
            },
            "WRAPPER"
        );

        libWrapper.register(
            mod,
            "MacroDirectory.prototype._getFolderContextOptions",
            function (wrapped, ...args) {
                return wrapped(...args).concat(newContextOption);
            },
            "WRAPPER"
        );

        libWrapper.register(
            mod,
            "PlaylistDirectory.prototype._getFolderContextOptions",
            function (wrapped, ...args) {
                return wrapped(...args).concat(newContextOption);
            },
            "WRAPPER"
        );

        libWrapper.register(
            mod,
            "RollTableDirectory.prototype._getFolderContextOptions",
            function (wrapped, ...args) {
                return wrapped(...args).concat(newContextOption);
            },
            "WRAPPER"
        );

        libWrapper.register(
            mod,
            "SceneDirectory.prototype._getFolderContextOptions",
            function (wrapped, ...args) {
                return wrapped(...args).concat(newContextOption);
            },
            "WRAPPER"
        );

        // Compatibility with the Sidebar Macros module
        if (game.modules.get("sidebar-macros")?.active) {
            libWrapper.register(
                mod,
                "MacroSidebarDirectory.prototype._getFolderContextOptions",
                function (wrapped, ...args) {
                    return wrapped(...args).concat(newContextOption);
                },
                "WRAPPER"
            );
        }
        // Folders In Compendium changes
        libWrapper.register(
            mod,
            "Compendium.prototype._onDrop",
            function (wrapped, ...args) {
                const data = TextEditor.getDragEventData([...args][0]);
                if (data.type === "FICFolder") return; //break out of normal Compendium drop workflow
                wrapped(...args);
            },
            "MIXED"
        );
        Settings.clearSearchTerms();

        Hooks.on("renderCompendium", async function (e) {
            let packCode = e.metadata.id;
            const compendiumWindow = document.querySelector(".compendium.directory[data-pack='" + packCode + "']");
            if (!e.collection.locked && game.user.isGM) FICManager.createNewFolderButtonWithinCompendium(compendiumWindow, packCode, null);
            if (!e.collection.index.contents.some((x) => x.name === game.CF.TEMP_ENTITY_NAME)) return;

            FICUtils.removeStaleOpenFolderSettings(packCode);
            // TODO Refactor caching system
            let allFolderData = FICCache.loadCachedFolderStructure(packCode);
            if (allFolderData) {
                game.customFolders.fic = {
                    folders: allFolderData,
                };
            } else {
                allFolderData = await FICFolderAPI.loadFolders(packCode);
                await FICCache.cacheFolderStructure(packCode, allFolderData);
            }
            if (allFolderData === null) {
                return;
            }
            const rootFolders = allFolderData.filter((f) => f.folderPath == null || f.folderPath.length === 0);
            console.debug(modName + " | Creating folder structure inside compendium.");
            let openFolders = game.settings.get(mod, "open-temp-folders");
            await FICManager.recursivelyCreateFolders(compendiumWindow, rootFolders, packCode, openFolders);
            for (let entity of compendiumWindow.querySelectorAll(".directory-item")) {
                if (entity.querySelector("h4").innerText.includes(game.CF.TEMP_ENTITY_NAME)) {
                    entity.style.display = "none";
                    entity.classList.add("hidden");
                }
            }
            if (game.user.isGM && !e.locked) {
                for (let entity of compendiumWindow.querySelectorAll(".directory-item")) {
                    entity.addEventListener("drop", async function (event) {
                        const data = TextEditor.getDragEventData(event);
                        const isFolder = data.type === "FICFolder";
                        if (!isFolder) data.id = data.uuid.split(".").pop();
                        const isInCompendium = !isFolder && game.packs.get(packCode).index.some((i) => i._id === data.id);
                        if (isInCompendium && FICUtils.canDragDrop(event, packCode)) {
                            if (
                                game.customFolders.fic.folders.some(
                                    (f) => f.contents.includes(data.id) && f.contents.includes(entity.dataset.documentId)
                                ) &&
                                this.dataset.documentId != data.id
                            ) {
                                event.stopPropagation();
                                await FICUtils.handleMoveDocumentToDocument(event, data, this);
                            }
                        }
                    });
                }
                // custom Folder eventlisteners
                for (let folder of compendiumWindow.querySelectorAll(".compendium-folder")) {
                    folder.addEventListener("dragenter", SidebarDirectory.prototype._onDragHighlight);
                    folder.addEventListener("dragleave", SidebarDirectory.prototype._onDragHighlight);
                    folder.addEventListener("dragstart", async function (event) {
                        const dragData = {
                            type: "FICFolder",
                            id: folder.dataset.folderId,
                            documentId: folder.dataset.tempEntityId,
                            pack: packCode,
                        };
                        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
                        event.stopPropagation();
                    });
                    folder.addEventListener("drop", async function (event) {
                        const data = TextEditor.getDragEventData(event);
                        const isFolder = data.type === "FICFolder";
                        if (!isFolder) {
                            data.documentId = data.uuid.split(".").pop();
                        }
                        data.pack = packCode;
                        const isInCompendium = game.packs.get(packCode).index.some((i) => i._id === data.documentId);
                        if (isInCompendium && FICUtils.canDragDrop(event, packCode)) {
                            event.stopPropagation();
                            await game.CF.FICFolderAPI.loadFolders(packCode);
                            if (isFolder) {
                                await FICUtils.handleMoveFolderToFolder(data, this);
                            } else {
                                await FICUtils.handleMoveDocumentToFolder(data, this);
                            }
                        }
                        folder.classList.remove("droptarget");
                    });
                }
                compendiumWindow.addEventListener("drop", async function (event) {
                    const data = TextEditor.getDragEventData(event);
                    const isFolder = data.type === "FICFolder";
                    if (!isFolder) data.id = data.uuid.split(".").pop();
                    data.pack = packCode;
                    FICUtils.handleMoveToRoot(data);
                });
            }
        });
    }

    static closeContextMenu() {
        let contextMenu = document.querySelector("nav#folder-context-menu");
        if (contextMenu != null) contextMenu.parentNode.removeChild(contextMenu);
    }
    static createContextMenu(header, event) {
        let folder = header.parentElement;
        let folderName = folder.querySelector("h3").innerText;
        let folderId = folder.getAttribute("data-folder-id");
        let tempEntityId = folder.getAttribute("data-temp-entity-id");
        let packCode = event.currentTarget.closest(".directory.compendium").getAttribute("data-pack");
        if (document.querySelector("nav#folder-context-menu") != null) {
            FICManager.closeContextMenu();
        }
        let contextMenu = document.createElement("nav");

        let contextMenuList = document.createElement("ol");
        contextMenuList.classList.add("context-items");

        let editOption = document.createElement("li");
        editOption.classList.add("context-item");
        let editIcon = document.createElement("i");
        editIcon.classList.add("fas", "fa-edit");
        editOption.innerHTML = editIcon.outerHTML + game.i18n.localize("CF.editFolder");
        editOption.addEventListener("click", async function (ev) {
            ev.stopPropagation();
            FICManager.closeContextMenu();
            let path = FICUtils.getRenderedFolderPath(folder);
            let folderData = await FICUtils.getFolderData(packCode, tempEntityId);
            let formObj = mergeObject(
                {
                    path: path,
                    packCode: packCode,
                    tempEntityId: tempEntityId,
                },
                folderData
            );

            new FICFolderEditDialog(formObj).render(true);
        });

        let deleteOption = document.createElement("li");
        deleteOption.classList.add("context-item");
        let deleteIcon = document.createElement("i");
        deleteIcon.classList.add("fas", "fa-trash");
        deleteOption.innerHTML = deleteIcon.outerHTML + game.i18n.localize("CF.deleteFolder");
        deleteOption.addEventListener("click", function (ev) {
            ev.stopPropagation();
            FICManager.closeContextMenu();

            new Dialog({
                title: game.i18n.localize("CF.deleteFolder"),
                content:
                    "<p>" +
                    game.i18n.format("CF.deletePromptL1", {
                        folderName: folderName,
                    }) +
                    "</p>",
                buttons: {
                    deleteFolder: {
                        icon: '<i class="fas fa-folder"></i>',
                        label: "Delete Folder",
                        callback: () => {
                            FICManager.deleteFolderWithinCompendium(packCode, folder, false);
                        },
                    },
                    deleteAll: {
                        icon: '<i class="fas fa-trash"></i>',
                        label: "Delete All",
                        callback: () => {
                            FICManager.deleteFolderWithinCompendium(packCode, folder, true);
                        },
                    },
                },
            }).render(true);
        });
        const exportToTableOption = document.createElement("li");
        exportToTableOption.classList.add("context-item");
        let tableIcon = document.createElement("i");
        tableIcon.classList.add("fas", "fa-th-list");
        exportToTableOption.innerHTML = tableIcon.outerHTML + "Create RollTable";
        exportToTableOption.addEventListener("click", function (ev) {
            ev.stopPropagation();
            FICManager.closeContextMenu();
            FICManager.exportFolderToTable(packCode, folderId);
        });
        if (game.user.isGM && !game.packs.get(packCode).locked) {
            contextMenuList.appendChild(editOption);
            contextMenuList.appendChild(deleteOption);
        }

        contextMenuList.appendChild(exportToTableOption);
        contextMenu.appendChild(contextMenuList);

        document.addEventListener("click", function (ev) {
            ev.stopPropagation();
            if (ev.target != folder) {
                FICManager.closeContextMenu();
            }
        });

        contextMenu.id = "folder-context-menu";
        contextMenu.style.marginTop = "32px";

        folder.insertAdjacentElement("beforebegin", contextMenu);
    }
    static getFullPath(folderObj) {
        let path = folderObj.name;
        let currentFolder = folderObj;
        while (currentFolder.folder != null) {
            currentFolder = currentFolder.folder;
            path = currentFolder.name + game.CF.FOLDER_SEPARATOR + path;
        }
        return path;
    }
    static updateFolderPathForTempEntity(entity, content) {
        // This constructs the folder path for temp entities
        // for each entity in contents with sub-path in entity path, add id
        let parents = content.filter((e) => entity.flags?.cf?.path?.startsWith(e.flags.cf.path, 0) && e.name === game.CF.TEMP_ENTITY_NAME);
        console.debug(entity.flags?.cf?.path + " is entity");
        let updateData = {
            flags: {
                cf: {
                    folderPath: [],
                },
            },
        };
        // sort by path
        // should end up with something along the lines of
        // temp entity has path = Folder1/Folder2/Folder3/Folder4
        // parents = [
        //    Folder1,
        //    Folder1/Folder2
        //    Folder1/Folder2/Folder3
        // }
        //
        parents = parents.sort((a, b) => {
            if (a.flags.cf.path > b.flags.cf.path) {
                return 1;
            } else if (a.flags.cf.path < b.flags.cf.path) {
                return -1;
            }
            return 0;
        });
        for (let parent of parents) {
            if (entity.flags.cf.path != parent.flags.cf.path) {
                console.debug(parent.flags.cf.path);
                updateData.flags.cf.folderPath.push(parent.flags.cf.id);
            }
        }
        updateData.id = entity._id;
        console.debug(updateData);

        return updateData;
    }

    //used for internal operations
    static async closeFolderInsideCompendium(parent, pack, save) {
        let folderIcon = parent.firstChild.querySelector("h3 > .fa-folder, .fa-folder-open");
        let contents = parent.querySelector(".folder-contents");
        if (folderIcon != null) {
            //Closing folder
            folderIcon.classList.remove("fa-folder-open");
            folderIcon.classList.add("fa-folder");
        }
        contents.style.display = "none";
        parent.setAttribute("collapsed", "");

        if (save) {
            let openFolders = game.settings.get(mod, "open-temp-folders");
            if (Object.keys(openFolders).length === 0) {
                openFolders[pack] = [];
            } else {
                if (openFolders[pack].includes(parent.getAttribute("data-folder-id"))) {
                    openFolders[pack].splice(openFolders[pack].indexOf(parent.getAttribute("data-folder-id")), 1);
                }
            }
            await game.settings.set(mod, "open-temp-folders", openFolders);
        }
    }
    static async openFolderInsideCompendium(parent, pack, save) {
        let folderIcon = parent.firstChild.querySelector("h3 > .fa-folder, .fa-folder-open");
        let contents = parent.querySelector(".folder-contents");
        if (folderIcon != null) {
            folderIcon.classList.remove("fa-folder");
            folderIcon.classList.add("fa-folder-open");
        }
        contents.style.display = "";

        parent.removeAttribute("collapsed");
        if (save) {
            let openFolders = game.settings.get(mod, "open-temp-folders");
            if (Object.keys(openFolders).length === 0) {
                openFolders[pack] = [];
            }
            if (parent.getAttribute("data-folder-id") != "noid") {
                if (!openFolders[pack]) {
                    openFolders[pack] = [];
                }
                openFolders[pack].push(parent.getAttribute("data-folder-id"));
            }
            await game.settings.set(mod, "open-temp-folders", openFolders);
        }
    }
    static async toggleFolderInsideCompendium(event, parent, pack) {
        //event.stopPropagation();
        if (parent.hasAttribute("collapsed")) {
            await FICManager.openFolderInsideCompendium(parent, pack, true);
        } else {
            await FICManager.closeFolderInsideCompendium(parent, pack, true);
            for (let child of parent.querySelectorAll(".compendium-folder")) {
                await FICManager.closeFolderInsideCompendium(child, pack, true);
            }
        }
    }
    // ==========================
    // Exporting Folders to compendiums
    // ==========================

    static async createParentFoldersWithinCompendium(folder, pack) {
        let parents = [];
        let currentFolder = folder;
        const folders = game.customFolders.fic.folders;

        while (currentFolder.folder != null) {
            parents.push(currentFolder.folder);
            currentFolder = currentFolder.folder;
        }
        let previousParent = null;
        let previousPath = [];
        for (let i = parents.length - 1; i >= 0; i--) {
            let tempEntity = folders.find((f) => f.name === parents[i].name && f.path === FICUtils.getFolderPath(parents[i]));
            if (tempEntity != null) {
                // if folder with parent name exists, and path matches, use that tempEntity id
                //previousParent = tempEntity.data.flags.cf.id;
                previousParent = tempEntity.id;
            } else {
                // If folder does not exist, create tempEntity and use folderPath of previous parent value
                previousParent = FICUtils.generateRandomFolderName("temp_");
                tempEntity = FICUtils.getTempEntityData(pack.documentClass.documentName, {
                    id: previousParent,
                    name: parents[i].name,
                    color: parents[i].data.color,
                    folderPath: previousPath,
                    children: [],
                });

                await pack.documentClass.create(tempEntity, {
                    pack: pack.collection,
                });
            }
            previousPath.push(previousParent);
        }

        return previousPath;
    }
    static async recursivelyExportFolders(index, pack, folderObj, folderId, folderPath, merge, keepId) {
        let entities = folderObj.documents ?? folderObj.contents;
        if (folderObj.children.length == 0) {
            let updatedFolder = await FICManager.exportSingleFolderToCompendium(
                index,
                pack,
                entities,
                folderObj,
                folderId,
                folderPath,
                merge,
                keepId
            );
            if (updatedFolder != null) {
                return [updatedFolder];
            }
            return [];
        } else {
            await FICManager.exportSingleFolderToCompendium(index, pack, entities, folderObj, folderId, folderPath, merge, keepId);
        }
        for (let child of folderObj.children) {
            let newPath = Array.from(folderPath);
            if (!newPath.includes(folderId)) newPath.push(folderId);

            let existingFolderId = await FICManager.getExistingFolderId(child);
            if (existingFolderId === null) existingFolderId = FICUtils.generateRandomFolderName("temp_");
            await FICManager.recursivelyExportFolders(index, pack, child, existingFolderId, newPath, merge, keepId);
        }
    }
    static async getExistingFolderId(folder) {
        if (!folder.name) {
            folder = folder.folder;
        }
        let folderPath = FICUtils.getFolderPath(folder);
        let folders = game.customFolders.fic.folders;
        let existingFolder = folders.find((x) => x.name === folder.name && x.path === folderPath);
        if (existingFolder) {
            return existingFolder.id;
        }
        return null;
    }
    static async exportSingleFolderToCompendium(index, pack, entities, folderObj, folderId, folderPath, merge, keepId) {
        if (!folderObj.name) {
            folderObj = folderObj.folder;
        }
        let path = FICManager.getFullPath(folderObj);
        const folders = game.customFolders.fic.folders;
        const existingFolder = folders.get(folderId);

        if (existingFolder) {
            folderId = existingFolder.id;
        }

        let color = folderObj.color ?? "#000000";

        let packEntities = [];
        let result = null;
        for (let e of entities) {
            let data = await e.toCompendium();
            data.flags.cf = {
                id: folderId,
                path: path,
                color: color,
            };
            if (e.documentName === "Scene" && typeof e.createThumbnail === "function") {
                const t = await e.createThumbnail({ img: data.img });
                data.thumb = t.thumb;
            }
            let existing = merge ? index.find((i) => i.name === data.name) : index.find((i) => i._id === e.id);
            if (existing) data.id = existing._id;

            if (keepId) data._id = e.id;

            if (data.id) {
                // Remove child from old parent
                let oldParent = folders.find((n) => n.children?.includes(data.id) && n.id != folderId);
                if (oldParent) {
                    let nData = {
                        id: oldParent._id,
                        flags: {
                            cf: {
                                children: oldParent.children.filter((m) => m != data.id),
                            },
                        },
                    };
                    await FICUtils.packUpdateEntity(pack, nData, {
                        keepId: keepId,
                    });
                    //Update saved content for future reference
                    oldParent.children = oldParent.children.filter((m) => m != data.id);
                }

                packEntities.push(existing._id);

                await FICUtils.packUpdateEntity(pack, data);
            } else {
                result = await pack.documentClass.createDocuments([data], {
                    pack: pack.collection,
                    keepId: keepId,
                });
                packEntities.push(result[0].id);
                if (result.id != e.id && folderObj.contents != null && folderObj.contents.length > 0) {
                    folderObj.contents.splice(
                        folderObj.contents.findIndex((x) => x.id == e.id),
                        1,
                        result.id
                    );
                }
            }
            console.log(`${modName} | Exported ${e.name} to ${pack.collection}`);
        }
        if (!existingFolder) {
            // Create new folder (exporting temp entity to allow for empty folders being editable)
            let tempData = FICUtils.getTempEntityData(pack.documentClass.documentName);
            tempData.flags.cf = {
                id: folderId,
                path: path,
                color: color,
                name: folderObj.name,
                children: packEntities,
                folderPath: folderPath,
            };
            if (folderObj.sorting === "m") {
                // Set the folder sorting to Manual
                tempData.flags.cf.sorting = folderObj.sorting;
            }
            await pack.documentClass.create(tempData, {
                pack: pack.collection,
            });
        } else {
            let folderData = {
                id: existingFolder.documentId,
                flags: {
                    cf: {
                        children: [...new Set(existingFolder.children.concat(packEntities))],
                    },
                },
            };
            if (folderObj.sorting === "m") {
                // Set the folder sorting to Manual
                folderData.flags.cf.sorting = folderObj.sorting;
            }
            await FICUtils.packUpdateEntity(pack, folderData);
        }
        console.log(`${modName} | Exported temp entity to ${pack.collection}`);
        await FICFolderAPI.loadFolders(pack.collection);
        return folderObj;
    }
    // ==========================
    // Importing folders from compendiums
    // ==========================
    static async importFromCollectionWithMerge(
        clsColl,
        collection,
        entryId,
        folderPath,
        updateData = {},
        options = {},
        merge = false,
        keepId = false
    ) {
        const pack = game.packs.get(collection);
        const cls = pack.documentClass;
        options = { keepId: keepId, fromCCompendium: true };
        // Prepare the source data from which to create the Entity
        const document = await pack.getDocument(entryId);
        const destination = game.collections.get(pack.documentName);
        const sourceData = destination.fromCompendium(document, options);
        const updateDataWithFolderPath = foundry.utils.mergeObject(updateData, {
            flags: { cf: { path: folderPath } },
        });
        if (document.flags?.cf?.sorting === "m") {
            updateDataWithFolderPath.sorting = document.flags.cf.sorting;
        }
        const createData = foundry.utils.mergeObject(sourceData, updateDataWithFolderPath);

        // Create the Entity

        let search = null;
        if (merge) {
            switch (cls.documentName) {
                case "Actor":
                    search = game.actors.contents.filter(
                        (a) => a.name === sourceData.name && FICUtils.getFolderPath(a.folder) === folderPath
                    );
                    break;
                case "Cards":
                    search = game.cards.contents.filter(
                        (c) => c.name === sourceData.name && FICUtils.getFolderPath(c.folder) === folderPath
                    );
                    break;
                case "Item":
                    search = game.items.contents.filter(
                        (i) => i.name === sourceData.name && FICUtils.getFolderPath(i.folder) === folderPath
                    );
                    break;
                case "JournalEntry":
                    search = game.journal.contents.filter(
                        (j) => j.name === sourceData.name && FICUtils.getFolderPath(j.folder) === folderPath
                    );
                    break;
                case "Macro":
                    search = game.macros.contents.filter(
                        (m) => m.name === sourceData.name && FICUtils.getFolderPath(m.folder) === folderPath
                    );
                    break;
                case "Playlist":
                    search = game.playlists.contents.filter((p) => p.name === sourceData.name);
                    break;
                case "RollTable":
                    search = game.tables.contents.filter(
                        (r) => r.name === sourceData.name && FICUtils.getFolderPath(r.folder) === folderPath
                    );
                    break;
                case "Scene":
                    search = game.scenes.contents.filter(
                        (s) => s.name === sourceData.name && FICUtils.getFolderPath(s.folder) === folderPath
                    );
            }
        }
        if (search === null || search.length === 0) {
            console.log(`${modName} | Importing ${cls.documentName} ${sourceData.name} from ${collection}`);
            destination.directory.activate();
            return await pack.documentClass.create(createData, options);
        }
        console.log(`${modName} | ${cls.documentName} ${sourceData.name} already exists on correct path. Updating`);
        createData._id = search[0].id;
        return await pack.documentClass.updateDocuments([createData], options);
    }
    static #totalHooks = 0;
    static setImportHook(folder, callback) {
        Hooks.once("folderCreated_" + folder.id, async function () {
            try {
                await callback();
            } finally {
                FICManager.finishHook(folder.pack.documentName);
            }
        });
    }
    static initializeHooks(folder) {
        // Number of hooks
        // For root folder: self + number of child folders
        // For non-root folder: number of parent folders - root + self + number of child folders

        if (!folder.parent) {
            this.#totalHooks = 1 + this.getAllChildrenCount(folder.id);
        } else {
            this.#totalHooks = this.getDepth(folder.id) + this.getAllChildrenCount(folder.id);
        }
    }
    static getDepth(folderId) {
        let depth = 0;
        let folder = game.customFolders.fic.folders.get(folderId);
        let currentFolder = folder;
        while (currentFolder.parent) {
            depth++;
            currentFolder = currentFolder.parent;
        }
        return depth;
    }
    static getAllChildrenCount(folderId) {
        let folder = game.customFolders.fic.folders.get(folderId);
        let children = folder.children.length;
        for (let child of folder.children) {
            children += this.getAllChildrenCount(child);
        }
        return children;
    }
    static finishHook(documentName) {
        this.#totalHooks -= 1;
        if (this.allHooksFinished()) {
            const quietMode = game.settings.get(mod, "quiet-mode");
            if (quietMode) {
                console.log(modName + " | " + game.i18n.localize("CF.importFolderNotificationFinish"));
            } else {
                ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationFinish"));
            }
            FICUtils.removeTempEntities(documentName);
        }
    }
    static allHooksFinished() {
        return this.#totalHooks === 0;
    }
    static get hooks() {
        return this.#totalHooks;
    }
    static resetHooks() {
        this.#totalHooks = 0;
    }
    static async recursivelyImportFolders(pack, coll, folder, merge, keepId) {
        let folderPath = folder.path;
        FICManager.setImportHook(folder, async function () {
            // loop through individual folders
            for (let childFolder of folder.childrenObjects) {
                await FICManager.recursivelyImportFolders(pack, coll, childFolder, merge, keepId);
            }
            //Then import immediate child documents
            for (let documentId of folder.contents) {
                await FICManager.importFromCollectionWithMerge(
                    coll,
                    pack.collection,
                    documentId,
                    folderPath,
                    {},
                    { renderSheet: false },
                    merge,
                    keepId
                );
            }
        });
        //Import the actual folder document
        await FICManager.importFromCollectionWithMerge(
            coll,
            pack.collection,
            folder.documentId,
            folderPath,
            {},
            { renderSheet: false },
            merge,
            keepId
        );
    }
    static async importAllParentFolders(pack, coll, folder, merge) {
        // if not root folder, import all parent folders
        // Just importing parent folders
        if (folder.parent) {
            let currentParent = folder.parent;
            let parentList = [];
            while (currentParent.parent) {
                parentList.push(currentParent);
                currentParent = currentParent.parent;
            }
            parentList.push(currentParent);

            for (let p of parentList) {
                if (!p.parent) {
                    await FICManager.importFromCollectionWithMerge(
                        coll,
                        pack.collection,
                        p.documentId,
                        p.path,
                        { flags: { cf: { import: true } } },
                        { renderSheet: false },
                        merge
                    );
                } else {
                    FICManager.setImportHook(p.parent, async function () {
                        await FICManager.importFromCollectionWithMerge(
                            coll,
                            pack.collection,
                            p.documentId,
                            p.path,
                            { flags: { cf: { import: true } } },
                            { renderSheet: false },
                            merge
                        );
                    });
                }
            }
        }
    }
    static async importFolderFromCompendium(event, folder) {
        let packCode = folder.closest(".directory.compendium").getAttribute("data-pack");
        event.stopPropagation();
        const folders = await FICFolderAPI.getFolders(packCode);
        let folderObj = folders.get(folder.getAttribute("data-folder-id"));
        FICFolderAPI.importFolderWithDialog(folderObj);
    }
    //==========================
    // Used to update entity when imported from compendium
    // To keep folder parent and remove folderdata from name
    // At this point, game.customFolders.fic.folders is populated (only accessible through import process)
    // ==========================
    static async importFolderData(e) {
        if (!game.customFolders.fic) return;
        if (e.flags.cf != null) {
            //  && e.data.flags.cf.path != null && !e.folder){
            let ficFolder = game.customFolders.fic.folders.get(e.flags.cf.id);
            let path = ficFolder.path;
            let foundFolder = null;
            let folderExists = false;
            let hook = null;
            if (e.name === game.CF.TEMP_ENTITY_NAME) {
                hook = "folderCreated_" + e.flags.cf.id;
            }
            for (let folder of game.folders.values()) {
                if (folder.type == e.documentName) {
                    if (FICUtils.getFolderPath(folder) === path) {
                        folderExists = true;
                        foundFolder = folder;
                    }
                }
            }
            if (folderExists) {
                await e.update({ folder: foundFolder.id, flags: { cf: null } });
            } else {
                await FICManager.createFolderPath(ficFolder, null, e.documentName, e);
            }
            if (hook != null) {
                Hooks.call(hook);
            }
        }
    }
    static async createFolderPath(folder, pColor, entityType, e) {
        let folderList = [folder];

        let currentParent = folder.parent;
        while (currentParent) {
            folderList.push(currentParent);
            currentParent = currentParent.parent;
        }
        for (let parentFolder of folderList.reverse()) {
            let result = game.folders.find((f) => f.type === entityType && FICUtils.getFolderPath(f) === parentFolder.path);
            if (!result) {
                //Create the folder if it does not exist
                let parentId = null;

                if (parentFolder.parent) {
                    parentId = game.folders.find(
                        (f) =>
                            f.type === entityType &&
                            f.name === parentFolder.parent.name &&
                            FICUtils.getFolderPath(f) === parentFolder.parent.path
                    )?.id;
                }
                let data = {
                    name: game.i18n.has(parentFolder.name) ? game.i18n.localize(parentFolder.name) : parentFolder.name,
                    sorting: parentFolder.sorting || "a",
                    parent: parentId,
                    type: entityType,
                    content: [],
                    color: parentFolder.color,
                };
                let f = await Folder.create(data);
                if (parentFolder.id === folder.id) {
                    await e.update({ folder: f.id, flags: { cf: null } });
                }
            }
        }
    }
    // ==========================
    // Folder creation inside compendiums
    // ==========================
    static createFolderWithinCompendium(compendiumWindow, folderData, parentId, packCode, openFolders) {
        if (compendiumWindow.querySelector(".compendium-folder[data-folder-id='" + folderData.id + "']")) {
            return;
        }
        //Example of adding folders to compendium view
        let folder = document.createElement("li");
        folder.classList.add("compendium-folder", "folder");
        folder.setAttribute("data-folder-id", folderData.id);
        folder.setAttribute("data-temp-entity-id", folderData.documentId);
        folder.setAttribute("data-pack", packCode);
        folder.setAttribute("draggable", true);
        let header = document.createElement("header");
        header.classList.add("compendium-folder-header", "flexrow");
        let headerTitle = document.createElement("h3");

        if (folderData.fontColor) header.style.color = folderData.fontColor;
        else header.style.color = "#ffffff";
        header.style.backgroundColor = folderData.color;

        header.addEventListener("contextmenu", function (event) {
            FICManager.createContextMenu(header, event);
        });

        let contents = document.createElement("div");
        contents.classList.add("folder-contents");
        contents.setAttribute("data-pack", packCode);

        let folderList = document.createElement("ol");
        folderList.classList.add("folder-list");
        let packList = document.createElement("ol");
        packList.classList.add("entry-list");

        folder.appendChild(header);
        header.appendChild(headerTitle);
        folder.appendChild(contents);
        contents.appendChild(folderList);
        contents.appendChild(packList);

        if (game.user.isGM) {
            if (!game.packs.get(packCode).locked) {
                let newFolderLabel = document.createElement("label");
                let newFolderIcon = document.createElement("i");
                let newFolderLink = document.createElement("a");

                newFolderLabel.setAttribute("title", game.i18n.localize("CF.createSubfolder"));
                newFolderIcon.classList.add("fas", "fa-folder-plus", "fa-fw");
                newFolderLink.classList.add("create-fic");

                newFolderLabel.appendChild(newFolderIcon);
                newFolderLink.appendChild(newFolderLabel);
                header.appendChild(newFolderLink);
                newFolderLink.addEventListener("click", (e) => {
                    e.stopPropagation();
                    new FICFolderCreateDialog({
                        parentId: folderData.id,
                        name: "New Folder",
                        id: FICUtils.generateRandomFolderName("temp_"),
                        path: FICUtils.getRenderedFolderPath(folder),
                        packCode: packCode,
                        tempEntityId: folderData.documentId,
                    }).render(true);
                });
            }
            let importButton = document.createElement("a");
            importButton.innerHTML = "<i class='fas fa-upload fa-fw'></i>";
            importButton.classList.add("import-folder");
            importButton.setAttribute("title", game.i18n.localize("CF.importFolderHint"));
            importButton.addEventListener("click", (event) => FICManager.importFolderFromCompendium(event, folder));

            header.appendChild(importButton);
        }

        //If no folder data, or folder is not in open folders AND folder has an id, close folder by default
        if (folderData.icon == null || folderData.icon === "") {
            if ((openFolders == null || !openFolders.includes(folderData.id)) && folderData.id != "noid") {
                contents.style.display = "none";
                folder.setAttribute("collapsed", "");
                headerTitle.innerHTML = '<i class="fas fa-fw fa-folder"></i>' + folderData.name;
            } else {
                headerTitle.innerHTML = '<i class="fas fa-fw fa-folder-open"></i>' + folderData.name;
            }
        } else {
            if ((openFolders == null || !openFolders.includes(folderData.id)) && folderData.id != "noid") {
                contents.style.display = "none";
                folder.setAttribute("collapsed", "");
            }
            let folderCustomIcon = document.createElement("img");
            folderCustomIcon.src = folderData.icon;
            headerTitle.innerHTML = folderCustomIcon.outerHTML + folderData.name;
        }

        let directoryList = compendiumWindow.querySelector(".compendium[data-pack='" + packCode + "'] ol.directory-list");
        let directoryFolderList = compendiumWindow.querySelector(
            ".compendium[data-pack='" + packCode + "'] ol.directory-list > div.cfolders-container"
        );
        if (directoryFolderList == null) {
            directoryFolderList = document.createElement("div");
            directoryFolderList.classList.add("cfolders-container");
            directoryFolderList.style.position = "relative";
            directoryList.appendChild(directoryFolderList);
        }
        if (parentId != null) {
            directoryFolderList
                .querySelector(".compendium-folder[data-folder-id='" + parentId + "']")
                .querySelector("ol.folder-list")
                .insertAdjacentElement("beforeend", folder);
        } else {
            directoryFolderList.insertAdjacentElement("beforeend", folder);
        }

        folder.addEventListener(
            "click",
            function (event) {
                FICManager.toggleFolderInsideCompendium(event, folder, packCode);
                event.stopPropagation();
            },
            false
        );

        for (let pack of directoryList.querySelectorAll("li.directory-item")) {
            pack.addEventListener(
                "click",
                function (ev) {
                    ev.stopPropagation();
                },
                false
            );
        }
        let childElements = folderData.contents.map((c) => directoryList.querySelector("li.directory-item[data-document-id='" + c + "']"));
        if (childElements.length > 0) {
            if (folderData.sorting === "a") {
                childElements = childElements
                    .filter((c) => c != null)
                    .sort(function (a, b) {
                        if (a.querySelector("h4").innerText < b.querySelector("h4").innerText) {
                            return -1;
                        }
                        if (a.querySelector("h4").innerText > b.querySelector("h4").innerText) {
                            return 1;
                        }
                        return 0;
                    });
            }
            for (let child of childElements) {
                if (child != null) {
                    child.setAttribute("data-folder-doc-id", folderData.documentId);
                    child.setAttribute("data-folder-id", folderData.id);
                    child.setAttribute("data-pack", packCode);
                    packList.appendChild(child);
                }
            }
        }
    }
    static async recursivelyCreateFolders(compendiumWindow, rootFolders, packCode, openFolders, sorting = "a") {
        if (sorting === "a") {
            rootFolders = FICUtils.alphaSortFolders(rootFolders, "name");
        }
        for (const folder of rootFolders) {
            if (!folder) return;
            FICManager.createFolderWithinCompendium(
                compendiumWindow,
                folder,
                folder.data.parent ?? folder.parentId,
                packCode,
                openFolders[packCode],
                sorting
            );
            if (folder.children.length > 0) {
                let children = folder.childrenObjects;
                if (folder.sorting === "a") {
                    children = FICUtils.alphaSortFolders(folder.childrenObjects, "name");
                }
                await this.recursivelyCreateFolders(compendiumWindow, children, packCode, openFolders, folder.sorting);
            }
        }
    }

    static createNewFolderButtonWithinCompendium(window, packCode) {
        const directoryHeader = window.querySelector("header.directory-header");
        let button = document.createElement("button");
        button.classList.add("fic-create");
        button.type = "submit";
        button.addEventListener("click", (e) => {
            e.stopPropagation();
            new FICFolderCreateDialog({
                parentId: null,
                name: "New Folder",
                id: FICUtils.generateRandomFolderName("temp_"),
                path: "",
                packCode: packCode,
            }).render(true);
        });
        let folderIcon = document.createElement("i");
        folderIcon.classList.add("fas", "fa-fw", "fa-folder-plus");
        button.innerHTML = folderIcon.outerHTML;
        button.title = "Create Folder at Root";

        let headerActions = document.createElement("div");
        headerActions.classList.add("header-actions", "action-buttons", "flexrow");
        headerActions.appendChild(button);
        headerActions.style.flex = "0";
        directoryHeader.insertAdjacentElement("beforeend", headerActions);
    }
    static async deleteFolderWithinCompendium(packCode, folderElement, deleteAll) {
        const folders = await game.CF.FICFolderAPI.getFolders(packCode);
        const rootFolder = folders.get(folderElement.dataset.folderId);
        await game.CF.FICFolderAPI.deleteFolder(rootFolder, deleteAll);
    }
    static async updateFolderWithinCompendium(folderObj, packCode, tempEntityId) {
        const folders = await FICFolderAPI.getFolders(packCode);
        const folder = folders.get(folderObj.id);
        await FICCache.updateCache(packCode, [{ id: folder.documentId, flags: { cf: folderObj } }]);
        await FICUtils.packUpdateEntity(folder.pack, {
            id: folder.documentId,
            flags: { cf: folderObj },
        });
    }
    static async createNewFolderWithinCompendium(folderObj, packCode, parentId) {
        const folders = await FICFolderAPI.getFolders(packCode);
        await FICCache.resetCache();
        if (parentId) await FICFolderAPI.createFolderWithParentData(folders.get(parentId), folderObj);
        else await FICFolderAPI.createFolderAtRootData(packCode, folderObj);
    }
    static async exportFolderToTable(packCode, folderId) {
        const folders = await game.CF.FICFolderAPI.loadFolders(packCode);
        const index = await game.packs.get(packCode).getIndex();

        let folder = folders.get(folderId);

        folder.contents = folder.contents.map((c) => index.get(c));

        const results = folder.contents.map((e, i) => {
            return {
                text: e.name,
                type: CONST.TABLE_RESULT_TYPES.COMPENDIUM,
                collection: packCode,
                resultId: e.id,
                img: e.img,
                weight: 1,
                range: [i + 1, i + 1],
                drawn: false,
            };
        });
        return RollTable.create(
            {
                name: folder.name,
                description: `A random table created from the contents of the ${folder.name} Folder.`,
                results: results,
                formula: `1d${results.length}`,
            },
            { renderSheet: true }
        );
    }
}
export class FICFolderAPI {
    //used for external operations, exposed to public
    // see API.md in module folder for more information

    /*
     * Loads folders in a compendium into WorldCollection:
     *   game.customFolders.fic.folders
     * Returns the collection too
     */
    static async loadFolders(packCode) {
        // Clear the temporary storage of folders
        game.customFolders.fic = {
            folders: new FICFolderCollection([]),
        };

        const indexFields = ["name", "flags.cf"];

        const pack = await game.packs.get(packCode);
        //Force refresh of the index (like in v9)
        const index = await pack.documentClass.database.get(
            pack.documentClass,
            {
                query: {},
                options: { index: true, indexFields: Array.from(indexFields) },
                pack: pack.collection,
            },
            game.user
        );
        //const folderIds = index.filter(x => x.name === game.CF.TEMP_ENTITY_NAME).map((i) => i._id);
        const folderIndexes = index.filter((x) => x.name === game.CF.TEMP_ENTITY_NAME);
        //const folderDocuments = await pack.getDocuments({_id: {$in: folderIds}});
        const entries = index.filter((x) => x.name != game.CF.TEMP_ENTITY_NAME);

        const updates = [];
        for (let folder of folderIndexes) {
            let needsUpdate = false;

            let contents = folder.flags.cf.contents;
            let allContents = entries.filter((x) => x.flags?.cf?.id === folder.flags.cf.id).map((e) => e._id);
            if (!FICUtils.arrayContentsEqual(contents, allContents)) {
                needsUpdate = true;
                contents = entries.filter((x) => x.flags?.cf?.id === folder.flags.cf.id).map((e) => e._id);
            }

            let children = folder.flags.cf.children;
            let allChildren = folderIndexes
                .filter(
                    (f) => (f.flags.cf.folderPath != null && f.flags.cf.folderPath[f.flags.cf.folderPath.length - 1]) === folder.flags.cf.id
                )
                .map((f) => f.flags.cf.id);
            if (!FICUtils.arrayContentsEqual(children, allChildren)) {
                needsUpdate = true;
                folder.flags.cf.children = allChildren;
            }
            let folderObj = FICFolder.import(packCode, contents, {
                id: folder._id,
                data: folder,
            });
            if (needsUpdate) updates.push(folderObj.getSaveData());
        }

        if (updates.length > 0) {
            if (pack.locked) {
                return game.customFolders.fic.folders;
            }
            try {
                console.debug(modName + " | Updating folders with new children/contents");
                await FICUtils.packUpdateEntities(pack, updates);
                console.debug(modName + " | Updating complete!");
            } catch (error) {
                console.debug(modName + " | Error from updating pack entities, most likely an entry was deleted");
            }
            return null;
        }
        return game.customFolders.fic.folders;
    }
    static async getFolders(packCode) {
        if (!game.customFolders.fic) {
            return this.loadFolders(packCode);
        }
        return game.customFolders.fic.folders;
    }
    /*
     * Creates folder at the root
     * returns a FICFolder object representing the folder that was created
     */
    static async createFolderAtRoot(packCode, name = "New Folder", color = "#000000", fontColor = "#FFFFFF") {
        let pack = game.packs.get(packCode);
        let folder = {
            id: FICUtils.generateRandomFolderName("temp_"),
            name: name,
            color: color,
            fontColor: fontColor,
            folderPath: [],
            path: name,
            children: [],
            icon: null,
        };
        let tempEntityData = FICUtils.getTempEntityData(pack.documentClass.documentName, folder);
        let result = await pack.documentClass.create(tempEntityData, {
            pack: pack.collection,
        });
        return FICFolder.import(packCode, [], result);
    }
    static async createFolderAtRootData(packCode, data) {
        let pack = game.packs.get(packCode);
        let tempEntityData = FICUtils.getTempEntityData(pack.documentClass.documentName, data);
        let result = await pack.documentClass.create(tempEntityData, {
            pack: pack.collection,
        });
        return FICFolder.import(packCode, [], result);
    }
    /*
     * Creates folder with the given FICFolder object as parent
     * returns a FICFolder object representing the folder that was created
     */
    static async createFolderWithParent(parent, name = "New Folder", color = "#000000", fontColor = "#FFFFFF") {
        const pack = parent.pack;
        let newFolderData = {
            id: FICUtils.generateRandomFolderName("temp_"),
            name: name,
            color: color,
            fontColor: fontColor,
            folderPath: parent.folderPath.concat([parent.id]),
            children: [],
            icon: null,
        };
        const tempEntityData = FICUtils.getTempEntityData(pack.documentClass.documentName, newFolderData);
        parent.children.push(newFolderData.id);
        newFolderData.folderPath = parent.folderPath.concat([parent.id]);
        const parentData = parent.getSaveData();
        await FICUtils.packUpdateEntity(pack, parentData);
        const result = await pack.documentClass.create(tempEntityData, {
            pack: pack.collection,
        });
        return FICFolder.import(parent.packCode, [], result);
    }
    static async createFolderWithParentData(parent, data = {}) {
        if (data.id) data.id = FICUtils.generateRandomFolderName("temp_");
        const pack = parent.pack;
        const tempEntityData = FICUtils.getTempEntityData(pack.documentClass.documentName, data);
        parent.children.push(data.id);
        data.folderPath = parent.folderPath.concat([parent.id]);
        const parentData = parent.getSaveData();
        await FICUtils.packUpdateEntity(pack, parentData);
        const result = await pack.documentClass.create(tempEntityData, {
            pack: pack.collection,
        });
        return FICFolder.import(parent.packCode, data.contents, result);
    }
    // Old method
    static async moveDocumentToFolder(packCode, document, folder) {
        return await this.moveDocumentIntoFolder(document.id, folder);
    }
    static async moveDocumentIntoFolder(documentId, folder) {
        const folders = await this.getFolders(folder.packCode);
        const oldFolder = folders.find((f) => f.contents.includes(documentId));
        if (folder.id === oldFolder?.id) return;
        let newFolderContents = folder.contents;
        if (!newFolderContents.includes(documentId)) newFolderContents.push(documentId);
        const newFolderData = {
            _id: folder.documentId,
            flags: {
                cf: {
                    contents: newFolderContents,
                },
            },
        };
        const updates = [newFolderData];
        let oldFolderData = null;

        if (oldFolder) {
            let oldFolderContents = oldFolder.contents;
            oldFolderContents = oldFolderContents.filter((d) => d != documentId);
            oldFolderData = {
                _id: oldFolder.documentId,
                flags: {
                    cf: {
                        contents: oldFolderContents,
                    },
                },
            };

            updates.push(oldFolderData);
        }

        const data = {
            _id: documentId,
            flags: {
                cf: {
                    id: folder.id,
                },
            },
        };
        updates.push(data);
        await this.applyUpdates(folder.packCode, updates);
        return updates;
    }
    static async renameFolder(folder, newName) {
        folder.name = newName;
        await folder.save();
    }
    static async refreshPack(pack) {
        pack.apps[0].element.find(".cfolders-container").remove();
        pack.apps[0].render(true);
    }
    static canMoveToDestFolder(folderToMove, destFolder) {
        let currentParent = destFolder.parent;
        while (currentParent) {
            if (currentParent.id === folderToMove.id) {
                //Cant move folder to a child folder of itself
                console.warn(modName + " | Can't move folder to a child of itself");
                return false;
            }
            currentParent = currentParent.parent;
        }
        if (folderToMove.parent && folderToMove.parent.id === destFolder.id) {
            console.warn(modName + " | Can't move folder to a parent it already has");
            return false;
        }
        return true;
    }
    static async moveFolder(folderToMove, destFolder, save = true) {
        // Sanity check to see if you arent moving a folder to a child of itself
        if (this.canMoveToDestFolder(folderToMove, destFolder)) {
            // Go through folderToMove and all child folders
            // Set path to newPath (cut folderPath at folderToMove, set to destFolder.folderPath + remaining path)
            let newPath = destFolder.folderPath;
            newPath.push(destFolder.id);

            let oldParent = folderToMove.parent;
            const updates = await this.recursivelyUpdateFolderPath(folderToMove, newPath);

            if (oldParent) {
                let oldParentChildren = [...oldParent.children];
                oldParentChildren.splice(oldParent.children.indexOf(folderToMove.id), 1);
                oldParent.children = oldParentChildren;
                updates.push(oldParent.getSaveData());
            }

            if (save) {
                await FICCache.resetCache();
                await FICUtils.packUpdateEntities(folderToMove.pack, updates);
            } else {
                return updates;
            }
        }
    }
    static async recursivelyUpdateFolderPath(currentFolder, folderPath) {
        let updates = [];
        for (let childFolder of currentFolder.childrenObjects) {
            let childPath = Array.from(folderPath);
            childPath.push(currentFolder.id);
            updates = updates.concat(this.recursivelyUpdateFolderPath(childFolder, childPath));
        }
        currentFolder.folderPath = folderPath;
        return [currentFolder.getSaveData()];
    }
    static async moveFolderToRoot(folder, save = true) {
        if (!folder.parent && folder.folderPath.length === 0) return;
        let parentFolder = folder.parent;
        let tempChildren = [...parentFolder.children];
        tempChildren.splice(tempChildren.indexOf(folder.id), 1);
        parentFolder.children = tempChildren;
        console.log(modName + " | Moving folder " + folder.id + " to root");
        const updates = await this.recursivelyUpdateFolderPath(folder, []);
        for (let update of updates) {
            update.flags.cf.parent = null;
        }

        updates.push(parentFolder.getSaveData());
        if (save) {
            await this.applyUpdates(folder.pack.collection, updates);
        } else {
            return updates;
        }
    }
    static async moveDocumentToRoot(packCode, documentId, folderId = null, save = true) {
        console.log(modName + " | Moving document " + documentId + " to root");
        const folders = await this.getFolders(packCode);
        let documentFolder;
        const updates = [];
        if (folderId) {
            documentFolder = folders.get(folderId);
        } else {
            documentFolder = folders.contents.find((f) => f.contents.includes(documentId));
        }
        if (documentFolder) {
            let newContents = [...documentFolder.contents];
            newContents.splice(newContents.indexOf(documentId), 1);
            documentFolder.contents = newContents;
            updates.push(documentFolder.getSaveData());
        } else {
            // Document did not belong to a folder, exit
            return;
        }
        const documentUpdate = {
            _id: documentId,
            flags: {
                cf: {
                    id: null,
                },
            },
        };
        updates.push(documentUpdate);
        if (save) {
            await this.applyUpdates(packCode, updates);
        } else {
            return updates;
        }
    }
    static async insertDocument(srcDocument, destDocument, folder) {
        //Insert movingDocument before target document
        let tempContents = [...folder.contents];

        tempContents.splice(tempContents.indexOf(srcDocument), 1);
        tempContents.splice(tempContents.indexOf(destDocument), 0, srcDocument);
        const folderData = {
            _id: folder.documentId,
            flags: {
                cf: {
                    contents: tempContents,
                },
            },
        };
        await this.applyUpdates(folder.packCode, [folderData]);
    }
    static async insertFolder(folder1, folder2) {
        if (folder1.parent && folder2.parent && folder1.parent.id == folder2.parent.id) {
            let parentFolder = folder1.parent;
            //Insert movingDocument before target document
            let tempChildren = [...parentFolder.data.children];
            tempChildren.splice(tempChildren.indexOf(folder1.id), 1);
            tempChildren.splice(tempChildren.indexOf(folder2.id), 0, folder1.id);
            parentFolder.children = tempChildren;
            await FICCache.updateCache(folder1.pack.collection, [parentFolder.getSaveData()]);
            await parentFolder.saveNoRefresh();
        }
    }
    static async deleteFolder(folder, deleteAll = false) {
        const pack = folder.pack;
        let deleteData = [];
        const updateData = [];
        deleteData.push(folder.documentId);
        if (deleteAll) {
            const folders = await this.getFolders(pack.collection);
            const childFolders = folders.filter((f) => f.folderPath.includes(folder.id));
            const childFolderDocIds = childFolders.map((f) => f.documentId);
            const childDocuments = childFolders.map((f) => f.contents).deepFlatten();
            deleteData = deleteData.concat(childFolderDocIds);
            deleteData = deleteData.concat(childDocuments);
            deleteData = deleteData.concat(folder.contents);
        } else {
            const isRoot = folder.parent === undefined;
            for (const doc of folder.contents) {
                updateData.push({
                    _id: doc,
                    flags: {
                        cf: {
                            id: isRoot ? null : folder.parent.id,
                        },
                    },
                });
            }
            if (!isRoot) {
                let newContents = [...folder.parent.contents];
                newContents = newContents.concat(folder.contents);
                if (!FICUtils.arraysEqual(folder.parent.contents, newContents)) {
                    updateData.push({
                        _id: folder.parent.documentId,
                        flags: {
                            cf: {
                                contents: newContents,
                            },
                        },
                    });
                }
            }

            for (const child of folder.childrenObjects) {
                if (isRoot) {
                    updateData.push(...(await this.moveFolderToRoot(child, false)));
                } else {
                    updateData.push(...(await this.moveFolder(child, folder.parent, false)));
                }
            }
        }
        FICCache.resetCache();
        if (updateData.length > 0) {
            await FICUtils.packUpdateEntities(pack, updateData);
        }
        if (deleteData.length > 0) {
            await FICUtils.packDeleteEntities(pack, deleteData);
        }
        await this.refreshPack(pack);
    }
    static async importFolder(folder, merge, keepId, quietMode = false) {
        if (merge === null) {
            merge = game.settings.get(mod, "default-mbn");
        }
        if (keepId === null) {
            keepId = game.settings.get(mod, "default-keep-id");
        }
        await game.settings.set(mod, "importing", true);
        try {
            if (quietMode) {
                console.log(modName + " | " + game.i18n.localize("CF.importFolderNotificationStart"));
            } else {
                ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationStart"));
            }
            let pack = folder.pack;
            let coll = pack.contents;

            //Make use of new FICFolderAPI
            await FICFolderAPI.loadFolders(folder.packCode);

            FICManager.initializeHooks(folder);
            if (folder.parent) {
                Hooks.once("folderCreated_" + folder.parent.id, async function () {
                    await FICManager.recursivelyImportFolders(pack, coll, folder, merge, keepId);
                });
                await FICManager.importAllParentFolders(pack, coll, folder, merge);
            } else {
                await FICManager.recursivelyImportFolders(pack, coll, folder, merge, keepId);
            }
        } catch (err) {
            console.error(modName + " | " + err);
        }
    }
    static async importFolderWithDialog(folder) {
        let l1 = game.i18n.format("CF.importFolderL1", { folder: folder.name });
        let l2 = game.i18n.localize("CF.importFolderL2");
        let l3 = game.i18n.localize("CF.importFolderL3");
        let l4 = game.i18n.localize("CF.importFolderL4");
        Dialog.confirm({
            title: "Import Folder: " + folder.name,
            content: `<form id='importFolder'><p>${l1}</p>
                <ul><li>${l3}</li><li>${l4}</li></ul>
                <div class='form-group'><label for='merge'>Merge by name</label>
                <input type='checkbox' name='merge' ${game.settings.get(mod, "default-mbn") ? "checked" : ""}/>
                </div><div class='form-group'><label for='keepId'>Keep ID</label>
                <input type='checkbox' name='keepId' ${game.settings.get(mod, "default-keep-id") ? "checked" : ""}/>
                </div></form>`,
            yes: async (h) => {
                let merge = h[0].querySelector("input[name='merge']").checked;
                let keepId = h[0].querySelector("input[name='keepId']").checked;
                const quietMode = game.settings.get(mod, "quiet-mode");
                await this.importFolder(folder, merge, keepId, quietMode);
            },
        });
    }
    static async exportFolder(packCode, folder, merge, keepId, quietMode = false) {
        if (merge === null) {
            merge = game.settings.get(mod, "default-mbn");
        }
        if (keepId === null) {
            keepId = game.settings.get(mod, "default-keep-id");
        }
        const pack = game.packs.get(packCode);
        let index = await pack.getIndex();
        await pack.apps[0].close();
        await FICCache.resetCache();
        await FICFolderAPI.loadFolders(packCode);
        let folderPath = await FICManager.createParentFoldersWithinCompendium(folder, pack);
        await FICFolderAPI.loadFolders(packCode);
        let existingFolderId = await FICManager.getExistingFolderId(folder);
        if (existingFolderId != null) {
            // First check if there is an existing folder in compendium for current world folder
            await FICManager.recursivelyExportFolders(index, pack, folder, existingFolderId, folderPath, merge, keepId);
        } else {
            await FICManager.recursivelyExportFolders(
                index,
                pack,
                folder,
                FICUtils.generateRandomFolderName("temp_"),
                folderPath,
                merge,
                keepId
            );
        }
        pack.render(true);
    }
    static async exportFolderWithDialog(folder, quietMode = false) {
        // Get eligible pack destinations
        const packs = game.packs.filter((p) => p.documentClass.documentName === folder.type && !p.locked);
        if (!packs.length) {
            return ui.notifications.warn(
                game.i18n.format("FOLDER.ExportWarningNone", {
                    type: folder.type,
                })
            );
        }

        // Render the HTML form
        const html = await renderTemplate("templates/sidebar/apps/folder-export.html", {
            packs: packs.reduce((obj, p) => {
                obj[p.collection] = p.title;
                return obj;
            }, {}),
            pack: game.settings.get(mod, "last-pack"),
            merge: game.settings.get(mod, "default-mbn"),
            keepId: game.settings.get(mod, "default-keep-id"),
        });

        // Display it as a dialog prompt
        return Dialog.prompt({
            title: game.i18n.localize("FOLDER.ExportTitle") + `: ${folder.name}`,
            content: html,
            label: game.i18n.localize("FOLDER.ExportTitle"),
            callback: async function (html) {
                const form = html[0].querySelector("form");
                const pack = form.pack.value;
                await game.settings.set(mod, "last-pack", form.pack.value);
                const exportStartMessage = game.i18n.format("CF.exportFolderNotificationStart", {
                    pack: form.pack.value,
                });
                if (quietMode) {
                    console.log(modName + " | " + exportStartMessage);
                } else {
                    ui.notifications.notify(exportStartMessage);
                }
                await FICFolderAPI.exportFolder(pack, folder, form.merge.checked, form.keepId.checked);
                const exportFinishMessage = game.i18n.localize("CF.exportFolderNotificationFinish");
                if (quietMode) {
                    console.log(modName + " | " + exportFinishMessage);
                } else {
                    ui.notifications.notify(exportFinishMessage);
                }
            },
            options: {},
        });
    }
    static async clearCache() {
        await FICCache.resetCache();
    }
    static async applyUpdates(packCode, updates) {
        await FICCache.updateCache(packCode, updates);
        await FICUtils.packUpdateEntities(game.packs.get(packCode), updates);
    }
}
