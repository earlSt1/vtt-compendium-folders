import { FICFolderAPI } from "./fic-folders.js";

export class FICMigration {
    static async migrate(packCode) {
        const targetPack = game.packs.get(targetPackCode);
        if (targetPack.locked) {
            ui.notifications.error('Cannot migrate pack "' + targetPack.name + '", unlock the compendium first');
            return;
        }
        await this.migrate(packCode, packCode);
    }
    static async migrate(sourcePackCode, targetPackCode) {
        const targetPack = game.packs.get(targetPackCode);
        const cfFolders = await FICFolderAPI.loadFolders(sourcePackCode);
        const rootFolders = cfFolders.contents.filter((x) => !x.parent);
        await convert(targetPack, rootFolders);
    }
    createFoundryFolderData(targetPack, cfFolder, parentFolder = null) {
        return foundry.utils.mergeObject(cfFolder.data, {
            type: targetPack.documentName,
            folder: parentFolder?._id,
        });
    }
    async updateDocuments(targetPack, cfFolder, folder = null) {
        const updateData = cfFolder.contents.map((docId) => ({
            _id: docId,
            folder: folder?._id,
        }));
        console.log(updateData);
        await targetPack.documentClass.updateDocuments(updateData, { pack: targetPackCode });
    }
    async convertFolder(targetPack, cfFolder, parentFolder = null) {
        const folder = await Folder.create(createFoundryFolderData(targetPack, cfFolder, parentFolder), { pack: targetPackCode });
        await updateDocuments(targetPack, cfFolder, folder);

        for (const f of cfFolder.children) {
            await convertFolder(targetPack, cfFolders.get(f), folder);
        }
    }
    async convert(targetPack, rootFolders) {
        for (const folder of rootFolders) {
            await convertFolder(targetPack, folder);
        }
    }
}
