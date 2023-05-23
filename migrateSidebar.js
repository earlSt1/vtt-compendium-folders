const mod = "Compendium Folders";
export class SidebarMigration {
    static async migrate() {
        if (!game.customFolders.compendium) {
            return;
        }
        const allRootFolders = game.customFolders.compendium.folders.contents.filter((f) => f.parent == null);
        for (const folder of allRootFolders) {
            console.log(mod + " | Converting " + folder.name);
            await this.convertFolder(folder);
        }
    }
    static createFoundryFolderData(cfFolder, parentFolderId = null) {
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
    static getPacksFromContent(cfFolder) {
        return cfFolder.content.filter((pack) => pack instanceof game.CF.CompendiumEntry);
    }
    static async updatePacks(packsToMove, folder) {
        for (const pack of packsToMove) {
            console.debug(mod + " | Moving pack " + pack._id);
            await game.packs.get(pack._id).setFolder(folder);
        }
    }
    static async convertFolder(cfFolder, parentFolder = null) {
        console.debug(mod + " | Creating folder " + cfFolder.name + (parentFolder != null ? " with parent " + parentFolder.name : ""));
        const folder = await Folder.create(this.createFoundryFolderData(cfFolder, parentFolder?._id));
        const packsToMove = this.getPacksFromContent(cfFolder);
        if (packsToMove.length > 0) {
            console.debug(mod + " | Moving " + packsToMove.length + " packs to new folder");
            await this.updatePacks(packsToMove, folder._id);
        }

        for (const f of cfFolder.children) {
            await this.convertFolder(game.customFolders.compendium.folders.get(f), folder);
        }
    }
}
