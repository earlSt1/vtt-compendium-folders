import { FICFolderAPI } from "./fic-folders.js";

export class FICMigration {
    static async migrate(packCode) {
        await this.migrateToTarget(packCode, packCode);
    }
    static async migrateToTarget(sourcePackCode, targetPackCode) {
        const targetPack = game.packs.get(targetPackCode);
        const cfFolders = await FICFolderAPI.loadFolders(sourcePackCode);
        const rootFolders = cfFolders.contents.filter((x) => !x.parent);
        await this.convert(targetPack, rootFolders);
        await this.backupOldFolders(cfFolders, targetPack);
    }
    static async backupOldFolders(cfFolders, targetPack) {
        console.debug("Backing up old folders");
        const backupFolder = await Folder.create(
            {
                type: targetPack.documentName,
                name: "CF_Folder backup",
            },
            { pack: targetPack.collection }
        );
        const updateData = cfFolders.contents.map((f) => ({
            _id: f.documentId,
            folder: backupFolder._id,
        }));
        await targetPack.documentClass.updateDocuments(updateData, { pack: targetPack.collection });
    }
    static createFoundryFolderData(targetPack, cfFolder, parentFolder = null) {
        return foundry.utils.mergeObject(cfFolder.data, {
            type: targetPack.documentName,
            folder: parentFolder?._id,
        });
    }
    static async updateDocuments(targetPack, cfFolder, folder = null) {
        const updateData = cfFolder.contents.map((docId) => ({
            _id: docId,
            folder: folder?._id,
        }));
        for (const update of updateData) {
            await targetPack.documentClass.updateDocuments([update], { pack: targetPack.collection });
            if (targetPack.documentClass.collections) {
                for (const key of Object.keys(targetPack.documentClass.collections)) {
                    const embeddedDocClass = targetPack.documentClass.collections[key].documentClass;
                    await targetPack.documentClass.updateEmbeddedDocuments(embeddedDocClass.name, update, {
                        pack: targetPack.collection,
                    });
                }
            }
        }
    }
    static async convertFolder(targetPack, cfFolder, parentFolder = null) {
        const folder = await Folder.create(this.createFoundryFolderData(targetPack, cfFolder, parentFolder), {
            pack: targetPack.collection,
        });
        await this.updateDocuments(targetPack, cfFolder, folder);

        for (const f of cfFolder.children) {
            await this.convertFolder(targetPack, game.customFolders.fic.folders.get(f), folder);
        }
    }
    static async convert(targetPack, rootFolders) {
        for (const folder of rootFolders) {
            console.debug("Converting " + folder.name);
            await this.convertFolder(targetPack, folder);
        }
    }
}
