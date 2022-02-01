import {libWrapper} from './shim.js';
import { Settings } from './compendium-folders.js';
const mod = 'compendium-folders';
const modName = "Compendium Folders";

export class FICUtils{
    static async packUpdateEntity(pack,data,o={}){
        const document = await pack.getDocument(data.id);
        const options = foundry.utils.mergeObject({pack:pack.collection},o);
        return await document.update(data, options);
    }
    static async packDeleteEntity(pack,id){
            const document = await pack.getDocument(id);
            const options = {pack:pack.collection};
            return await document.delete(options);
    }
    /*
     *Generating path for world folder
     */
    static getFolderPath(folder){
        if (folder === null){
            return '';
        }
        let path = folder.data.name;
        let currentFolder = folder;
        while (currentFolder.parentFolder != null){
            
            path = currentFolder.parentFolder.name+game.CF.FOLDER_SEPARATOR+path;
            currentFolder = currentFolder.parentFolder;
        }
        return path;
    }
    /*
    * Getting FIC path from folder path (using new API changes)
    */
    static getPathFromFolderPath(folder){
        const allFolders = game.customFolders.fic.folders;
        const path = folder.folderPath.map(x => allFolders.get(x).name)
        path.push(folder.name);
        return path
    }
    static getRenderedFolderPath(folder){
        let path = folder.querySelector('h3').innerText;
        let currentFolder = folder;
    
        while (currentFolder.parentElement.parentElement.parentElement.tagName === 'LI'){
            path = currentFolder.parentElement.parentElement.parentElement.querySelector('h3').innerText + game.CF.FOLDER_SEPARATOR + path;
            currentFolder = currentFolder.parentElement.parentElement.parentElement
        }
        return path;
    }
    
    static generateRandomFolderName(prefix){
        return Math.random().toString(36).replace('0.',prefix || '');
    }
    static shouldCreateFolders(){
        let importing = game.settings.get(mod,'importing');
        let autoCreate = game.settings.get(mod,'auto-create-folders');
        return (importing || autoCreate)
    }
    static async removeStaleOpenFolderSettings(packCode){
        let openFolders = game.settings.get(mod,'open-temp-folders')
        let newSettings = {}
        newSettings[packCode]=openFolders[packCode];
        await game.settings.set(mod,'open-temp-folders',newSettings);
    }
    static getTempEntityData(entityType,folder){
        switch (entityType){
            case 'Actor': return {name:game.CF.TEMP_ENTITY_NAME,type:Object.keys(CONFIG.Actor.typeLabels)[0],flags:{cf:folder}}
    
            case 'Item': return {name:game.CF.TEMP_ENTITY_NAME,type:Object.keys(CONFIG.Item.typeLabels)[0],flags:{cf:folder}}
     
            case 'Macro':return {name:game.CF.TEMP_ENTITY_NAME,type:'chat',command:'',flags:{cf:folder}} 
    
            default:     
                return {name:game.CF.TEMP_ENTITY_NAME,flags:{cf:folder}};      
        }
    }
    static async removeTempEntities(entityType){
        let collection = null
        switch (entityType){
            case 'Actor': collection = game.actors;
                break;
            case 'Cards': collection = game.cards;
                break;
            case 'Item': collection = game.items;
                break;
            case 'JournalEntry': collection = game.journal;
                break;
            case 'Macro': collection = game.macros;
                break;
            case 'Playlist': collection = game.playlists;
                break;
            case 'RollTable':collection = game.tables;
                break;
            case 'Scene':collection = game.scenes;           
        }
        if (collection != null){
            let tempEntities = collection.contents.filter(x => x.name.includes(game.CF.TEMP_ENTITY_NAME)).map(y => y.id)
            let tempEntitiesTmp = duplicate(tempEntities);
            for (let tempEntity of tempEntitiesTmp){
                let entity = collection.get(tempEntity);
                try{
                    await entity.delete()
                }catch (e){
                    console.debug(modName + '| Entity no longer exists in collection');
                }
            } 
        }
    }
    static alphaSortFolders(folders,selector){
        folders.sort(function(first,second){
            if (first[selector]<second[selector]){
                return -1;
            }
            if ( first[selector] > second[selector]){
              return 1;
            }
            return 0;
        })
        return folders
    }
    static arraysEqual(array1,array2){
        return array1.length === array2.length && array1.every(function(value, index) { return value === array2[index]})
    }
    static async getFolderData(packCode,tempEntityId){
        let pack = game.packs.get(packCode)
        let tempEntity = await pack.getDocument(tempEntityId);
        return tempEntity.data.flags.cf;
    }
}
export class FICFolder{
    constructor(data={}){
        this.data = mergeObject({
            id:FICUtils.generateRandomFolderName('temp_'),
            folderPath:[],
            color:'#000000',
            fontColor:'#FFFFFF',
            name:'New Folder',
            children:[],
            icon:null,
        },data);
        this.documentId = data.id
    }
    toJSON(){
        return this.data;
    }
    getSaveData(){
        let saveData = this.data;
        delete saveData.documentId;
        delete saveData.contents;
        delete saveData.parent;
        return {
            id:this.documentId,
            flags:{
                cf:saveData
            }            
        };
    }
    async save(render=false){
        this.pack.apps[0].close().then(async () => {
            await FICUtils.packUpdateEntity(this.pack,this.getSaveData())
            await FICCache.resetCache();
            if(render)
                this.pack.apps[0].render(true)
        })
        
    }
    async saveNoRefresh(){
        await FICUtils.packUpdateEntity(this.pack,this.getSaveData())
        await FICCache.resetCache();
    }
    /** @override */
    static create(data={},documentId,packCode){
        //TODO
        //- Folder path is using folderIds
        //- Swap this in the import function to make things quicker
        let newFolder = new FICFolder(data);
        newFolder.documentId = documentId;
        newFolder.packCode = packCode;
        if (game.customFolders?.fic?.folders){
            game.customFolders.fic.folders.set(newFolder.id,newFolder);
        }

        return newFolder
    }
    static import(packCode,contents,folder={}){
        let data = folder.data.flags.cf;

        if (data?.folderPath?.length > 0){
            data.parent = data.folderPath[data.folderPath.length-1];
        }
        data.contents = contents;
        return FICFolder.create(data,folder.id,packCode);
    }
    // async removeDocument(documentId,save=true){
    //     var index = this.data.children.indexOf(documentId);
    //     if (index !== -1) {
    //         this.data.children.splice(index, 1);
    //         if (this.save)
    //             await this.save(false);
    //     }
    // }
    // async addDocument(documentId,save=true){
    //     this.data.children.push(documentId);
    //     if (this.save)
    //         await this.save(false);
    // }

    // GETTERS AND SETTERS
    get parent(){
        return game.customFolders.fic.folders.contents.find(x => x.id === this.data.parent)
    }
    get id(){return this.data.id}
    get _id(){return this.data.id}
    //get documentId(){return this.documentId}
    get children(){
        return game.customFolders.fic.folders.contents.filter(f => f.data.parent === this.id);
    }
    get contents(){return this.data.contents}
    get name(){return this.data.name}
    get color(){return this.data.color}
    get fontColor(){return this.data.fontColor}
    get icon(){return this.data.icon}
    get folderPath(){return this.data.folderPath}
    get pack(){return game.packs.get(this.packCode)}
    get path(){
        const path = this.data.folderPath.map(p => game.customFolders.fic.folders.get(p).name)
        path.push(this.name)
        return path.join(game.CF.FOLDER_SEPARATOR);
    }

    set name(n){this.data.name = n}
    set color(c){this.data.color = c}
    set fontColor(fc){this.data.fontColor = fc}
    set icon(i){this.data.icon = i}
    set folderPath(fp){this.data.folderPath = fp}
}
export class FICFolderCollection extends WorldCollection{
    constructor(...args) {
        super(...args);
    }
    /** @override */
    get entity() {
        return "FICFolder";
    }
    get documentClass(){
        return FICFolder;
    }
}
class FICFolderCreateDialog extends FormApplication{
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "fic-folder-create";
        options.template = "modules/compendium-folders/templates/fic-folder-create.html";

        return options;
    }
  
    get title() {
        return `${game.i18n.localize("FOLDER.Create")}: ${this.object.name}`;
    }
    async getData(options){
        return {
            name:'New Folder',
            color:'#000000',
            fontColor:'#FFFFFF',
            id:this.object.id
        };
    }
    async _updateObject(options,formData){
        let folderObj = {
            id:this.object.id,
            name:formData.name,
            color:formData.color,
            fontColor:formData.fontColor,
            icon:formData.icon
        }
        await FICCache.resetCache()
        FICManager.createNewFolderWithinCompendium(folderObj,this.object.packCode,this.object.tempEntityId);
        
         
        //folderObj.path = newPath
        //await createFolderInCache(folderObj.packCode,folderObj);   
            
    }
}
class FICFolderEditDialog extends FormApplication{
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
    async getData(options){
        return {
            name:this.object.name,
            color:this.object.color,
            fontColor:this.object.fontColor,
            id:this.object.id,
            icon:this.object.icon
        };
    }
    async _updateObject(options,formData){
        let folderObj = {
            id:this.object.id,
            name:formData.name,
            color:formData.color,
            icon:formData.icon,
            fontColor:formData.fontColor
        }            
        await FICCache.updateFolderInCache(this.object.packCode,folderObj); 
        await FICManager.updateFolderWithinCompendium(folderObj,this.object.packCode,this.object.tempEntityId);      
    }
}
//Cache
export class FICCache{
    static async cacheFolderStructure(packCode,groupedFolders,groupedFolderMetadata){
        if (!game.user.isGM) return;
        let cache = {
            pack:packCode,
            groupedFolders:groupedFolders,
            groupedFolderMetadata:groupedFolderMetadata
        }
        await game.settings.set(mod,'cached-folder',cache);
        console.log(modName+' | Cached folder structure');
        // Now store folder structures in game.customFolders.fic.folders
        FICFolderAPI.loadFolders(packCode);

    }
    static async loadCachedFolderStructure(packCode){
        let cache = game.settings.get(mod,'cached-folder');
        if (Object.keys(cache).length === 0){
            console.log(modName+' | No cached folder structure available');
            return null;
        }
        if (cache.pack === packCode)
            return cache.groupedFolders;
        return null;
    }
    static async moveEntryInCache(packCode,entryId,folderId){
        let cache = game.settings.get(mod,'cached-folder');
        if (Object.keys(cache).length === 0 || cache.pack != packCode){
            // shouldnt be reachable....
            return;
        }
        let x = await game.packs.get(packCode).getDocument(entryId);
        let fromFolderMetadata = null
        if (x.data.flags.cf != null && x.data.flags.cf.id != null){
            fromFolderMetadata = cache.groupedFolderMetadata[x.data.flags.cf.id]
        }
        let toFolderMetadata = cache.groupedFolderMetadata[folderId]
        
        //if (folderId === id){
            // Add entry to this folder
            cache.groupedFolders[toFolderMetadata.depth][toFolderMetadata.index].children.push(entryId);
            console.debug(modName+' | Adding '+entryId+' to folder ['+cache.groupedFolders[toFolderMetadata.depth][toFolderMetadata.index].name+']');
        
        if (fromFolderMetadata != null 
            && cache.groupedFolders[fromFolderMetadata.depth][fromFolderMetadata.index].children.includes(entryId)){
            let index = cache.groupedFolders[fromFolderMetadata.depth][fromFolderMetadata.index].children.indexOf(entryId);
            cache.groupedFolders[fromFolderMetadata.depth][fromFolderMetadata.index].children.splice(index,1);

            console.debug(modName+' | Removing '+entryId+' from folder ['+ cache.groupedFolders[fromFolderMetadata.depth][fromFolderMetadata.index].name+']');
        }
        
        await game.settings.set(mod,'cached-folder',cache);
        console.log(modName+' | Updated cached folder structure');
    }
    //TODO when i get folder structure improved
    // currently i have to update every single entity in the folder
    // ideally just give an id and update TEMP_ENTITY with folderdata.
    static async updateFolderInCache(packCode,folderObj){
        let cache = game.settings.get(mod,'cached-folder');
        if (Object.keys(cache).length === 0 || cache.pack != packCode){
            return;
        }
        let folderMetadata = cache.groupedFolderMetadata[folderObj.id]
        let index = cache.groupedFolders[folderMetadata.depth].findIndex(x => x.id === folderObj.id)
        cache.groupedFolders[folderMetadata.depth][index].color = folderObj.color
        cache.groupedFolders[folderMetadata.depth][index].name = folderObj.name
        cache.groupedFolders[folderMetadata.depth][index].icon = folderObj.icon
        cache.groupedFolders[folderMetadata.depth][index].fontColor = folderObj.fontColor
        cache.groupedFolders[folderMetadata.depth] = FICUtils.alphaSortFolders(cache.groupedFolders[folderMetadata.depth],'name')
        // Updating index for ALL folders in cache (important if folders swap order after renaming)
        cache.groupedFolders[folderMetadata.depth].map((x,i) => foundry.utils.mergeObject(x,{index:i}))
        let i = 0;
        for (let f of cache.groupedFolders[folderMetadata.depth]){
            cache.groupedFolderMetadata[f.id].index = i++
        }
        //cache.groupedFolderMetadata[folderObj.id].index = cache.groupedFolders[folderMetadata.depth].findIndex(f => f.id === folderObj.id)
        console.debug(modName+' | Updating folder in cache')
    
        await game.settings.set(mod,'cached-folder',cache);
        console.log(modName+' | Updated cached folder structure');
    }
    static async resetCache(){
        if (!game.user.isGM) return;
        await game.settings.set(mod,'cached-folder',{});
        console.log(modName+' | Cleared cached folder structure');
    }
}
//------------------------
// Main manager class
//------------------------
export class FICManager{
    static setup(){
        // Hooking into the update/create methods to extract
        // folder data from the entity
        // and create folders based on them
        Hooks.on('createActor',async function(a){
            if (a.isOwner && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(a);
        })
        Hooks.on('createItem',async function(i){
            if (i.isOwner && !i.isEmbedded && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(i);
        })
        Hooks.on('createJournalEntry',async function(j){
            if (j.isOwner && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(j);
        })
        Hooks.on('createMacro',async function(m){
            if (m.isOwner && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(m);
        })
        Hooks.on('createPlaylist',async function(p){
            if (p.isOwner && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(p);
        })
        Hooks.on('createRollTable',async function(r){
            if (r.isOwner && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(r);
        })
        Hooks.on('createScene',async function(s){
            if (s.isOwner && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(s);
        })
        

        Hooks.on('updateActor',async function(a){
            if (a.isOwner && game.actors.contents.some(x => x.name === a.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(a);
        })
        Hooks.on('updateItem',async function(i){
            if (i.isOwner && game.items.contents.some(x => x.name === i.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(i);
        })
        Hooks.on('updateJournalEntry',async function(j){
            if (j.isOwner && game.journal.contents.some(x => x.name === j.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(j);
        })
        Hooks.on('updateMacro',async function(m){
            if (m.isOwner && game.macros.contents.some(x => x.name === m.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(m);
        })
        Hooks.on('updatePlaylist',async function(p){
            if (p.isOwner && game.playlists.contents.some(x => x.name === p.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(p);
        })
        Hooks.on('updateRollTable',async function(r){
            if (r.isOwner && game.tables.contents.some(x => x.name === r.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(r);
        })
        Hooks.on('updateScene',async function(s){
            if (s.isOwner && game.scenes.contents.some(x => x.name === s.name) && FICUtils.shouldCreateFolders())
                await FICManager.importFolderData(s);
        })

        // Adding the export button to all folders
        // ONLY if it contains an entity (either direct child or in child folder)
        
        Hooks.on('renderActorDirectory',async function(a){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.actors.contents.some(a => a.name === game.CF.TEMP_ENTITY_NAME) && game.user.isGM){
                await FICUtils.removeTempEntities('Actor')
            }
        })
        Hooks.on('renderCardsDirectory',async function(c){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.cards.contents.some(c => c.name === game.CF.TEMP_ENTITY_NAME) && game.user.isGM){
                await FICUtils.removeTempEntities('Cards')
            }
        })
        Hooks.on('renderItemDirectory',async function(e){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.items.contents.some(i => i.name === game.CF.TEMP_ENTITY_NAME && game.user.isGM)){
                await FICUtils.removeTempEntities('Item')
            }
        })
        Hooks.on('renderJournalDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.journal.contents.some(j => j.name === game.CF.TEMP_ENTITY_NAME && game.user.isGM)){
                await FICUtils.removeTempEntities('JournalEntry')
            }
        })
        Hooks.on('renderMacroDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.macros.contents.some(m => m.name === game.CF.TEMP_ENTITY_NAME && game.user.isGM)){
                await FICUtils.removeTempEntities('Macro')
            }
        })
        Hooks.on('renderPlaylistDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.playlists.contents.some(p => p.name === game.CF.TEMP_ENTITY_NAME && game.user.isGM)){
                await FICUtils.removeTempEntities('Playlist')
            }
        })
        Hooks.on('renderRollTableDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.tables.contents.some(r => r.name === game.CF.TEMP_ENTITY_NAME && game.user.isGM)){
                await FICUtils.removeTempEntities('RollTable')
            }
        })
        Hooks.on('renderSceneDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.scenes.contents.some(s => s.name === game.CF.TEMP_ENTITY_NAME && game.user.isGM)){
                await FICUtils.removeTempEntities('Scene')
            }
        })
         // Adding export buttons to context menus for folders
        let newContextOption = {
            name: "CF.exportFolderHint",
            icon: '<i class="fas fa-upload"></i>',
            condition: header => {
                return game.user?.isGM && header.parent().find('.document').length > 0
            },
            callback: header => {
                const li = header.parent()[0];
                FICManager.exportFolderStructureToCompendium(game.folders.get(li.dataset.folderId))
            }  
        }
        
        libWrapper.register(mod, 'ActorDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');
        libWrapper.register(mod, 'CardsDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');
        libWrapper.register(mod, 'ItemDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');
        
        libWrapper.register(mod, 'JournalDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');

        libWrapper.register(mod, 'MacroDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');
        
        libWrapper.register(mod, 'RollTableDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');

        libWrapper.register(mod, 'SceneDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');

        // Compatibility with the Sidebar Macros module
        libWrapper.register(mod, 'MacroSidebarDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');

        // Folders In Compendium changes
        Settings.clearSearchTerms()

        Hooks.on('renderCompendium',async function(e){
            let packCode = e.metadata.package+'.'+e.metadata.name;
            let window = e._element[0];
            if (!e.collection.locked && game.user.isGM)
                FICManager.createNewFolderButtonWithinCompendium(window,packCode);
            if (!e.collection.index.contents.some(x => x.name === game.CF.TEMP_ENTITY_NAME)) return;
        
            FICUtils.removeStaleOpenFolderSettings(packCode);
            let cachedFolderStructure = await FICCache.loadCachedFolderStructure(packCode);
            let allFolderData = {};
            let groupedFoldersSorted = {};
            let groupedFolders = {};
            
            if (cachedFolderStructure != null){
                groupedFoldersSorted = cachedFolderStructure;
            } else {
                let folderChildren = {};

                const indexFields = [
                    "name",
                    "flags.cf",
                ];
    
                const index = await e.collection.getIndex({ fields: indexFields });
                
                const folderIds = index
                    .filter(x =>
                        x.flags?.cf?.id != null &&
                        x.name === game.CF.TEMP_ENTITY_NAME)
                    .map((i) => i._id);
                const contents = await e.collection.getDocuments({_id: {$in: folderIds}});
                const allFolderIds = contents.map(x => x.data.flags.cf.id);
                const entries = index.filter(x => x.flags?.cf?.id);

                contents.forEach(x => {
                    let temp = { name: x.name, _id: x.id, flags: { cf: x.data.flags?.cf } };
                    entries.push(temp);
                });

                let updateData = [];
                //First parse folder data
                entries.forEach(entry => {
                    let folderId = entry.flags.cf.id;
                    let entryId = entry._id;
                    if (entry.name === game.CF.TEMP_ENTITY_NAME){
                        if (entry.flags.cf.folderPath == null){
                            let result = FICManager.updateFolderPathForTempEntity(entry,contents);
                            updateData.push(result); 
                        } else {
                            let name = entry.flags.cf.name;
                            let color = entry.flags.cf.color;
                            let folderPath = entry.flags.cf.folderPath;
                            let folderIcon = entry.flags.cf.icon
                            let fontColor = entry.flags.cf.fontColor;
                            let data = {
                                id:folderId,
                                color:color, 
                                children:[],
                                name:name,
                                folderPath:folderPath,
                                tempEntityId:entryId,
                                icon:folderIcon,
                                fontColor:fontColor,
                            }
                            if (allFolderData[folderId])
                                allFolderData[folderId] = foundry.utils.mergeObject(data,allFolderData[folderId]);
                            else
                                allFolderData[folderId] = data;
                        }
                    }
                    if (allFolderData[folderId] != null && allFolderData[folderId].children != null){
                        allFolderData[folderId].children.push(entryId);
                    } else {
                        allFolderData[folderId] = {children:[entryId]};
                    }
                });
                for (let key of Object.keys(folderChildren)){
                    allFolderData[key].children = folderChildren[key].children;
                }

                if (updateData.length>0) {
                    ui.notifications.notify('Updating folder structure. Please wait...');
                    e.close().then(async () => {
                        if (game.user.isGM) {
                            for (let d of updateData) {
                                await FICUtils.packUpdateEntity(e.collection,d);
                            }
                            FICCache.resetCache();
                            ui.notifications.notify('Updating complete!');
                            e.render(true);
                        } else {
                            ui.notifications.warn('Please log in as a GM to convert this compendium to the new format')
                        }
                    });
                    return;
                }  
                
                //Group folders in terms of depth
                let groupedFolderMetadata = {}
                Object.keys(allFolderData).forEach(function(key) {
                    let depth = 0;
                    if (allFolderData[key].folderPath == null || allFolderData[key].folderPath.length===0){
                        depth = 0;
                    } else {
                        depth = allFolderData[key].folderPath.length;
                        // Add all parent folders to list
                        // Need to make sure to render them
                    }
                    if (groupedFolders[depth] == null){
                        groupedFolders[depth] = [allFolderData[key]];
                    } else {
                        groupedFolders[depth].push(allFolderData[key]);
                    }
                    groupedFolderMetadata[key] = {depth:depth, index:groupedFolders[depth].length-1};
                });
                Object.keys(groupedFolders).sort(function(o1,o2){
                    if (parseInt(o1)<parseInt(o2)){
                        return -1;
                    } else if (parseInt(o1>parseInt(o2))) {
                        return 1;
                    }
                    return 0;
                }).forEach((key) => {
                    groupedFoldersSorted[key] = groupedFolders[key];
                })

                await FICCache.cacheFolderStructure(packCode,groupedFoldersSorted,groupedFolderMetadata);
            }
            console.log(modName+' | Creating folder strucfture inside compendium.');
            let openFolders = game.settings.get(mod,'open-temp-folders');
            await FICManager.createFoldersWithinCompendium(groupedFoldersSorted,packCode,openFolders);
            for (let entity of window.querySelectorAll('.directory-item')){
                if (entity.querySelector('h4').innerText.includes(game.CF.TEMP_ENTITY_NAME)){
                    entity.style.display = 'none';
                    entity.classList.add('hidden');
                }
            }
            if (game.user.isGM && !e.locked){
                // Moving between folders
                let hiddenMoveField = document.createElement('input');
                hiddenMoveField.type='hidden';
                hiddenMoveField.style.display='none';
                hiddenMoveField.classList.add('folder-to-move');
                window.querySelector('ol.directory-list').appendChild(hiddenMoveField);
                
                for (let entity of window.querySelectorAll('.directory-item')) {
                    entity.addEventListener('dragstart',async function(){
                        let currentId = this.getAttribute('data-document-id');
                        this.closest('ol.directory-list').querySelector('input.folder-to-move').value = currentId;
                    })
                }
                for (let folder of window.querySelectorAll('.compendium-folder')) {
                    folder.addEventListener('drop',async function(event){
                        let movingItemId = this.closest('ol.directory-list').querySelector('input.folder-to-move').value;
                        if (movingItemId.length>0) {
                            console.log(modName+' | Moving document '+movingItemId+' to new folder.');
                            this.closest('ol.directory-list').querySelector('input.folder-to-move').value = '';
                            //let entryInFolderElement = this.querySelector(':scope > div.folder-contents > ol.entry-list > li.directory-item')
        
                            let packCode = this.closest('.directory.compendium').getAttribute('data-pack');
                            let p = game.packs.get(packCode);
                            let targetFolder = await p.getDocument(folder.getAttribute('data-temp-entity-id'));
                            let data = {
                                id:movingItemId,
                                flags:{
                                    cf:{
                                        id:folder.getAttribute('data-folder-id')
                                    }
                                }
                            };
                            await FICCache.moveEntryInCache(packCode,movingItemId,this.getAttribute('data-folder-id'));
                            if (data){ 
                                const document = await p.getDocument(data.id);
                                await document.update(data,{pack:p.collection});
                            }   
                        }
                    })
                }
            }
        })
    }
    
    static closeContextMenu(){
        let contextMenu = document.querySelector('nav#folder-context-menu');
        if (contextMenu!=null)
            contextMenu.parentNode.removeChild(contextMenu);
    }
    static createContextMenu(header,event){
        let folder = header.parentElement
        let folderName = folder.querySelector('h3').innerText
        let folderId = folder.getAttribute('data-folder-id');
        let tempEntityId = folder.getAttribute('data-temp-entity-id')
        let packCode = event.currentTarget.closest('.directory.compendium').getAttribute('data-pack')
        if (document.querySelector('nav#folder-context-menu')!=null){
            FICManager.closeContextMenu()
        }
        let contextMenu = document.createElement('nav');
        //contextMenu.classList.add('expand-down');
    
        let contextMenuList = document.createElement('ol');
        contextMenuList.classList.add('context-items');
    
        //if (header.parentElement.querySelector(':scope > div.folder-contents > ol.entry-list > li.directory-item') != null){
            let editOption = document.createElement('li');
            editOption.classList.add('context-item')
            let editIcon = document.createElement('i');
            editIcon.classList.add('fas','fa-edit');
            editOption.innerHTML=editIcon.outerHTML+game.i18n.localize("CF.editFolder");
            editOption.addEventListener('click',async function(ev){
                ev.stopPropagation();
                FICManager.closeContextMenu();
                let path = FICUtils.getRenderedFolderPath(folder);
                let folderData = await FICUtils.getFolderData(packCode,tempEntityId);
                let formObj = mergeObject({
                    path:path,
                    packCode:packCode,
                    tempEntityId:tempEntityId
                },folderData)
                
                new FICFolderEditDialog(formObj).render(true);
            })
            contextMenuList.appendChild(editOption);
        //}
        let deleteOption = document.createElement('li');
        deleteOption.classList.add('context-item')
        let deleteIcon = document.createElement('i');
        deleteIcon.classList.add('fas','fa-trash');
        deleteOption.innerHTML=deleteIcon.outerHTML+game.i18n.localize("CF.deleteFolder");
        deleteOption.addEventListener('click',function(ev){
            ev.stopPropagation();
            FICManager.closeContextMenu();
            
            new Dialog({
                title: game.i18n.localize('CF.deleteFolder'),
                content: "<p>"+game.i18n.format('CF.deletePromptL1',{folderName:folderName})+"</p>",
                buttons: {
                    deleteFolder: {
                        icon: '<i class="fas fa-folder"></i>',
                        label: "Delete Folder",
                        callback: () => {FICManager.deleteFolderWithinCompendium(packCode,folder,false);FICCache.resetCache();}
                    },
                    deleteAll:{
                        icon: '<i class="fas fa-trash"></i>',
                        label: "Delete All",
                        callback: ( )=> {FICManager.deleteFolderWithinCompendium(packCode,folder,true);FICCache.resetCache();}
                    }
                }
            }).render(true);
        })
        contextMenuList.appendChild(deleteOption);
            
        contextMenu.appendChild(contextMenuList);
        
        document.addEventListener('click',function(ev){
            ev.stopPropagation();
            if (ev.target!=folder){
                FICManager.closeContextMenu()
            }
        });
    
        contextMenu.id='folder-context-menu';
        contextMenu.style.marginTop="32px"; 
    
        folder.insertAdjacentElement('beforebegin',contextMenu);
    }
    static getFullPath(folderObj){
        let path = folderObj.name;
        let currentFolder = folderObj;
        while (currentFolder.parentFolder != null){
            currentFolder = currentFolder.parentFolder;
            path = currentFolder.name+game.CF.FOLDER_SEPARATOR+path;
        }
        return path;
    }
    static updateFolderPathForTempEntity(entity,content){
        // This constructs the folder path for temp entities
        // for each entity in contents with sub-path in entity path, add id
        let parents = content.filter(e =>
            entity.data?.flags?.cf?.path?.startsWith(e.data.flags.cf.path,0) 
            && e.name === game.CF.TEMP_ENTITY_NAME);
        console.debug(entity.data?.flags?.cf?.path+" is entity");
        let updateData = {
            flags:{
                cf:{
                    folderPath:[]
                }
            }
        }
        // sort by path
        // should end up with something along the lines of 
        // temp entity has path = Folder1/Folder2/Folder3/Folder4
        // parents = [
        //    Folder1,
        //    Folder1/Folder2
        //    Folder1/Folder2/Folder3
        // }
        //
        parents = parents.sort((a,b) => {
            if (a.data.flags.cf.path > b.data.flags.cf.path){
                return 1;
            }else if (a.data.flags.cf.path < b.data.flags.cf.path){
                return -1;
            }
            return 0;
        });
        for (let parent of parents){
            
            if (entity.data.flags.cf.path != parent.data.flags.cf.path){
                console.debug(parent.data.flags.cf.path);
                updateData.flags.cf.folderPath.push(parent.data.flags.cf.id);
            }
        }
        updateData.id = entity._id
        console.debug(updateData);
        
        return updateData;
    }


    //used for internal operations
    static async closeFolderInsideCompendium(parent,pack,save){
        let folderIcon = parent.firstChild.querySelector('h3 > .fa-folder, .fa-folder-open')
        let contents = parent.querySelector('.folder-contents');
        if (folderIcon != null){
            //Closing folder
            folderIcon.classList.remove('fa-folder-open')
            folderIcon.classList.add('fa-folder') 
        }
        contents.style.display='none'
        parent.setAttribute('collapsed','');
    
        if (save){
            let openFolders = game.settings.get(mod,'open-temp-folders');
            if (Object.keys(openFolders).length===0){
                openFolders[pack]=[];
            }else{
                if (openFolders[pack].includes(parent.getAttribute('data-folder-id'))){
                    openFolders[pack].splice(openFolders[pack].indexOf(parent.getAttribute('data-folder-id')),1);
                }
            }
            await game.settings.set(mod,'open-temp-folders',openFolders);
        }
    }
    static async openFolderInsideCompendium(parent,pack,save){
        let folderIcon = parent.firstChild.querySelector('h3 > .fa-folder, .fa-folder-open')
        let contents = parent.querySelector('.folder-contents');
        if (folderIcon != null){
            folderIcon.classList.remove('fa-folder')
            folderIcon.classList.add('fa-folder-open')
        }
        contents.style.display=''
        
        parent.removeAttribute('collapsed');
        if (save){
            let openFolders = game.settings.get(mod,'open-temp-folders');
            if (Object.keys(openFolders).length===0){
                openFolders[pack]=[];
            }
            if (parent.getAttribute('data-folder-id') != 'noid'){
                openFolders[pack].push(parent.getAttribute('data-folder-id'));
            }
            await game.settings.set(mod,'open-temp-folders',openFolders);   
        }
    }
    static async toggleFolderInsideCompendium(event,parent,pack){
        event.stopPropagation();
        if (parent.hasAttribute('collapsed')){
            await FICManager.openFolderInsideCompendium(parent,pack,true);
        }else{
            await FICManager.closeFolderInsideCompendium(parent,pack,true);
            for (let child of parent.querySelectorAll('.compendium-folder')){
                await FICManager.closeFolderInsideCompendium(child,pack,true);
            }
        }
    }
    // ==========================
    // Exporting Folders to compendiums
    // ==========================
    
    // Mostly taken from foundry.js 
    static async exportFolderStructureToCompendium(folder){
        
        // Get eligible pack destinations
        const packs = game.packs.filter(p => (p.documentClass.documentName === folder.data.type) && !p.locked);
        if ( !packs.length ) {
            return ui.notifications.warn(game.i18n.format("FOLDER.ExportWarningNone", {type: folder.data.type}));
        }
    
        // Render the HTML form
        const html = await renderTemplate("templates/sidebar/apps/folder-export.html", {
            packs: packs.reduce((obj, p) => {
                obj[p.collection] = p.title;
                return obj;
            }, {}),
            pack: null,
            merge: game.settings.get(mod,'default-mbn'),
            keepId: game.settings.get(mod,'default-keep-id')
        });
    
        // Display it as a dialog prompt
        return Dialog.prompt({
            title: game.i18n.localize("FOLDER.ExportTitle") + `: ${folder.macroList ? folder.name : folder.data.name}`,
            content: html,
            label: game.i18n.localize("FOLDER.ExportTitle"),
            callback: async function(html) {
                const form = html[0].querySelector("form");
                const pack = game.packs.get(form.pack.value);
                ui.notifications.notify(game.i18n.format('CF.exportFolderNotificationStart',{pack:form.pack.value}));
                let index = await pack.getIndex();
                await pack.apps[0].close();
               
                FICCache.resetCache();
                await FICFolderAPI.loadFolders(form.pack.value);
                let folderPath = await FICManager.createParentFoldersWithinCompendium(folder,pack);
                await FICFolderAPI.loadFolders(form.pack.value);

                // First check if there is an existing folder in compendium for current world folder
                let existingFolderId = await FICManager.getExistingFolderId(folder,pack)
                if (existingFolderId != null){
                    await FICManager.recursivelyExportFolders(index,pack,folder,existingFolderId,folderPath,form.merge.checked,form.keepId.checked)
                }else{
                    await FICManager.recursivelyExportFolders(index,pack,folder,FICUtils.generateRandomFolderName('temp_'),folderPath,form.merge.checked,form.keepId.checked)
                }
                FICCache.resetCache()
                ui.notifications.notify(game.i18n.localize('CF.exportFolderNotificationFinish'));
                pack.render(true);
            },
            options:{}
        });
    
        
    }
    static async getExistingFolderId(folder,pack){
        let folderPath = FICUtils.getFolderPath(folder);
        let folders = game.customFolders.fic.folders;
        let existingFolder = folders.find(x => x.name === folder.name
            && x.path === folderPath);
        if (existingFolder){
            return existingFolder.id;
        }
        return null;
    }
    static async createParentFoldersWithinCompendium(folder,pack){
        let parents = []
        let currentFolder = folder;
        const folders = game.customFolders.fic.folders;
    
        while (currentFolder.parentFolder != null){
            parents.push(currentFolder.parentFolder);
            currentFolder = currentFolder.parentFolder;
        }
        let previousParent = null;
        let previousPath = []
        for (let i=parents.length-1 ;i>=0;i--){
            let tempEntity = folders.find(f => f.name === parents[i].name
                && f.path === FICUtils.getFolderPath(parents[i]))
            if (tempEntity != null){
                // if folder with parent name exists, and path matches, use that tempEntity id
                //previousParent = tempEntity.data.flags.cf.id;
                previousParent = tempEntity.id;
            }else{
                // If folder does not exist, create tempEntity and use folderPath of previous parent value
                previousParent = FICUtils.generateRandomFolderName('temp_')
                tempEntity = FICUtils.getTempEntityData(pack.documentClass.documentName,{
                    id:previousParent,
                    name:parents[i].name,
                    color:parents[i].data.color,
                    folderPath:previousPath,
                    children:[]
                });
                
                await pack.documentClass.create(tempEntity,{pack:pack.collection});
               
            }
            previousPath.push(previousParent)
        }

        return previousPath;
    }
    static async recursivelyExportFolders(index,pack,folderObj,folderId,folderPath,merge,keepId){
        if (folderObj.children.length==0){
            let entities = folderObj.content;
            let updatedFolder = await FICManager.exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,folderPath,merge,keepId)
            if (updatedFolder != null){
                return [updatedFolder];
            }
            return []
        }else{
            let entities = folderObj.content;
            await FICManager.exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,folderPath,merge,keepId)
        }
        for (let child of folderObj.children){
            let newPath = Array.from(folderPath);
            if (!newPath.includes(folderId))
                newPath.push(folderId)
    
            let existingFolderId = await FICManager.getExistingFolderId(child,pack)
            if (existingFolderId === null)
                existingFolderId = FICUtils.generateRandomFolderName('temp_')
            await FICManager.recursivelyExportFolders(index,pack,child,existingFolderId,newPath,merge,keepId)
        }
    }
    static async exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,folderPath,merge,keepId){
        let path = FICManager.getFullPath(folderObj)
        const folders = game.customFolders.fic.folders;
        const existingFolder = folders.get(folderId);

        if (existingFolder){
            folderId = existingFolder.id
        }
        let color = '#000000'
        if (folderObj.data.color != null && folderObj.data.color.length>0){
            color = folderObj.data.color;
        }
        else if (folderObj.color != null && folderObj.color.length>0){
            color = folderObj.color;
        }
        let packEntities = []
        let result = null;
        for ( let e of entities ) {
            let data = await e.toCompendium();
            data.flags.cf={
                id:folderId,
                path:path,
                color:color,
            }
            if (e.documentName === 'Scene' && typeof e.createThumbnail === 'function') {
                const t = await e.createThumbnail({img: data.img});
                data.thumb = t.thumb;
            }
            let existing = merge ? index.find(i => i.name === data.name) : index.find(i => i._id === e.id);
            if ( existing ) data.id = existing._id;
            
            if (keepId) data._id = e.id;
            
            if ( data.id ){
                // Remove child from old parent
                let oldParent = folders.find(n => n.children?.includes(data.id) && n.id != folderId)
                if (oldParent){
                    let nData = {
                        id: oldParent._id,
                        flags:{
                            cf:{
                                children:oldParent.children.filter(m => m != data.id)
                            }
                        }
                    }
                    await FICUtils.packUpdateEntity(pack,nData,{keepId:keepId});
                     //Update saved content for future reference
                    oldParent.children = oldParent.children.filter(m => m != data.id);
                }
               
                packEntities.push(existing._id)
                
                await FICUtils.packUpdateEntity(pack,data);           
            } else {
                result = await pack.documentClass.createDocuments([data],{pack:pack.collection,keepId:keepId});
                packEntities.push(result.id);
                if (result.id != e.id && folderObj.contents != null && folderObj.contents.length>0){
                    folderObj.contents.splice(folderObj.contents.findIndex((x => x.id==e.id)),1,result.id);
                }
            }
            console.log(`${modName} | Exported ${e.name} to ${pack.collection}`);
        }
        if (!existingFolder){
            // Create new folder (exporting temp entity to allow for empty folders being editable)
            let tempData = FICUtils.getTempEntityData(pack.documentClass.documentName);
            tempData.flags.cf={
                id:folderId,
                path:path,
                color:color,
                name:folderObj.name,
                children:packEntities,
                folderPath:folderPath
            }
            await pack.documentClass.create(tempData,{pack:pack.collection});
        }else{
            let folderData = {
                id:existingFolder.documentId,
                flags:{
                    cf:{
                        children:[...new Set(existingFolder.children.concat(packEntities))]
                    }
                }
            }
            await FICUtils.packUpdateEntity(pack,folderData)
    
        }
        console.log(`${modName} | Exported temp entity to ${pack.collection}`);
        await FICFolderAPI.loadFolders(pack.collection);
        return folderObj
    }
    // ==========================
    // Importing folders from compendiums
    // ==========================
    static async importFromCollectionWithMerge(clsColl,collection, entryId, folderPath, updateData={}, options={},merge=false,keepId=false) {
        const pack = game.packs.get(collection);
        const cls = pack.documentClass;
        options = {keepId:keepId}
        // Prepare the source data from which to create the Entity
        const document = await pack.getDocument(entryId);
        const destination = game.collections.get(pack.documentName);
        const sourceData = destination.fromCompendium(document);
        const updateDataWithFolderPath = foundry.utils.mergeObject(updateData,{flags:{cf:{path:folderPath}}});
        const createData = foundry.utils.mergeObject(sourceData, updateDataWithFolderPath);
        
        // Create the Entity
        
        let search = null
        if (merge){
            switch (cls.documentName){
                case 'Actor':search = game.actors.contents.filter(a => a.name === sourceData.name && FICUtils.getFolderPath(a.folder)===folderPath)
                            break;
                case 'Cards':search = game.cards.contents.filter(c => c.name === sourceData.name && FICUtils.getFolderPath(c.folder)===folderPath)
                            break;
                case 'Item':search = game.items.contents.filter(i => i.name === sourceData.name && FICUtils.getFolderPath(i.folder)===folderPath)
                            break;
                case 'JournalEntry':search = game.journal.contents.filter(j => j.name === sourceData.name && FICUtils.getFolderPath(j.folder)===folderPath)
                            break;
                case 'Macro':search = game.macros.contents.filter(m => m.name === sourceData.name && FICUtils.getFolderPath(m.folder)===folderPath)
                            break;
                case 'Playlist':search = game.playlists.contents.filter(p => p.name === sourceData.name)
                            break;
                case 'RollTable':search = game.tables.contents.filter(r => r.name === sourceData.name && FICUtils.getFolderPath(r.folder)===folderPath)
                            break;
                case 'Scene':search = game.scenes.contents.filter(s => s.name === sourceData.name && FICUtils.getFolderPath(s.folder)===folderPath)
            }
        }
        if (search === null || search.length === 0){
            console.log(`${modName} | Importing ${cls.documentName} ${sourceData.name} from ${collection}`);
            destination.directory.activate();
            return await pack.documentClass.create(createData, options);
        }
        console.log(`${modName} | ${cls.documentName} ${sourceData.name} already exists on correct path. Updating`);
        createData._id = search[0].id;
        return await pack.documentClass.updateDocuments([createData],options);
      }

    static async recursivelyImportFolders(pack,coll,folder,merge,keepId){
        let folderPath = folder.path
        // First loop through individual folders
        for (let childFolder of folder.children){
            await FICManager.recursivelyImportFolders(pack,coll,childFolder,merge,keepId);
        }
        //Import the actual folder document
        await FICManager.importFromCollectionWithMerge(coll,pack.collection,folder.documentId,folderPath, {}, {renderSheet:false},merge,keepId)
        await new Promise(res => setTimeout(res,100));
        //Then import immediate child documents
        for (let documentId of folder.contents){
            await FICManager.importFromCollectionWithMerge(coll,pack.collection,documentId,folderPath, {}, {renderSheet:false},merge,keepId)
        }
    }
    static async importAllParentFolders(pack,coll,folder,merge){
        // if not root folder, import all parent folders
        // Just importing parent folders
        if (folder.parent){
            let parentList = []
            let currentParent = folder.parent;
            while (currentParent.parent){
                parentList.push(currentParent)
                currentParent = currentParent.parent;
            }
            for (let p of parentList.reverse()){
                await FICManager.importFromCollectionWithMerge(coll,
                    pack.collection,
                    p.documentId,
                    p.path,
                    {flags:{cf:{import:true}}},
                    {renderSheet:false},
                    merge);
                await new Promise(res => setTimeout(res,100));
            }
        }
    }
    static async importFolderFromCompendium(event,folder){
        let folderName = folder.querySelector('h3').textContent;
        event.stopPropagation();
        let l1 = game.i18n.format("CF.importFolderL1",{folder:folderName})
        let l2 = game.i18n.localize("CF.importFolderL2");
        let l3 = game.i18n.localize("CF.importFolderL3");
        let l4 = game.i18n.localize("CF.importFolderL4");
        Dialog.confirm({
            title:'Import Folder: '+folderName,
            content: `<form id='importFolder'><p>${l1}</p>
                <ul><li>${l3}</li><li>${l4}</li></ul>
                <div class='form-group'><label for='merge'>Merge by name</label>
                <input type='checkbox' name='merge' ${game.settings.get(mod,'default-mbn')?'checked':''}/>
                </div><div class='form-group'><label for='keepId'>Keep ID</label>
                <input type='checkbox' name='keepId' ${game.settings.get(mod,'default-keep-id')?'checked':''}/>
                </div></form>`,
            yes: async (h) => {
                await game.settings.set(mod,'importing',true);
                let merge = h[0].querySelector('input[name=\'merge\']').checked
                let keepId = h[0].querySelector('input[name=\'keepId\']').checked
                ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationStart"))
                let packCode = folder.closest('.directory.compendium').getAttribute('data-pack');
                let pack = await game.packs.get(packCode);
                let coll = pack.contents;
                let packEntity = pack.documentClass.documentName; 

                //Make use of new FICFolderAPI
                const folderId = folder.getAttribute('data-folder-id')
                await FICFolderAPI.loadFolders(packCode);   
                let ficFolder = game.customFolders.fic.folders.get(folderId);

                await FICManager.importAllParentFolders(pack,coll,ficFolder,merge); 
                await FICManager.recursivelyImportFolders(pack,coll,ficFolder,merge,keepId);
                ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationFinish"));
                await FICUtils.removeTempEntities(packEntity);
                await game.settings.set(mod,'importing',false);
            }
        });
        
    }
    // ==========================
    // Folder creation inside compendiums
    // ==========================
    static createFolderWithinCompendium(folderData,parentId,packCode,openFolders){
        //Example of adding folders to compendium view
        let folder = document.createElement('li')
        folder.classList.add('compendium-folder');
        folder.setAttribute('data-folder-id',folderData.id);
        folder.setAttribute('data-temp-entity-id',folderData.tempEntityId);
        let header = document.createElement('header');
        header.classList.add('compendium-folder-header','flexrow')
        let headerTitle = document.createElement('h3');
        
        if (folderData.fontColor)
            header.style.color=folderData.fontColor;
        else
            header.style.color='#ffffff';
        header.style.backgroundColor=folderData.color
        
        if (game.user.isGM && !game.packs.get(packCode).locked){
            header.addEventListener('contextmenu',function(event){
                FICManager.createContextMenu(header,event);
            });
        }
    
    
        let contents = document.createElement('div');
        contents.classList.add('folder-contents');
        contents.setAttribute("data-pack",packCode);
        
        let folderList = document.createElement('ol');
        folderList.classList.add('folder-list');
        let packList = document.createElement('ol');
        packList.classList.add('entry-list');
        
        folder.appendChild(header);
        header.appendChild(headerTitle);
        folder.appendChild(contents);
        contents.appendChild(folderList);
        contents.appendChild(packList);
    
        if (game.user.isGM){
            if (!game.packs.get(packCode).locked){
                let newFolderLabel = document.createElement('label');
                let newFolderIcon = document.createElement('i');
                let newFolderLink = document.createElement('a');
                
                newFolderLabel.setAttribute('title',game.i18n.localize('CF.createSubfolder'));
                newFolderIcon.classList.add('fas','fa-folder-plus','fa-fw');
                newFolderLink.classList.add('create-fic');
                
        
                newFolderLabel.appendChild(newFolderIcon);
                newFolderLink.appendChild(newFolderLabel);
                header.appendChild(newFolderLink)
                newFolderLink.addEventListener('click',(e) => {
                    e.stopPropagation();
                    new FICFolderCreateDialog({
                        parentId:folderData.id,
                        name:'New Folder',
                        id:FICUtils.generateRandomFolderName('temp_'),
                        path:FICUtils.getRenderedFolderPath(folder),
                        packCode:packCode,
                        tempEntityId:folderData.tempEntityId
                    }).render(true)
                });
            }
            if (game.packs.get(packCode).documentClass.documentName != 'Playlist'){
                let importButton = document.createElement('a');
                importButton.innerHTML = "<i class='fas fa-upload fa-fw'></i>"
                importButton.classList.add('import-folder');
                importButton.setAttribute('title',game.i18n.localize("CF.importFolderHint"))
                importButton.addEventListener('click',event => FICManager.importFolderFromCompendium(event,folder));
    
                header.appendChild(importButton);
            }
        }
    
        //If no folder data, or folder is not in open folders AND folder has an id, close folder by default
        if (folderData.icon == null || folderData.icon === ""){
            if ((openFolders == null || !openFolders.includes(folderData.id)) && folderData.id != "noid"){
                contents.style.display = 'none';
                folder.setAttribute('collapsed','');
                headerTitle.innerHTML = "<i class=\"fas fa-fw fa-folder\"></i>"+folderData.name;
            }else{
                headerTitle.innerHTML = "<i class=\"fas fa-fw fa-folder-open\"></i>"+folderData.name;
            }
        }else{
            if ((openFolders == null || !openFolders.includes(folderData.id)) && folderData.id != "noid"){
                contents.style.display = 'none';
                folder.setAttribute('collapsed','');
            }
            let folderCustomIcon = document.createElement('img');
            folderCustomIcon.src = folderData.icon;
            headerTitle.innerHTML = folderCustomIcon.outerHTML+folderData.name;
        }
    
        let directoryList = document.querySelector('.compendium[data-pack=\''+packCode+'\'] ol.directory-list');
        let directoryFolderList = document.querySelector('.compendium[data-pack=\''+packCode+'\'] ol.directory-list > div.cfolders-container');
        if (directoryFolderList == null){
            directoryFolderList = document.createElement('div')
            directoryFolderList.classList.add('cfolders-container');
            directoryFolderList.style.position='relative'
            directoryList.appendChild(directoryFolderList);
        }
        if (parentId != null){
            directoryFolderList.querySelector('.compendium-folder[data-folder-id=\''+parentId+'\']').querySelector('ol.folder-list').insertAdjacentElement('beforeend',folder)
        }else{
            directoryFolderList.insertAdjacentElement('beforeend',folder);
        }
    
        folder.addEventListener('click',function(event){ FICManager.toggleFolderInsideCompendium(event,folder,packCode) },false)
    
        for (let pack of directoryList.querySelectorAll('li.directory-item')){
            pack.addEventListener('click',function(ev){ev.stopPropagation()},false)
        }
        let childElements = folderData?.children?.map(c => directoryList.querySelector('li.directory-item[data-document-id=\''+c+'\']'))
        if (childElements?.length > 0){
            let sortedChildElements = childElements.filter(c => c != null).sort(function (a,b){
                if (a.querySelector('h4').innerText < b.querySelector('h4').innerText){
                    return -1
                }
                if (a.querySelector('h4').innerText > b.querySelector('h4').innerText){
                    return 1;
                }
                return 0;
            })
            for (let child of sortedChildElements){
                if (child != null){
                    packList.appendChild(child);
                }
            }
        }
    }
    static async createFoldersWithinCompendium(groupedFoldersSorted,packCode,openFolders){
        Object.keys(groupedFoldersSorted).forEach(function(depth){
            // Now loop through folder compendiums, get them from dict, add to local list, then pass to createFolder
            for (let groupedFolder of FICUtils.alphaSortFolders(groupedFoldersSorted[depth],'name')){
                if (groupedFolder.folderPath != null){
                    let parentFolderId = groupedFolder.folderPath[groupedFolder.folderPath.length-1];
                    FICManager.createFolderWithinCompendium(groupedFolder,parentFolderId,packCode,openFolders[packCode]);
                }
            }
        });
    }
    
    static createNewFolderButtonWithinCompendium(window,packCode){
        let directoryHeader = window.querySelector('header.directory-header');
        if (game.system.id === "CoC7" && window.querySelector('div.compendiumfilter') != null)
            directoryHeader = window.querySelector('div.compendiumfilter');
        let button = document.createElement('button');
        button.classList.add('fic-create')
        button.type='submit';
        button.addEventListener('click',(e) => {
            e.stopPropagation();
            new FICFolderCreateDialog({
                parentId:null,
                name:'New Folder',
                id:FICUtils.generateRandomFolderName('temp_'),
                path:"",
                packCode:packCode
            }).render(true)
        });
        let folderIcon = document.createElement('i')
        folderIcon.classList.add('fas','fa-fw','fa-folder-plus')
        button.innerHTML = folderIcon.outerHTML;
        button.title = 'Create Folder at Root'
        
    
        let headerActions = document.createElement('div');
        headerActions.classList.add('header-actions','action-buttons','flexrow');
        headerActions.appendChild(button);
        headerActions.style.flex='0'
        directoryHeader.insertAdjacentElement('beforeend',headerActions)
    }
    
    //==========================
    // Used to update entity when imported from compendium
    // To keep folder parent and remove folderdata from name
    // At this point, game.customFolders.fic.folders is populated (only accessible through import process)
    // ==========================
    static async importFolderData(e){
        if (e.compendium) return;
        if (e.data.flags.cf != null){
            //  && e.data.flags.cf.path != null && !e.folder){
            let ficFolder = game.customFolders.fic.folders.get(e.data.flags.cf.id);
            let path = ficFolder.path;
            let color = ficFolder.color;
            //a.data.folder -> id;
            let foundFolder = null;
            let folderExists=false;
            
            for (let folder of game.folders.values()){
                if (folder.data.type==e.documentName){
                    if (FICUtils.getFolderPath(folder) === path){
                        folderExists=true;
                        foundFolder=folder;
                    }
                }
            }
            if (folderExists){
                await e.update({folder : foundFolder.id,flags:{cf:null}})
            }else{
                await FICManager.createFolderPath(ficFolder,null,e.documentName,e);
            }
        }
    }
    static async createFolderPath(folder,pColor,entityType,e){

        let folderList = [folder]

        let currentParent = folder.parent;
        while (currentParent){
            folderList.push(currentParent)
            currentParent = currentParent.parent;
        }
        for (let parentFolder of folderList.reverse()){
            let result = game.folders.find(f => f.type === entityType && FICUtils.getFolderPath(f) === parentFolder.path)
            if (!result){
                //Create the folder if it does not exist
                let parentId = null

                if (parentFolder.parent){
                    parentId = game.folders.find(f => f.type===entityType 
                        && f.name===parentFolder.parent.name 
                        && FICUtils.getFolderPath(f) === parentFolder.parent.path
                    )?.id
                }
                let data = {
                    name:parentFolder.name,
                    sorting:'a',
                    parent:parentId,
                    type:entityType,
                    content:[],
                    color:parentFolder.color
                }
                let f = await Folder.create(data);
                if (parentFolder.id === folder.id){
                    await e.update({folder:f.id,flags:{cf:null}});
                }
            }
        }
            
    }
    static async deleteFolderWithinCompendium(packCode,folderElement,deleteAll){
        //ui.notifications.notify(game.i18n.localize('CF.deleteFolderNotificationStart'))
        
        let pack = game.packs.get(packCode);
        await pack.apps[0].close();
        let contents = await pack.getDocuments()
        let tempEntity = await pack.getDocument(folderElement.getAttribute('data-temp-entity-id'));
        let tempEntityFolderId = tempEntity.data.flags.cf.id
        let folderChildren = contents.filter(e => e.data?.flags?.cf?.id === tempEntityFolderId && e.id != tempEntity.id).map(d => d.id);
        let parentFolderId = null;
        let parentEntity = null;
        let parentPath = null;
        let tempEntityData = tempEntity.data.flags.cf
        if (tempEntityData.folderPath != null && tempEntityData.folderPath.length>0){
            parentFolderId = tempEntityData.folderPath[tempEntityData.folderPath.length-1];
            parentEntity = contents.find(e => e.name === game.CF.TEMP_ENTITY_NAME && 
                e.data.flags.cf.id === parentFolderId);
            parentPath = parentEntity.data.flags.cf.path;
        }
        
        let allData = {};
        let toDelete = [];
        if (deleteAll){
            for (let entity of folderElement.querySelectorAll('.directory-item')){
                if (!toDelete.includes(entity.getAttribute('data-document-id')))
                    toDelete.push(entity.getAttribute('data-document-id'));
            }
            for (let folder of folderElement.querySelectorAll('.compendium-folder')){
                if (!toDelete.includes(folder.getAttribute('data-temp-entity-id')))
                    toDelete.push(folder.getAttribute('data-temp-entity-id'));
            }
        }else{
            for (let entity of contents){
                if (entity.data.flags != null && entity.data.flags.cf != null){
                    if (folderChildren.includes(entity.id)){
                        //Move child up to parent folder
                        // Add ID to parent folder
                        if (parentFolderId != null){
                            let parentChildren = parentEntity.data.flags.cf.children;
                            parentChildren.push(entity.id);
                            if (allData[parentEntity.id] == null){
                                allData[parentEntity.id] = {flags:{cf:{children:parentChildren}},id:parentEntity.id}
                            }else{
                                allData[parentEntity.id].flags.cf.children = parentChildren;
                                allData[parentEntity.id].id=parentEntity.id
                            }
                        }
                        // Update parent folderID of entity
    
                        if (allData[entity.id] == null){
                            allData[entity.id] = {flags:{cf:{id:parentFolderId}},id:entity.id}
                        }else{
                            allData[entity.id].flags.cf.id = parentFolderId;
                            allData[entity.id].flags.cf.path = parentEntity.data.flags.cf.path
                            allData[entity.id].id=entity.id
                        }
                        if (parentPath)
                            allData[entity.id].flags.cf.path = parentPath;
                    }else{
                        if (entity.name === game.CF.TEMP_ENTITY_NAME 
                            && entity.data.flags.cf.folderPath.includes(tempEntityFolderId)){
                            // Another temp entity representing folder which is a child of parent
                            let newPath = entity.data.flags.cf.folderPath
                            newPath.splice(newPath.indexOf(tempEntityFolderId),1)
                            //let newPath = tempEntity.data.flags.cf.folderPath.splice(tempEntity.data.flags.cf.folderPath.length-1,1);
                            if (allData[entity.id] == null){
                                allData[entity.id] = {flags:{cf:{folderPath:newPath}},id:entity.id}
                            }else{
                                allData[entity.id].flags.cf.folderPath = newPath             
                                allData[entity.id].id=entity.id
                            }      
                            if (parentPath)
                            allData[entity.id].flags.cf.path = parentPath;
                        }
                    }
                }
            }
        }
        if (deleteAll){
            for (let id of toDelete){
                await FICUtils.packDeleteEntity(pack,id);
            }
        }else{
            for (let data of Object.values(allData)){
                await FICUtils.packUpdateEntity(pack,data);
            }
            await tempEntity.delete({pack:pack.collection});
        }
        //await FICUtils.packDeleteEntity(pack,tempEntity.id)
        ui.notifications.notify(game.i18n.localize('CF.deleteFolderNotificationFinish'));
        document.querySelector('.compendium-pack[data-pack=\''+packCode+'\']').click();
        pack.apps[0].render(true);
    }
    static async updateFolderWithinCompendium(folderObj,packCode,tempEntityId){
        //ui.notifications.notify(game.i18n.localize('CF.updateFolderNotificationStart'))
        let pack = game.packs.get(packCode);
        let entity = await pack.getDocument(tempEntityId); 
    
        if (entity != null){
    
            let data = {
                flags:{
                    cf:foundry.utils.mergeObject(entity.data.flags.cf,folderObj)
                }
            }
            // if (entity.data.flags.cf.folderPath === null){
            //     data.flags.cf = null;
            // }
    
            
    
            const options = {pack:pack.collection};
            await entity.update(data, options);
        }
        ui.notifications.notify(game.i18n.localize('CF.updateFolderNotificationFinish'));
    }
    static async createNewFolderWithinCompendium(folderObj,packCode,parentTempEntityId){
        // Exporting temp entity to allow for empty folders being editable
        let pack = game.packs.get(packCode);
        let newPath = []
        if (parentTempEntityId != null){
            let parent = await pack.getDocument(parentTempEntityId)
            newPath = parent.data.flags.cf.folderPath.concat(parent.data.flags.cf.id)
        }
        
        let tempData = FICUtils.getTempEntityData(pack.documentClass.documentName);
        tempData.flags.cf={
            id:folderObj.id,
            folderPath:newPath,
            color:folderObj.color,
            fontColor:folderObj.fontColor,
            name:folderObj.name,
            children:[],
            icon:folderObj.icon
        }
        //Clearing folders already rendered to prevent duplication
        pack.apps[0].element.find('.cfolders-container').remove();
    
        let e = await pack.documentClass.create(tempData,{pack:pack.collection});
        if (!e.data.flags.cf){
            await e.update({
                id:e.id,
                flags:{
                    cf:{
                        id:folderObj.id,
                        folderPath:newPath,
                        color:folderObj.color,
                        fontColor:folderObj.fontColor,
                        name:folderObj.name,
                        children:[],
                        icon:folderObj.icon
                    }
                }
            })
        }
        console.log(`${modName} | Created temp entity for folder in ${pack.collection}`);
        return newPath
    }
    
}
export class FICFolderAPI{
    //used for external operations, exposed to public
    /*
    * - getFolders(pack)
    * - createFolderAtRoot()
    * - createFolderUnderFolder(folderObj)
    * - moveDocumentToFolder(folderObj)
    * - 
    * - 
    * 
    * 
    * 
    */
   
   
    /*
    * Loads folders in a compendium into WorldCollection: 
    *   game.customFolders.fic.folders
    * Returns the collection too
    */
    static async loadFolders(packCode){
        // Clear the temporary storage of folders
        game.customFolders.fic = {
            folders:new FICFolderCollection([])
        }

        const indexFields = [
            "name",
            "flags.cf",
          ];

        const pack = await game.packs.get(packCode);
        const index = await pack.getIndex({ fields: indexFields });
        const folderIds = index.filter(x => x.name === game.CF.TEMP_ENTITY_NAME).map((i) => i._id);
        const folders = await pack.getDocuments({_id: {$in: folderIds}});
        const entries = index.filter(x => x.name != game.CF.TEMP_ENTITY_NAME);

        for (let folder of folders){
            let contents = entries.filter(x => x.flags?.cf?.id === folder.data.flags.cf.id).map(e => e._id);
            FICFolder.import(packCode,contents,folder);
        }
        return game.customFolders.fic.folders;
    }
    /*
    * Creates folder at the root
    * returns a FICFolder object representing the folder that was created
    */
    static async createFolderAtRoot(packCode,name='New Folder',color='#000000',fontColor='#FFFFFF'){
        let pack = game.packs.get(packCode);
        let folder = {
            id:FICUtils.generateRandomFolderName('temp_'),
            name:name,
            color:color,
            fontColor:fontColor,
            folderPath:[],
            path:name,
            children:[],
            icon:null
        }
        let tempEntityData = FICUtils.getTempEntityData(pack.documentClass.documentName,folder)
        let result = await pack.documentClass.create(tempEntityData,{pack:pack.collection});
        await FICCache.resetCache();
        return FICFolder.import(packCode,[],result);
    }
    /*
    * Creates folder with the given FICFolder object as parent
    * returns a FICFolder object representing the folder that was created
    */
    static async createFolderWithParent(parent,name='New Folder',color='#000000',fontColor='#FFFFFF'){
        let pack = parent.pack;
        let newFolder = {
            id:FICUtils.generateRandomFolderName('temp_'),
            name:name,
            color:color,
            fontColor:fontColor,
            folderPath:parent.folderPath.concat([parent.id]),
            path:parent.path + game.CF.FOLDER_SEPARATOR + parent.name + game.CF.FOLDER_SEPARATOR + name,
            children:[],
            icon:null
        }
        let tempEntityData = FICUtils.getTempEntityData(pack.documentClass.documentName,newFolder)
    
        let result = await pack.documentClass.create(tempEntityData,{pack:pack.collection});
        await FICCache.resetCache();
        return FICFolder.import(parent.packCode,[],result);
    }
    static async moveDocumentToFolder(packCode,document,folder){
        let pack = game.packs.get(packCode);
        // Disassociate old folder id
        let oldParentId = document.data?.flags?.cf?.id;
        if (oldParentId){
            await game.customFolders.fic.folders.get(oldParentId).removeDocument(document.id);
        }
        // Set document folderId to provided folder
        let updateData = {
            flags:{
                cf:{
                    id:folder.id
                }
            },
            id:document.id
        }
        FICUtils.packUpdateEntity(pack,updateData);
        await FICCache.resetCache();
    }
    static async renameFolder(folder,newName){
        const oldName = folder.name;
        folder.name = newName;
        await folder.save();
        ui.notifications.notify("Successfully renamed folder '"+oldName+"' to '"+newName+"'")
    }
    static async refreshPack(folder){
        folder.pack.apps[0].element.find('.cfolders-container').remove();
        folder.pack.apps[0].render(true)
    }
    static async canMoveToDestFolder(folderToMove,destFolder){
        let currentParent = destFolder.parent;
        while (currentParent){
            if (currentParent.id === folderToMove.id){
                //Cant move folder to a child folder of itself
                console.error(modName+" | Can't move folder to a child of itself")
                return false;
            }
            currentParent = currentParent.parent;
        }
        return true
    }
    static async moveFolder(folderToMove,destFolder){
        // Sanity check to see if you arent moving a folder to a child of itself
        if (this.canMoveToDestFolder(folderToMove,destFolder)){
            // Go through folderToMove and all child folders
            // Set path to newPath (cut folderPath at folderToMove, set to destFolder.folderPath + remaining path)
            let newPath = destFolder.folderPath;
            newPath.push(destFolder.id);
            await this.recursivelyUpdateFolderPath(folderToMove,newPath);
            this.refreshPack(folderToMove);
        }
    }
    static async recursivelyUpdateFolderPath(currentFolder,folderPath){
        for (let childFolder of currentFolder.children){
            let childPath = Array.from(folderPath);
            childPath.push(currentFolder.id);
            this.recursivelyUpdateFolderPath(childFolder,childPath);
        }
        currentFolder.folderPath = folderPath;
        await currentFolder.saveNoRefresh();
    }

}