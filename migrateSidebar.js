export class SidebarMigration {
    static async migrate() {
        const allRootFolders = game.customFolders.compendium.folders.contents.filter((f) => f.parent == null);
        for (const folder of allRootFolders) {
            console.log("Converting " + folder.name);
            await convertFolder(folder);
        }
    }
    createFoundryFolderData(cfFolder, parentFolderId = null) {
        let data = {
            type: "Compendium",
            name: cfFolder.data.titleText,
            folder: parentFolderId,
        };
        if (cfFolder.data.colorText != null) {
            data.color = cfFolder.data.colorText;
        }
        return data;
    }
    getPacksFromContent(cfFolder) {
        return cfFolder.content.filter((pack) => pack instanceof game.CF.CompendiumEntry);
    }
    async updatePacks(packsToMove, folder) {
        for (const pack of packsToMove) {
            console.debug("Moving pack " + pack._id);
            await game.packs.get(pack._id).setFolder(folder);
        }
    }
    async convertFolder(cfFolder, parentFolderId = null) {
        console.debug("Creating folder " + cfFolder.name + (parentFolderId != null ? " with parent " + parentFolderId : ""));
        const folder = await Folder.create(createFoundryFolderData(cfFolder, parentFolderId));
        const packsToMove = getPacksFromContent(cfFolder);
        console.debug("Moving " + packsToMove.length + "packs to new folder");
        await updatePacks(packsToMove, folder._id);

        for (const f of cfFolder.children) {
            await convertFolder(game.customFolders.compendium.folders.get(f), folder._id);
        }
    }
}
