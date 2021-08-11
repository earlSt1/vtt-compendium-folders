import {libWrapper} from './shim.js';
import { Settings } from './compendium-folders.js';
const mod = 'compendium-folders';
const modName = "Compendium Folders";

export class FICUtils{
    static async packUpdateEntity(pack,data){
        const document = await pack.getDocument(data.id);
        const options = {pack:pack.collection};
        return await document.update(data, options);
    }
    static async packDeleteEntity(pack,id){
            const document = await pack.getDocument(id);
            const options = {pack:pack.collection};
            return await document.delete(options);
    }
    static getFolderPath(folder){
        if (folder === null){
            return '';
        }
        let path = folder.data.name;
        if (folder.macroList)
            path = folder.name;
        let currentFolder = folder;
        // while (currentFolder.parent != null){
        //     if (folder.macroList)
        //         path = currentFolder.parent.name+game.CF.FOLDER_SEPARATOR+path;
        //     else
        //         path = currentFolder.parent.data.name+game.CF.FOLDER_SEPARATOR+path;
            
        //     currentFolder = currentFolder.parent;
        // }
        while (currentFolder.parentFolder != null){
            if (folder.macroList)
                path = currentFolder.parent.name+game.CF.FOLDER_SEPARATOR+path;
            else
                path = currentFolder.parentFolder.name+game.CF.FOLDER_SEPARATOR+path;
            
            currentFolder = currentFolder.parentFolder;
        }
        return path;
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
    static getMacroFolderPath(macroId){
        let allFolders = game.settings.get('macro-folders','mfolders')
        let folder = Object.values(allFolders).find(f => f.macroList != null && f.macroList.includes(macroId))
        if (folder != null){
            let folderPath = folder.titleText;
            if (folder.pathToFolder != null && folder.pathToFolder.length > 0){
                folderPath = folder.pathToFolder.map(p => allFolders[p].titleText).join(game.CF.FOLDER_SEPARATOR)+game.CF.FOLDER_SEPARATOR+folderPath
            }
            return folderPath
        }
        return null;
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
            case 'Item': collection = game.items;
                break;
            case 'JournalEntry': collection = game.journal;
                break;
            case 'Macro': collection = game.macros;
                break;
            case 'Macro': collection = game.playlists;
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
            icon:null
        },data);
        this.documentId = data.documentId
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
    static import(packCode,allDocuments,document={}){
        let data = document.data.flags.cf;

        if (!data.newFolderPath){
            // set new folder path using document ID instead of folder ID
            //TODO later
        }
        if (data?.folderPath?.length > 0){
            data.parent = data.folderPath[data.folderPath.length-1];
        }
        if (data.children){
            //hacky solution for collating children for a folder
            data.children = allDocuments.filter(x => x.data.flags.cf.id === data.id).map(y => y.id)
            data.contents = data.children.map(x => allDocuments.find(y => y.id === x));
        }
        return FICFolder.create(data,document.id,packCode);
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
    get contents(){return this.data.contents}
    get name(){return this.data.name}
    get color(){return this.data.color}
    get fontColor(){return this.data.fontColor}
    get icon(){return this.data.icon}
    get folderPath(){return this.data.folderPath}
    get pack(){return game.packs.get(this.packCode)}
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
        // Now store folder structures in game.customFolders.fic.folders + game.customFolders.fic.entries
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
        // Integration with Macro Folders
        Hooks.on('addExportButtonsForCF',async function(){
            FICManager.addMacroFoldersExportButton();
        })
         // Adding export buttons to context menus for folders
        let newContextOption = {
            name: "CF.exportFolderHint",
            icon: '<i class="fas fa-upload"></i>',
            condition: header => {
                return game.user?.isGM && header.parent().find('.entity').length > 0
            },
            callback: header => {
                const li = header.parent()[0];
                FICManager.exportFolderStructureToCompendium(game.folders.get(li.dataset.folderId))
            }  
        }
        
        libWrapper.register(mod, 'ActorDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');
        //ActorDirectory.prototype._getFolderContextOptions = () => oldActorFolderCtxOptions().concat(newContextOption);
        libWrapper.register(mod, 'ItemDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');
        
        libWrapper.register(mod, 'JournalDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');
        
        libWrapper.register(mod, 'RollTableDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');

        libWrapper.register(mod, 'SceneDirectory.prototype._getFolderContextOptions', function (wrapped, ...args) {
            return wrapped(...args).concat(newContextOption);
        }, 'WRAPPER');
        
        // Folders In Compendium changes
        Settings.clearSearchTerms()
        Hooks.on('renderMacroDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.macros.contents.some(m => m.name === game.CF.TEMP_ENTITY_NAME && game.user.isGM)){
                await FICUtils.removeTempEntities('Macro')
            }
        })
        Hooks.on('renderCompendium',async function(e){
            let packCode = e.metadata.package+'.'+e.metadata.name;
            let window = e._element[0]
            if (!e.collection.locked && game.user.isGM)
                FICManager.createNewFolderButtonWithinCompendium(window,packCode);
            if (!e.collection.index.contents.some(x => x.name === game.CF.TEMP_ENTITY_NAME)) return;
        
            FICUtils.removeStaleOpenFolderSettings(packCode);
            let cachedFolderStructure = await FICCache.loadCachedFolderStructure(packCode);
            let allFolderData={};
            let groupedFoldersSorted = {}
            let groupedFolders = {}
            
            if (cachedFolderStructure != null){
                groupedFoldersSorted = cachedFolderStructure;
            }else{
                let folderChildren = {}
                let checkedPaths = []
                let contents = await e.collection.getDocuments();
                let allFolderIds = contents.filter(x => x.data?.flags?.cf?.id != null 
                    && x.name === game.CF.TEMP_ENTITY_NAME).map(y => y.data.flags.cf.id)
                let updateData = [];
                //First parse folder data
                for (let entry of contents){
                    if (entry != null 
                        && entry.data.flags.cf != null){
                        let folderId = entry.data.flags.cf.id;
                        let entryId = entry.id
                        if (folderId != null){
                            if (entry.name === game.CF.TEMP_ENTITY_NAME){
                                if (entry.data.flags.cf.folderPath == null){
                                    let result = FICManager.updateFolderPathForTempEntity(entry,contents);
                                    updateData.push(result); 
                                }else{
                                    let name = entry.data.flags.cf.name
                                    let color = entry.data.flags.cf.color;
                                    let folderPath = entry.data.flags.cf.folderPath;
                                    let folderIcon = entry.data.flags.cf.icon
                                    let fontColor = entry.data.flags.cf.fontColor;
                                    let data = {
                                        id:folderId,
                                        color:color, 
                                        children:[],
                                        name:name,
                                        folderPath:folderPath,
                                        tempEntityId:entryId,
                                        icon:folderIcon,
                                        fontColor:fontColor
                                    }
                                    if (allFolderData[folderId])
                                        allFolderData[folderId] = foundry.utils.mergeObject(data,allFolderData[folderId]);
                                    else   
                                        allFolderData[folderId] = data;
                                }
                            }
                            else if (entry.data.flags.cf.id != null
                                && entry.name != game.CF.TEMP_ENTITY_NAME
                                && !allFolderIds.includes(entry.data.flags.cf.id)){
                                updateData.push(FICManager.removeOrUpdateFolderIdForEntity(entry,contents));
                            }
                            if (allFolderData[folderId] != null && allFolderData[folderId].children != null){
                                allFolderData[folderId].children.push(entryId);
                            }else{
                                allFolderData[folderId] = {children:[entryId]}
                            }
                        }
                    }
                }
                for (let key of Object.keys(folderChildren)){
                    allFolderData[key].children = folderChildren[key].children
                }          
        
                if (updateData.length>0){
                    ui.notifications.notify('Updating folder structure. Please wait...')
                    e.close().then(async () => {
                        if (game.user.isGM){
                            for (let d of updateData){
                                await FICUtils.packUpdateEntity(e.collection,d);
                            }
                            FICCache.resetCache()
                            ui.notifications.notify('Updating complete!')
                            e.render(true);
                        }else{
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
                    }else{
                        depth = allFolderData[key].folderPath.length
                        // Add all parent folders to list
                        // Need to make sure to render them
                    }
                    if (groupedFolders[depth] == null){
                        groupedFolders[depth] = [allFolderData[key]];
                    }else{
                        groupedFolders[depth].push(allFolderData[key]);
                    }
                    groupedFolderMetadata[key] = {depth:depth, index:groupedFolders[depth].length-1}
                });
                Object.keys(groupedFolders).sort(function(o1,o2){
                    if (parseInt(o1)<parseInt(o2)){
                        return -1;
                    }else if (parseInt(o1>parseInt(o2))){
                        return 1;
                    }return 0;
                }).forEach((key) => {
                    groupedFoldersSorted[key] = groupedFolders[key]
                })
                await FICCache.cacheFolderStructure(packCode,groupedFoldersSorted,groupedFolderMetadata);
            }
            console.log(modName+' | Creating folder structure inside compendium.');
            let openFolders = game.settings.get(mod,'open-temp-folders');
            await FICManager.createFoldersWithinCompendium(groupedFoldersSorted,packCode,openFolders);
            for (let entity of window.querySelectorAll('.directory-item')){
                if (entity.querySelector('h4').innerText.includes(game.CF.TEMP_ENTITY_NAME)){
                    entity.style.display = 'none';
                    entity.classList.add('hidden')
                }
            }
            if (game.user.isGM && !e.locked){
                // Moving between folders
                let hiddenMoveField = document.createElement('input');
                hiddenMoveField.type='hidden'
                hiddenMoveField.style.display='none';
                hiddenMoveField.classList.add('folder-to-move');
                window.querySelector('ol.directory-list').appendChild(hiddenMoveField);
                
                for (let entity of window.querySelectorAll('.directory-item')){
                    entity.addEventListener('dragstart',async function(){
                        let currentId = this.getAttribute('data-document-id');
                        this.closest('ol.directory-list').querySelector('input.folder-to-move').value = currentId
                    })
                }
                for (let folder of window.querySelectorAll('.compendium-folder')){
                    folder.addEventListener('drop',async function(event){
                        let movingItemId = this.closest('ol.directory-list').querySelector('input.folder-to-move').value;
                        if (movingItemId.length>0){
                            console.log(modName+' | Moving document '+movingItemId+' to new folder.')
                            this.closest('ol.directory-list').querySelector('input.folder-to-move').value = '';
                            //let entryInFolderElement = this.querySelector(':scope > div.folder-contents > ol.entry-list > li.directory-item')
        
                            let packCode = this.closest('.directory.compendium').getAttribute('data-pack');
                            let p = game.packs.get(packCode);                          
                            let targetFolder = await  p.getDocument(folder.getAttribute('data-temp-entity-id'))
                            let data = {
                                id:movingItemId,
                                flags:{
                                    cf:{
                                        id:folder.getAttribute('data-folder-id'),
                                        path:targetFolder.data.flags.cf.path,
                                        color:targetFolder.data.flags.cf.color   
                                    }
                                }
                            }
                            await FICCache.moveEntryInCache(packCode,movingItemId,this.getAttribute('data-folder-id'))
                            if (data){ 
                                const document = await p.getDocument(data.id);
                                await document.update(data,{pack:p.collection})
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
        let parents = content.filter(e => e.data.flags != null 
            && e.data.flags.cf != null 
            && entity.data.flags.cf.path.startsWith(e.data.flags.cf.path,0) 
            && e.name === game.CF.TEMP_ENTITY_NAME);
        console.debug(entity.data.flags.cf.path+" is entity");
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
        updateData.id = entity.id
        console.debug(updateData);
        
        return updateData;
    }
    static removeOrUpdateFolderIdForEntity(entity,content){
        let parent = content.find(e => e.name === game.CF.TEMP_ENTITY_NAME 
            && e.data.flags.cf.path != null 
            && e.data.flags.cf.path === entity.data.flags.cf.path);
        let folderId = null
        if (parent != null){
            folderId = parent.data.flags.cf.id
        }
        let updateData = {
            flags:{
                cf:{
                    id:folderId
                }
            },
            id:entity.id
        }
        return updateData
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
    
    static addMacroFoldersExportButton(){
        let newContextOption = {
            name: "CF.exportFolderHint",
            icon: '<i class="fas fa-upload"></i>',
            condition: header => {
                return game.user?.isGM && header.parent().find('.entity').length > 0
            },
            callback: async (header) => {
                const li = header.parent()[0];
                let folder = game.customFolders.macro.folders.get(li.getAttribute('data-folder-id'));
                await FICManager.exportFolderStructureToCompendium(folder);
            }  
        }
        let old = ui.macros.constructor.prototype._getFolderContextOptions();
        ui.macros.constructor.prototype._getFolderContextOptions = function(){
            return old.concat(newContextOption)
        }
        return;
    }
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
            merge: game.settings.get(mod,'default-mbn')
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
                let folderPath = await FICManager.createParentFoldersWithinCompendium(folder,pack);
                // First check if there is an existing folder for current folder
                let existingFolderId = await FICManager.getExistingFolderId(folder,pack)
                if (existingFolderId != null){
                    await FICManager.recursivelyExportFolders(index,pack,folder,existingFolderId,folderPath,form.merge.checked)
                }else{
                    await FICManager.recursivelyExportFolders(index,pack,folder,FICUtils.generateRandomFolderName('temp_'),folderPath,form.merge.checked)
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
        //Also check for old folder paths (not using separator)
        let folderPathOld = folderPath.replace(game.CF.FOLDER_SEPARATOR,'/')
        let content = await pack.getDocuments();
        let existingFolder = content.find(e => e.name === game.CF.TEMP_ENTITY_NAME 
            && (e.data.flags.cf.path === folderPath 
                || e.data.flags.cf.path === folderPathOld) 
            && e.data.flags.cf.name === folder.name)
        if (existingFolder){
            return existingFolder.data.flags.cf.id;
        }
        return null;
    }
    static async createParentFoldersWithinCompendium(folder,pack){
        let parents = []
        let currentFolder = folder;
        let content = await pack.getDocuments();
        let tempEntities = content.filter(e => e.name === game.CF.TEMP_ENTITY_NAME);
    
        while (currentFolder.parentFolder != null){
            parents.push(currentFolder.parentFolder);
            currentFolder = currentFolder.parentFolder;
        }
        let previousParent = null;
        let previousPath = []
        for (let i=parents.length-1 ;i>=0;i--){
            let tempEntity = tempEntities.find(e => e.data.flags.cf.name === parents[i].name 
                && (e.data.flags.cf.path === FICUtils.getFolderPath(parents[i]) 
                    ||FICUtils.arraysEqual(e.data.flags.cf.folderPath,previousPath)))
            if (tempEntity != null){
                // if folder with parent name exists, and path matches, use that tempEntity id
                previousParent = tempEntity.data.flags.cf.id;
                
            }else{
                // If folder does not exist, create tempEntity and use folderPath of previous parent value
                previousParent = FICUtils.generateRandomFolderName('temp_')
                tempEntity = FICUtils.getTempEntityData(pack.documentClass.documentName,{
                    id:previousParent,
                    name:parents[i].name,
                    color:parents[i].macroList ? parents[i].color : parents[i].data.color,
                    folderPath:previousPath,
                    children:[]
                });
                
                await pack.documentClass.create(tempEntity,{pack:pack.collection});
               
            }
            previousPath.push(previousParent)
        }
        return previousPath;
    }
    static async recursivelyExportFolders(index,pack,folderObj,folderId,folderPath,merge){
        if (folderObj.children.length==0){
            let entities = folderObj.content;
            let updatedFolder = await FICManager.exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,folderPath,merge)
            if (updatedFolder != null){
                return [updatedFolder];
            }
            return []
        }
        for (let child of folderObj.children){
            let newPath = Array.from(folderPath);
            if (!newPath.includes(folderId))
                newPath.push(folderId)
    
            let existingFolderId = await FICManager.getExistingFolderId(child,pack)
            if (existingFolderId === null)
                existingFolderId = FICUtils.generateRandomFolderName('temp_')
            await FICManager.recursivelyExportFolders(index,pack,child,existingFolderId,newPath,merge)
        }
        let entities = folderObj.content;
        
        await FICManager.exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,folderPath,merge)
    }
    static async exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,folderPath,merge){
        let path = FICManager.getFullPath(folderObj)
        let content = await pack.getDocuments();
        let existingFolder = content.find(e => e.name === game.CF.TEMP_ENTITY_NAME 
            && e.data?.flags?.cf?.id === folderId)
        if (existingFolder){
            // Use existing
            folderId = existingFolder.data.flags.cf.id
            path = existingFolder.data.flags.cf.path
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
            if (game.modules.get('macro-folders')?.active && e instanceof game.MF?.MacroEntry)
                e = e.macro
            let data = await e.toCompendium();
            data.flags.cf={
                id:folderId,
                path:path,
                color:color,
            }
            let existing = merge ? index.find(i => i.name === data.name) : index.find(i => i._id === e.id);
            if ( existing ) data.id = existing._id;
            if ( data.id ){
                // Remove child from old parent
                let oldParent = content.find(n => n.name === game.CF.TEMP_ENTITY_NAME && n.data?.flags?.cf?.children?.includes(data.id) && n.data.flags.cf.id != folderId)
                if (oldParent){
                    let nData = {
                        id: oldParent.id,
                        flags:{
                            cf:{
                                children:oldParent.data.flags.cf.children.filter(m => m != data.id)
                            }
                        }
                    }
                    await FICUtils.packUpdateEntity(pack,nData);
                     //Update saved content for future reference
                    oldParent.data.flags.cf.children = oldParent.data.flags.cf.children.filter(m => m != data.id);
                }
               
                packEntities.push(existing._id)
                
                await FICUtils.packUpdateEntity(pack,data);           
            }
            else {
                result = await pack.documentClass.create(data,{pack:pack.collection});
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
                id:existingFolder.id,
                flags:{
                    cf:{
                        children:[...new Set(existingFolder.data.flags.cf.children.concat(packEntities))]
                    }
                }
            }
            await FICUtils.packUpdateEntity(pack,folderData)
    
        }
        console.log(`${modName} | Exported temp entity to ${pack.collection}`);
        
        return folderObj
    }
    static async importFromCollectionWithMerge(clsColl,collection, entryId, folderPath, updateData={}, options={},merge=false) {
        const pack = game.packs.get(collection);
        const cls = pack.documentClass;
        if (pack.metadata.entity !== cls.documentName) {
          throw new Error(`The ${pack.documentName} Document type provided by Compendium ${pack.collection} is incorrect for this Collection`);
        }
    
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
                case 'Item':search = game.items.contents.filter(i => i.name === sourceData.name && FICUtils.getFolderPath(i.folder)===folderPath)
                            break;
                case 'JournalEntry':search = game.journal.contents.filter(j => j.name === sourceData.name && FICUtils.getFolderPath(j.folder)===folderPath)
                            break;
                case 'Macro':search = game.macros.contents.filter(m => m.name === sourceData.name && FICUtils.generateRandomFolderName(m.id)===folderPath)
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
    // ==========================
    // Importing folders from compendiums
    // ==========================
    static async recursivelyImportFolders(pack,coll,folder,merge){
        //First import immediate children
        let folderPath = FICUtils.getRenderedFolderPath(folder)
        for (let entry of folder.querySelectorAll(':scope > .folder-contents > .entry-list > li.directory-item')){
            // Will invoke FICManager.importFolderData()
            //if (!entry.classList.contains('hidden'))
            await FICManager.importFromCollectionWithMerge(coll,pack.collection,entry.getAttribute('data-document-id'),folderPath, {}, {renderSheet:false},merge)
            // Wait a short amount of time for folder to fully create
            await new Promise(res => setTimeout(res,100));
        }
        //Then loop through individual folders
        let childFolders = folder.querySelectorAll(':scope > .folder-contents > .folder-list > li.compendium-folder');
        if (childFolders.length>0){
            for (let child of childFolders){
                await FICManager.recursivelyImportFolders(pack,coll,child,merge);
            }
        }
    }
    static async importAllParentFolders(pack,coll,folder,merge){
        if (!folder.parentElement.classList.contains('directory-list')){
            let parentList = [folder]
            let parent = folder
            while (!parent.parentElement.parentElement.classList.contains('directory-list')){
                parent = parent.parentElement.parentElement.parentElement
                parentList.push(parent);            
            }
    
            for (let p of parentList.reverse()){
                if (p.querySelector(':scope > .folder-contents > .entry-list > li.directory-item.hidden')){
                    await FICManager.importFromCollectionWithMerge(coll,
                        pack.collection,
                        p.querySelector(':scope > .folder-contents > .entry-list > li.directory-item.hidden').getAttribute('data-document-id'),
                        FICUtils.getRenderedFolderPath(p),
                        {flags:{cf:{import:true}}},
                        {renderSheet:false},
                        merge);
                }
    
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
                <div class='form-group'><label for='merge'>Merge by name</label><input type='checkbox' name='merge' ${game.settings.get(mod,'default-mbn')?'checked':''}/></div></form>`,
            yes: async (h) => {
                await game.settings.set(mod,'importing',true);
                let merge = h[0].querySelector('input[name=\'merge\']').checked
                ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationStart"))
                let packCode = folder.closest('.directory.compendium').getAttribute('data-pack');
                let pack = await game.packs.get(packCode);
                let coll = pack.contents;
                let packEntity = pack.documentClass.documentName;    
                await FICManager.importAllParentFolders(pack,coll,folder,merge);
                await FICManager.recursivelyImportFolders(pack,coll,folder,merge);
                ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationFinish"));
                await FICUtils.removeTempEntities(packEntity);
                if (packEntity === 'Macro')
                    ui.macros.refresh();
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
        //headerTitle.classList.add('.entry-name');
        
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
            if (game.packs.get(packCode).documentClass.documentName != 'Playlist'
                && game.packs.get(packCode).documentClass.documentName != 'Macro'){ // Temporarily disabling the Import Folder structure for Macros (needs to be fixed later)
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
    // ==========================
    static async importFolderData(e){
        if (e.compendium) return;
        let isMacro = e.documentName === 'Macro'
        if (e.data.flags.cf != null  && e.data.flags.cf.path != null && !e.folder){
            let path = e.data.flags.cf.path;
            let color = e.data.flags.cf.color;
            //a.data.folder -> id;
            let foundFolder = null;
            let folderExists=false;
            if (isMacro){
                let allMacroFolders = game.settings.get('macro-folders','mfolders')
                for (let folder of Object.entries(allMacroFolders)){
                    if (folder.pathToFolder != null){
                        let folderPath = folder.pathToFolder.map(m => allMacroFolders[m].titleText).join(game.CF.FOLDER_SEPARATOR)
                        if (!folderPath.contains(game.CF.FOLDER_SEPARATOR)){
                            folderPath = folder.titleText;
                        }
                        if (folderPath === path){
                            folderExists=true;
                            foundFolder=folder
                        }
                    }
                }
            }else{
                for (let folder of game.folders.values()){
                    if (folder.data.type==e.documentName){
                        if (FICUtils.getFolderPath(folder) === path){
                            folderExists=true;
                            foundFolder=folder;
                        }
                    }
                }
            }
            if (folderExists){
                if (isMacro){
                    let allMacroFolders = game.settings.get('macro-folders','mfolders')   
                    for (let mfId of Object.keys(allMacroFolders)){
                        allMacroFolders[mfId].macroList.filter(m => m != e._id)
                    }
                    allMacroFolders[folder._id].macroList.push(e._id);
                    await game.settings.set('macro-folders','mfolders',allMacroFolders);
                }else{
                    await e.update({folder : foundFolder.id,flags:{cf:null}})
                }
            }else{
                if (isMacro){
                    await FICManager.createMacroFolderPath(path,color,e);
                }else{
                    await FICManager.createFolderPath(path,color,e.documentName,e);
                }
            }
        }
    }
    static async createFolderPath(path,pColor,entityType,e){
        let segments = path.split(game.CF.FOLDER_SEPARATOR);
        let index = 0;
        for (let seg of segments){
            let folderPath = segments.slice(0,index).join(game.CF.FOLDER_SEPARATOR)+game.CF.FOLDER_SEPARATOR+seg
            if (index==0){
                folderPath = seg
            }
            let results = game.folders.filter(f => f.type === entityType && FICUtils.getFolderPath(f) === folderPath)
            if (results.length==0 ){
                //Create the folder if it does not exist
                let parentId = null
                let tContent = [];
                if (index>0){
                    parentId = game.folders.filter(f => f.type===entityType 
                        && f.name===segments[index-1] 
                        && FICUtils.getFolderPath(f) === segments.slice(0,index).join(game.CF.FOLDER_SEPARATOR))[0].id
                }
                let data = {
                    name:seg,
                    sorting:'a',
                    parent:parentId,
                    type:entityType,
                    content:tContent
                }
                if (index == segments.length-1){
                    data.color=pColor;
                    
                }
                let f = await Folder.create(data);
                if (index == segments.length-1){
                    await e.update({folder:f.id,flags:{cf:null}});
                }
            }
            index++;
        }
    }
    ///TODO fix
    static async createMacroFolderPath(path,pColor,e){
        let allMacroFolders = game.settings.get('macro-folders','mfolders')
        game.settings.set('macro-folders','updating',true)  
        let lastId = null;
        let segments = path.split(game.CF.FOLDER_SEPARATOR);
        let index = 0;
        for (let seg of segments){
            let folderPath = segments.slice(0,index).join(game.CF.FOLDER_SEPARATOR)+game.CF.FOLDER_SEPARATOR+seg
            if (index==0){
                folderPath = seg
            }
            let results = game.customFolders.macro.folders.filter(f => f.data.pathToFolder != null 
                && FICManager.getFullPath(f) === folderPath)
            if (results.length==0 ){
                //create folder
                let newFolder = await game.MF.MacroFolder.create({
                    titleText:seg,
                    macroList:[],
                    pathToFolder:[]
                });
                if (index == segments.length-1){
                    newFolder.color = pColor;
                    await newFolder.addMacro(e._id)
                }
                if (lastId != null){
                    newFolder.data.pathToFolder = Array.from(allMacroFolders[lastId].pathToFolder)
                    newFolder.data.pathToFolder.push(lastId);
                }
                await newFolder.save(false);
                lastId = newFolder._id;
            }else{
                //Folder exists, add entity to thing
                lastId = results[0]._id
                if (index == segments.length-1){
                    await results[0].addMacro(e._id);
                }
            }
            index++;
        }
       
        game.settings.set('macro-folders','updating',false)  
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

        let allDocuments = await game.packs.get(packCode).getDocuments();
        let folders = allDocuments.filter(x => x.name === game.CF.TEMP_ENTITY_NAME)
        let entries = allDocuments.filter(x => x.name != game.CF.TEMP_ENTITY_NAME);

        for (let folder of folders){
            FICFolder.import(packCode,entries,folder);
        }
        return game.customFolders.fic.folders;
    }
    /*
    * Creates folder at the root
    * returns a FICFolder object representing the folder that was created
    */
    static async createFolderAtRoot(packCode,name='New Folder',color='#000000',fontColor='#FFFFFF'){
        let pack = game.packs.get(packCode);
        pack.apps[0].close().then(async () => {
            let folder = {
                id:FICUtils.generateRandomFolderName('temp_'),
                name:name,
                color:color,
                fontColor:fontColor,
                folderPath:[],
                children:[],
                icon:null
            }
            let tempEntityData = FICUtils.getTempEntityData(pack.documentClass.documentName,folder)
            let result = await pack.documentClass.create(tempEntityData,{pack:pack.collection});
            await FICCache.resetCache();
            return FICFolder.import(packCode,[],result);
        });
    }
    /*
    * Creates folder with the given FICFolder object as parent
    * returns a FICFolder object representing the folder that was created
    */
    static async createFolderWithParent(parent,name='New Folder',color='#000000',fontColor='#FFFFFF'){
        let pack = parent.pack;
        pack.apps[0].close().then(async () => {
            let newFolder = {
                id:FICUtils.generateRandomFolderName('temp_'),
                name:name,
                color:color,
                fontColor:fontColor,
                folderPath:parent.folderPath.concat([parent.id]),
                children:[],
                icon:null
            }
            let tempEntityData = FICUtils.getTempEntityData(pack.documentClass.documentName,newFolder)
        
            let result = await pack.documentClass.create(tempEntityData,{pack:pack.collection});
            await FICCache.resetCache();
            return FICFolder.import(parent.packCode,[],result);
        })
    }
    static async moveDocumentToFolder(packCode,document,folder){
        let pack = game.packs.get(packCode);
        pack.apps[0].close().then(async () => {
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
        });
    }
}




    