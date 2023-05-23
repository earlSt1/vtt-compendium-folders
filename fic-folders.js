import { FICMigration } from "./migrateFIC.js";
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
    static generateRandomFolderName(prefix) {
        return Math.random()
            .toString(36)
            .replace("0.", prefix || "");
    }
    static arrayContentsEqual(array1, array2) {
        const set1 = new Set(array1);
        const set2 = new Set(array2);
        return set1.equals(set2);
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
    toObject() {
        return this;
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

        const indexFields = ["name", "flags.cf", "_id"];

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
        }
        return game.customFolders.fic.folders;
    }
    static async getFolders(packCode) {
        if (!game.customFolders.fic) {
            return this.loadFolders(packCode);
        }
        return game.customFolders.fic.folders;
    }
    static async migrateCompendium(packCode) {
        const targetPack = game.packs.get(packCode);
        if (targetPack == null) {
            ui.notifications.error('Could not find compendium with code "' + packCode + '"');
            return;
        }
        if (targetPack.locked) {
            ui.notifications.error('Cannot migrate compendium "' + targetPack.name + '", unlock the compendium first');
            return;
        }
        await FICMigration.migrate(packCode);
    }
}
