export const modName = 'Compendium Folders';
const mod = 'compendium-folders';
const FOLDER_LIMIT = 8
const TEMP_ENTITY_NAME = '#[CF_tempEntity]'
const FOLDER_SEPARATOR = '#/CF_SEP/'

// ==========================
// Utility functions
// ==========================
function arraysEqual(array1,array2){
    return array1.length === array2.length && array1.every(function(value, index) { return value === array2[index]})
}
async function getFolderData(packCode,tempEntityId){
    let pack = game.packs.get(packCode)
    let tempEntity = await pack.getEntity(tempEntityId);
    return tempEntity.data.flags.cf;
}
function closeContextMenu(){
    let contextMenu = document.querySelector('nav#folder-context-menu');
    if (contextMenu!=null)
        contextMenu.parentNode.removeChild(contextMenu);
}
function createContextMenu(header,event){
    let folder = header.parentElement
    let folderName = folder.querySelector('h3').innerText
    let folderId = folder.getAttribute('data-folder-id');
    let tempEntityId = folder.getAttribute('data-temp-entity-id')
    let packCode = event.currentTarget.closest('.sidebar-tab.compendium').getAttribute('data-pack')
    if (document.querySelector('nav#folder-context-menu')!=null){
        closeContextMenu()
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
            closeContextMenu();
            let path = getRenderedFolderPath(folder);
            let folderData = await getFolderData(packCode,tempEntityId);
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
        closeContextMenu();
        
        new Dialog({
            title: game.i18n.localize('CF.deleteFolder'),
            content: "<p>"+game.i18n.format('CF.deletePromptL1',{folderName:folderName})+"</p>",
            buttons: {
                deleteFolder: {
                    icon: '<i class="fas fa-folder"></i>',
                    label: "Delete Folder",
                    callback: () => {deleteFolderWithinCompendium(packCode,folder,false);resetCache();}
                },
                deleteAll:{
                    icon: '<i class="fas fa-trash"></i>',
                    label: "Delete All",
                    callback: ( )=> {deleteFolderWithinCompendium(packCode,folder,true);resetCache();}
                }
            }
        }).render(true);
    })
    contextMenuList.appendChild(deleteOption);
        
    contextMenu.appendChild(contextMenuList);
    
    document.addEventListener('click',function(ev){
        ev.stopPropagation();
        if (ev.target!=folder){
            closeContextMenu()
        }
    });

    contextMenu.id='folder-context-menu';
    contextMenu.style.marginTop="32px"; 

    folder.insertAdjacentElement('beforebegin',contextMenu);
}
function getFullPath(folderObj){
    let path = folderObj.name;
    let currentFolder = folderObj;
    while (currentFolder.parent != null){
        currentFolder = currentFolder.parent;
        path = currentFolder.name+FOLDER_SEPARATOR+path;
    }
    return path;
}
async function removeStaleOpenFolderSettings(packCode){
    let openFolders = game.settings.get(mod,'open-temp-folders')
    let newSettings = {}
    newSettings[packCode]=openFolders[packCode];
    await game.settings.set(mod,'open-temp-folders',newSettings);
}
function getTempEntityData(entityType,folder){
    switch (entityType){
        case 'Actor': return {name:TEMP_ENTITY_NAME,type:Object.keys(CONFIG.Actor.typeLabels)[0],flags:{cf:folder}}

        case 'Item': return {name:TEMP_ENTITY_NAME,type:Object.keys(CONFIG.Item.typeLabels)[0],flags:{cf:folder}}
 
        case 'Macro':return {name:TEMP_ENTITY_NAME,type:'chat',command:'',flags:{cf:folder}} 

        default:     
            return {name:TEMP_ENTITY_NAME,flags:{cf:folder}};      
    }
}
async function removeTempEntities(entityType){
    let collection = null
    switch (entityType){
        case 'Actor': collection = ui.actors.constructor.collection;
            break;
        case 'Item': collection = ui.items.constructor.collection;
            break;
        case 'JournalEntry': collection = ui.journal.constructor.collection;
            break;
        case 'Macro': collection = ui.macros.constructor.collection;
            break;
        case 'Macro': collection = ui.playlists.constructor.collection;
            break;
        case 'RollTable':collection = ui.tables.constructor.collection;
            break;
        case 'Scene':collection = ui.scenes.constructor.collection;           
    }
    if (collection != null){
        let tempEntities = duplicate(collection.entries.filter(x => x.name.includes(TEMP_ENTITY_NAME)).map(y => y.id));
        for (let tempEntity of tempEntities){
            let entity = collection.get(tempEntity);
            try{
                await entity.delete(entity)
            }catch (e){
                console.debug(modName + '| Entity no longer exists in collection');
            }
        } 
    }
    
}
function getFolderPath(folder){
    if (folder === null){
        return '';
    }
    let path = folder.data.name;
    if (folder.macroList)
        path = folder.name;
    let currentFolder = folder;
    while (currentFolder.parent != null){
        if (folder.macroList)
            path = currentFolder.parent.name+FOLDER_SEPARATOR+path;
        else
            path = currentFolder.parent.data.name+FOLDER_SEPARATOR+path;
        
        currentFolder = currentFolder.parent;
    }
    return path;
}
function getRenderedFolderPath(folder){
    let path = folder.querySelector('h3').innerText;
    let currentFolder = folder;

    while (currentFolder.parentElement.parentElement.parentElement.tagName === 'LI'){
        path = currentFolder.parentElement.parentElement.parentElement.querySelector('h3').innerText + FOLDER_SEPARATOR + path;
        currentFolder = currentFolder.parentElement.parentElement.parentElement
    }
    return path;
}
function getMacroFolderPath(macroId){
    let allFolders = game.settings.get('macro-folders','mfolders')
    let folder = Object.values(allFolders).find(f => f.macroList != null && f.macroList.includes(macroId))
    if (folder != null){
        let folderPath = folder.titleText;
        if (folder.pathToFolder != null){
            folderPath = folder.pathToFolder.map(p => allFolders[p].titleText).join(FOLDER_SEPARATOR)+FOLDER_SEPARATOR+folderPath
        }
        return folderPath
    }
    return null;
}

function generateRandomFolderName(prefix){
    return Math.random().toString(36).replace('0.',prefix || '');
}
Handlebars.registerHelper('ifIn', function(elem, compendiums, options) {
    let packName = elem.package+'.'+elem.name;
    if(compendiums.indexOf(packName) > -1) {
      return options.fn(this);
    }
    return options.inverse(this);
});
function alphaSortFolders(folders,selector){
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

function alphaSortCompendiums(compendiums){
    compendiums.sort(function(first,second){
        let firstName = first.metadata.package+'.'+first.metadata.name;
        let secondName = second.metadata.package+'.'+second.metadata.name;
        if (firstName < secondName){
            return -1;
        }else if (firstName > secondName){
            return 1;
        }else{
            return 0;
        }
    });
    return compendiums;
}
// ==========================
// Folder object structure
// ==========================
export class CompendiumEntryCollection extends EntityCollection{
    constructor(...args) {
        super(...args);
    }
    /** @override */
    get entity() {
        return "CompendiumEntry";
    }
}
export class CompendiumEntry {
    constructor(pc,parentId){
        this._id = pc;
        this.data = {}
        this.data.code = pc;
        this.data.folder = parentId;
        if (!game.customFolders){
            game.customFolders = new Map();
        }
        if (!game.customFolders.compendium){
            game.customFolders.compendium = {
                entries:new CompendiumEntryCollection([]),
                folders:new CompendiumFolderCollection([])
            }
        }
        game.customFolders.compendium.entries.insert(this);
    }
     /** @override */
     static create(data={}){
        let newEntry = new CompendiumEntry(data);
        
        return newEntry;
    }
    get packCode(){
        return this.data.code;
    }
    get pack(){
        return game.packs.get(this.data.code);
    }
    get parent(){
        return CompendiumFolder.collection.get(this.data.folder)
    }
    get folder(){
        return this.data.folder;
    }
    set folder(f){
        this.data.folder = f
    }
    get all(){
        return [...game?.customFolders?.compendium?.entries]
    }
    get id(){return this.data.code}
    get visible(){
        return game.user.isGM || !this.pack.private
    }
    get name(){return this.pack.title}
}
export class CompendiumFolderCollection extends EntityCollection{
    constructor(...args) {
        super(...args);
    }
    /** @override */
    get entity() {
        return "CompendiumFolder";
    }
    get hidden(){
        return this.find(f => f.isHidden);
    }
    get default(){
        return this.find(f => f.isDefault);
    }
    
}
export class CompendiumFolder extends Folder{
    constructor(data={}){
        super(mergeObject({
            titleText:'New Folder',
            colorText:'#000000',
            fontColorText:'#FFFFFF',
            type:"CompendiumEntry",
            _id:'cfolder_'+randomID(10),
            entity:"CompendiumFolder",
            sorting:'a',
            parent:null,
            pathToFolder:[],
            compendiumList:[],
            compendiums:[],
            folderIcon:null,
            expanded:false
        },data));
    }
    _getSaveData(){
        let data = Object.assign({},this.data);
        delete data.compendiums;
        delete data.content;
        delete data.children;
        return data;
    }
    /** @override */
    static create(data={}){
         let newFolder = new CompendiumFolder(data);
        if (!game.customFolders){
            game.customFolders = new Map();
        }
        if (!game.customFolders.compendium){
            game.customFolders.compendium = {
                entries:new CompendiumEntryCollection([]),
                folders:new CompendiumFolderCollection([])
            }
        }
        game.customFolders.compendium.folders.insert(newFolder);

        return newFolder;
    }
    static import(data={},compendiums){
        if (data?.pathToFolder?.length > 0){
            data.parent = data.pathToFolder[data.pathToFolder.length-1];
        }
        if (compendiums){
            data.compendiums = compendiums;
        }else{
            data.compendiums = []
        }
        // Set open state
        data.expanded = game.settings.get(mod,'open-folders').includes(data._id)

        return CompendiumFolder.create(data);
    }
    // Update using data
    async update(data=this.data,refresh=true){
        this.data = mergeObject(data,this.data)
        // Update game folder
        this.collection.get(this.id).data = this.data;
        await this.save(refresh);
    }
    // Save object state to game.customFolders and settings
    async save(refresh=true){
        if (!this.collection.get(this.id)){
            this.collection.insert(this);
        }
        if (game.user.isGM){
            let allFolders = game.settings.get(mod,'cfolders')
            let currentFolder = allFolders[this.id];
            if (!currentFolder){
                // create folder
                allFolders[this.id] = this._getSaveData();
                
            }else{
                allFolders[this.id] = mergeObject(currentFolder,this._getSaveData());
            }
            await game.settings.set(mod,'cfolders',allFolders)
        }
        game.customFolders.compendium.folders.get(this._id).data = Object.assign({},this.data);
        if (refresh)
            ui.compendium.render(true);
    }
    async delete(refresh=true){
        let nextFolder = (this.parent) ? this.parent : this.collection.default;
        for (let pack of this.compendiumList){
            await nextFolder.addCompendium(pack);
        }

        for (let child of this.children){
            if (this.parent){
                await child.moveFolder(this.parent._id,false);
            }else{
                await child.moveToRoot();
            }
        }

        if (this.collection.get(this.id)){
            this.collection.remove(this.id)
        }
        
        let allFolders = game.settings.get(mod,'cfolders')
        // create folder
        delete allFolders[this.id];
        
        await game.settings.set(mod,'cfolders',allFolders)
        if (refresh)
            ui.compendium.render(true);
        
    }
    async addCompendium(packCode,refresh=true){
        let entry = game.customFolders.compendium.entries.get(packCode);
        if (entry){
            //Move from old entry to new entry
            let oldParent = entry.parent;
            this._addPack(entry);
            if (oldParent){
                oldParent._removePack(entry)
                await oldParent.save(false);
            }
            game.customFolders.compendium.entries.set(packCode,entry)
        }else{
            //Create entry and assign to this obj
            entry = new CompendiumEntry(packCode,this.id);
            //game.customFolders.compendium.entries.insert(entry);
            this._addPack(entry);
            
        }
        //update(entry.data);
        await this.save(refresh);
    }
    async removeCompendium(pack,del=false,refresh=true){
        this._removePack(pack,del);
        if (del){
            game.customFolders.compendium.entries.remove(pack.packCode);
        }else{
            let entry = game.customFolders.compendium.entries.get(pack.packCode);
            let hiddenFolder = this.collection.hidden;
            hiddenFolder._addPack(entry);
            await hiddenFolder.save(false);
        }
        await this.save(refresh);
    }
    async removeCompendiumByCode(packCode,del=false,refresh=true){
        await this.removeCompendium(game.customFolders.compendium.entries.get(packCode),del,refresh);
    }
    async moveFolder(destId,updateParent=true){
        let destFolder = this.collection.get(destId);
        await this._moveToFolder(destFolder,updateParent);
    }
    async moveToRoot(){
        this.path = []
        this.parent = null
        await this._updatePath()
        await this.save(false);
    }
    _addPack(pack){
        if (!this.data.compendiumList.includes(pack.packCode)){
            this.content = this.content.concat(pack);
            this.data.compendiumList = this.data.compendiumList.concat(pack.packCode);
        }
        pack.folder = this._id;
    }
    _removePack(pack,del=false){
        this.data.compendiumList = this.data.compendiumList.filter(x => x != pack.packCode);
        this.content = this.content.filter(x => x.packCode != pack.packCode);
        if (del && pack.folder)
            pack.folder = null
    }
    _removeFolder(child){
        this.children = this.children.filter(c => c.id != child.id);
    }
    async _moveToFolder(destFolder, updateParent=true){

        this.path = (destFolder) ? destFolder.path.concat(destFolder.id) : [];
        if (this.parent && updateParent){
            this.parent._removeFolder(this);
            await this.parent.save(false); 
        }
        if (destFolder){
            this.parent = destFolder._id;
            this.parent.children = this.parent.children.concat(this);
            await this.parent.save(false);
            this.path = this.parent.path.concat(destFolder._id)
        }else{
            this.parent = null;
            this.path = [];
        }
        
        await this.save(false);
        
        await this._updatePath()
        ui.compendium.refresh();
    }
    // Update path of this and all child folders
    async _updatePath(currentFolder=this,parent=this){
        if (currentFolder.id != parent.id){
            currentFolder.path = parent.path.concat(parent.id);
            await currentFolder.update(currentFolder.data,false);
        }
        if (currentFolder.children){
            for (let child of currentFolder.children){
                child._updatePath(child,currentFolder);
            }
        }
    }
    /** @override */
    get collection(){
        return game?.customFolders?.compendium?.folders
    }
    /** @override */
    get entity(){return this.data.entity;}

    /** @override */
    get content(){return this.data.compendiums}

    /** @override */
    set content(c){this.data.compendiums = c;}

    /** @override */
    get children(){return this.data.children}

    set children(c){this.data.children = c;}
    /** @override */
    static get collection(){
        return game?.customFolders?.compendium?.folders
    }

    get name(){return this.data.titleText}
    set name(n){this.data.titleText = n;}
    get color(){return this.data.colorText}
    set color(c){this.data.colorText = c;}
    get fontColor(){return this.data.fontColorText}
    set fontColor(fc){this.data.fontColorText = fc;}
    get icon(){return this.data.folderIcon}
    set icon(i){this.folderIcon = i;}
    get compendiumList(){return this.data.compendiumList};
    set compendiumList(c){this.data.compendiumList = c}
    set folderIcon(i){this.data.folderIcon = i}
    get path(){return this.data.pathToFolder}
    set path(p){this.data.pathToFolder = p}
    set children(c){this.data.children = c}
    get parent(){return this.collection.get(this.data.parent)}
    set parent(p){this.data.parent = p}
    get isDefault(){return this.id === 'default'}
    get isHidden(){return this.id === 'hidden'}
    set expanded(e){this.data.expanded = e}
    // Recursively generate a pretty name
    get pathName(){
        if (this.parent)
            return this.parent.pathName+'/'+this.name
        return this.name;
    }
}
export class CompendiumFolderDirectory extends SidebarDirectory{
    /** @override */
	static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "compendium",
            template: "modules/compendium-folders/templates/compendium-directory.html",
            title: "Compendium Packs",
            dragDrop: [{ dragSelector: ".compendium-pack,.compendium-folder", dropSelector: ".compendium-folder"}],
            filters: [{inputSelector: 'input[name="search"]', contentSelector: ".directory-list"}]
      });
    }
    constructor(...args) {
        super(...args);
    }

    async checkDeleted(){
        let goneCompendiums = game.customFolders.compendium.entries.filter(x => !x.pack);
        for (let c of goneCompendiums){
            await c.parent.removeCompendium(c,true,false);
        }
    }
    /** @override */
    initialize(){
        //filter out gone compendiums
        if (!this.constructor.folders && !this.constructor.collection){
            this.folders = [];
            this.entities = [];
        }
        else if (game.user.isGM){
            this.folders = [...this.constructor.folders];
            this.entities = [...this.constructor.collection];
        }else{
            this.folders = [...this.constructor.folders].filter(x => x?.content?.find(y => !y?.pack?.private));
            this.entities = [...this.constructor.collection].filter(z => !z?.pack?.private);
        }
        let toAdd = [];
        //Check for cyclic looping folders
        for (let folder of this.folders){
            let parent = folder.parent;
            while (parent){
                if (parent.path.includes(folder._id)){
                    console.debug(modName+ " | Cyclic folders identified, moving one to root for safety")
                    folder.parent = null;
                    folder.path = []
                    folder.save(false)
                    break;
                }
                parent = parent.parent
            }
        }
        // Add parents if needed
        for (let folder of this.folders){
            let parent = folder.parent
            while (parent){
                if (!this.folders.some(x => x._id === parent._id) && !toAdd.some(x => x._id === parent._id))
                    toAdd.push(parent);
                parent = parent.parent;
            }
        }
        this.folders =this.folders.concat(toAdd)
        let tree = this.constructor.setupFolders(this.folders, this.entities);
        
        this.tree = this._sortTreeAlphabetically(tree)
        //Check cache
        let cache = game.settings.get(mod,'cached-folder');
        if (game.user.isGM && cache.pack && !this.entities.some(x => cache.pack === x.code)){
            console.debug(modName+ ' | Compendium '+cache.pack+' no longer exists. Clearing cache')
            game.settings.set(mod,'cached-folder',{})
        }
    }
    async refresh(){
        // Check for new packs
        // Add to default if needed

        // Check for removed packs
        await this.checkDeleted()
        ui.compendium.render(true,'update')
    }
    _sortTreeAlphabetically(tree){
        let fn = (a,b) => {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
        }
        tree.children = tree.children.sort(fn);
        for (let s of tree.children.filter(x => x.children?.length > 1)){
            s.children = s.children.sort(fn);
            
        }
        return tree;
    }
    
    /** @override */
    get entity() {
          return "CompendiumEntry";
    }
    /** @override */
    static get entity() {
        return "CompendiumEntry";
    }
    /** @override */
    static get folders(){
        return game.customFolders?.compendium?.folders;
    }

    /** @override */
    static get collection() {
        return game.customFolders?.compendium?.entries;
    }

    /** @override */
    getData(options) {
        return {
            user: game.user,
            tree: this.tree,
            isPF1: game.system.id === "pf1"
        };
    }
    _onCreateFolder(event) {

        event.preventDefault();
        event.stopPropagation();
        const button = event.currentTarget;
        const parent = game.customFolders.compendium.folders.get(button.dataset.parentFolder);
        const data = new CompendiumFolder();
        if (parent){
            data.path = parent.path.concat(parent.id)
            data.parent = parent._id;
        }
        const options = {top: button.offsetTop, left: window.innerWidth - 310 - FolderConfig.defaultOptions.width};
        new CompendiumFolderEditConfig(data, options).showDialog(false);
    }
    /** @override */
    activateListeners(html){
        super.activateListeners(html);

        // Taken from CopmendiumDirectory.activateListeners(html)
        // Click to open
        html.find('.compendium-pack').click(ev => {
            let li = $(ev.currentTarget),
            pack = game.packs.get(li.data("pack"));
        if ( li.attr("data-open") === "1" ) pack.close();
        else {
            li.attr("data-open", "1");
            
            li.find("i.folder").removeClass("fa-folder").addClass("fa-folder-open");
            pack.render(true);
        }
        });
        // Refresh button
        html.find('.refresh-directory').click(() => {
            game.customFolders.compendium = null;
            initFolders();
            //ui.compendium = new CompendiumFolderDirectory();
            ui.compendium.render(true);
        })
        if (game.system.id === 'pf1'){
            html.find(".compendium-footer .compendium.spells").click((e) => this._onBrowseCompendium(e, "spells"));
            html.find(".compendium-footer .compendium.items").click((e) => this._onBrowseCompendium(e, "items"));
            html.find(".compendium-footer .compendium.bestiary").click((e) => this._onBrowseCompendium(e, "bestiary"));
            html.find(".compendium-footer .compendium.feats").click((e) => this._onBrowseCompendium(e, "feats"));
            html.find(".compendium-footer .compendium.classes").click((e) => this._onBrowseCompendium(e, "classes"));
            html.find(".compendium-footer .compendium.races").click((e) => this._onBrowseCompendium(e, "races"));
            html.find(".compendium-footer .compendium.buffs").click((e) => this._onBrowseCompendium(e, "buffs"));
        }
        // Options below are GM only
        if ( !game.user.isGM ) return;

        // Create Compendium
        html.find('.create-compendium').click(this._onCreateEntity.bind(this));
    }
    _onBrowseCompendium(event, type) {
        event.preventDefault();
    
        if (game.pf1.isMigrating) return ui.notifications.warn(game.i18n.localize("PF1.Migration.Ongoing"));
    
        game.pf1.compendiums[type]._render(true);
      }    

    /** @override */
    _getEntryContextOptions(){
        if (!game.user.isGM)
            return;
        let x = CompendiumDirectory.prototype._getEntryContextOptions()
        // Modify the Duplicate callback to place duplicated compendium in folder of parent.
        x.find(c => c.name === 'COMPENDIUM.Duplicate').callback = li => {
            let pack = game.packs.get(li.data("pack"));
            let folder = game.customFolders.compendium.entries.get(li.data("pack")).parent;
            const html = `<form>
                <div class="form-group">
                    <label>${game.i18n.localize("COMPENDIUM.DuplicateTitle")}</label>
                    <input type="text" name="label" value="${pack.title}"/>
                    <p class="notes">${game.i18n.localize("COMPENDIUM.DuplicateHint")}</p>
                </div>
            </form>`;
            return Dialog.confirm({
                title: `${game.i18n.localize("COMPENDIUM.DuplicateTitle")}: ${pack.title}`,
                content: html,
                yes: async (html) => {
                    const label = html.querySelector('input[name="label"]').value;
                    let newPack = await pack.duplicate({label})
                    await folder.addCompendium(newPack.collection);
                    return newPack;
                },
                options: {
                top: Math.min(li[0].offsetTop, window.innerHeight - 350),
                left: window.innerWidth - 720,
                width: 400,
                jQuery: false
                }
            });
        }
        let i = x.findIndex(c => c.name === 'COMPENDIUM.Delete')
        x[i].callback = async (li) => {
            let pack = game.packs.get(li.data("pack"));
            return Dialog.confirm({
                title: `${game.i18n.localize("COMPENDIUM.Delete")}: ${pack.metadata.label}`,
                content: game.i18n.localize("COMPENDIUM.DeleteHint"),
                yes: async () => {
                    pack._assertUserCanModify();
                    await SocketInterface.dispatch("manageCompendium", {
                        action: "delete",
                        data: pack.metadata.name
                    });

                    // Remove the pack from the game World
                    game.data.packs.findSplice(p => (p.package === "world") && (p.name === pack.metadata.name) );
                    await game.customFolders.compendium.folders.find(x => x.compendiumList.includes(pack.collection)).removeCompendiumByCode(pack.collection,true,true);
                    game.initializePacks().then(() => ui.compendium.render());
                },
                defaultYes: false
              })
        }
        i = x.findIndex(c => c.name === 'COMPENDIUM.ImportAll')
        let oldCallback = x[i].callback;
        x[i].callback = async (li) => {
            await game.settings.set(mod,'importing',true);
            await oldCallback.bind(this)(li);
            await game.settings.set(mod,'importing',false);
            let pack = game.packs.get(li.data('pack'));
            removeTempEntities(pack.entity);
        }
        // New context menu button - Adds compendium to hidden folder
        return x.concat([
            {
                name: "CF.hideForGM",
                icon: '<i class="fas fa-eye"></i>',
                callback: li => {
                    game.customFolders.compendium.folders.hidden.addCompendium(li.data("pack")).then(() => {
                        ui.notifications.notify(game.i18n.localize("CF.hideMessage"));
                    });
                   
                }
            }
        ]);
    }
    /** @override */
    _getFolderContextOptions(){
        return[
            {
                name: "FOLDER.Edit",
                icon: '<i class="fas fa-edit"></i>',
                condition: game.user.isGM,
                // TODO 
                callback: header => {
                    const li = header.parent()[0];
                    const folder = game.customFolders.compendium.folders.get(li.dataset.folderId);
                    const options = {top: li.offsetTop, left: window.innerWidth - 310 - FolderConfig.defaultOptions.width};
                    new CompendiumFolderEditConfig(folder, options).showDialog();
                }
            },{
                name: "FOLDER.Remove",
                icon: '<i class="fas fa-trash"></i>',
                condition: header => { 
                    return game.user.isGM && !game.customFolders.compendium.folders.get(header.parent().data("folderId")).isDefault
                },
                callback: header => {
                    const li = header.parent();
                    const folder = game.customFolders.compendium.folders.get(li.data("folderId"));
                    // TODO 
                    Dialog.confirm({
                    title: `${game.i18n.localize("FOLDER.Remove")} ${folder.name}`,
                    content: game.i18n.localize("FOLDER.RemoveConfirm"),
                    yes: () => folder.delete(),
                    options: {
                        top: Math.min(li[0].offsetTop, window.innerHeight - 350),
                        left: window.innerWidth - 720,
                        width: 400
                    }
                    });
                }
            },{
                name: "CF.moveFolder",
                icon: '<i class="fas fa-sitemap"></i>',
                condition: header => { 
                    return game.user.isGM && !game.customFolders.compendium.folders.get(header.parent().data("folderId")).isDefault
                },
                callback: header => {
                    const li = header.parent();
                    const folder = game.customFolders.compendium.folders.get(li.data("folderId"));
                    new CompendiumFolderMoveDialog(folder,{}).render(true);
                }
            },{
                
                name: "CF.showToPlayers",
                icon: '<i class="far fa-eye"></i>',
                condition: header => { 
                    return game.user.isGM && !game.customFolders.compendium.folders.get(header.parent().data("folderId")).isDefault
                },
                callback: async (header) => {
                    const li = header.parent();
                    const folder = game.customFolders.compendium.folders.get(li.data("folderId"));
                    let allConfig = game.settings.get('core','compendiumConfiguration');
                    for (let p of folder.content){
                        let pack = game.packs.get(p.packCode);
                        if (pack.private){
                            if (allConfig[p.packCode]){
                                allConfig[p.packCode].private = false;
                            }else{
                                allConfig[p.packCode] = {
                                    private:false,
                                    locked:pack.locked
                                }
                            }
                        }
                    }
                    await game.settings.set('core','compendiumConfiguration',allConfig);
                }
            },{
                name: "CF.hideFromPlayers",
                icon: '<i class="far fa-eye-slash"></i>',
                condition: header => { 
                    return game.user.isGM && !game.customFolders.compendium.folders.get(header.parent().data("folderId")).isDefault
                },
                callback: async (header) => {
                    const li = header.parent();
                    const folder = game.customFolders.compendium.folders.get(li.data("folderId"));
                    let allConfig = game.settings.get('core','compendiumConfiguration');
                    for (let p of folder.content){
                        let pack = game.packs.get(p.packCode);
                        if (!pack.private){
                            if (allConfig[p.packCode]){
                                allConfig[p.packCode].private = true;
                            }else{
                                allConfig[p.packCode] = {
                                    private:true,
                                    locked:pack.locked
                                }
                            }
                        }
                    }
                    await game.settings.set('core','compendiumConfiguration',allConfig);
                }
            },{
                name: "CF.lockAll",
                icon: '<i class="fas fa-lock"></i>',
                condition: header => { 
                    return game.user.isGM && !game.customFolders.compendium.folders.get(header.parent().data("folderId")).isDefault
                },
                callback: async (header) => {
                    const li = header.parent();
                    const folder = game.customFolders.compendium.folders.get(li.data("folderId"));
                    let allConfig = game.settings.get('core','compendiumConfiguration');
                    for (let p of folder.content){
                        let pack = game.packs.get(p.packCode);
                        if (!pack.locked){
                            if (allConfig[p.packCode]){
                                allConfig[p.packCode].locked = true;
                            }else{
                                allConfig[p.packCode] = {
                                    locked:true,
                                    private:pack.private
                                }
                            }
                        }
                    }
                    await game.settings.set('core','compendiumConfiguration',allConfig);
                }
            },{
                name: "CF.unlockAll",
                icon: '<i class="fas fa-unlock"></i>',
                condition: header => { 
                    return game.user.isGM && !game.customFolders.compendium.folders.get(header.parent().data("folderId")).isDefault
                },
                callback: async (header) => {
                    const li = header.parent();
                    const folder = game.customFolders.compendium.folders.get(li.data("folderId"));
                    let allConfig = game.settings.get('core','compendiumConfiguration');
                    for (let p of folder.content){
                        let pack = game.packs.get(p.packCode);
                        if (pack.locked){
                            if (allConfig[p.packCode]){
                                allConfig[p.packCode].locked = false;
                            }else{
                                allConfig[p.packCode] = {
                                    locked:false,
                                    private:pack.private
                                }
                            }
                        }
                    }
                    await game.settings.set('core','compendiumConfiguration',allConfig);
                }
            }
        ]
    }
    // _contextMenu(html){
    //     super._contextMenu(html);
    //     //CompendiumDirectory.prototype._contextMenu(html);
    // }

    /** @override */
	_onDragStart(event) {
        let li = event.currentTarget.closest("li");
        if (li.dataset.folderId === 'default' || !game.user.isGM)
            return;
        const dragData = li.classList.contains("folder") ?
            { type: "Folder", id: li.dataset.folderId, entity: this.constructor.entity } :
            { type: this.constructor.entity, id: li.dataset.pack };
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        this._dragType = dragData.type;
    }
    async _onDrop(event){
        event.stopPropagation();
        let li = event.currentTarget.closest("li.folder");
        if (li.dataset.folderId === 'default' || !game.user.isGM)
            return;
        if (li) li.classList.remove("droptarget");
        let data;
        try{
            data = JSON.parse(event.dataTransfer.getData('text/plain'));
        }catch(err){
            return;
        }

        let folderId = li.dataset.folderId;

        if (folderId){
            if (data.type === this.constructor.entity){
                if (game.customFolders.compendium.entries.get(data.id).folder != folderId)
                    await game.customFolders.compendium.folders.get(folderId).addCompendium(data.id)
            }else if (data.type === 'Folder'){
                // Move folder
                let destFolderId = folderId;
                let movingFolderId = data.id;
                let destFolder = game.customFolders.compendium.folders.get(destFolderId);
                let movingFolder = game.customFolders.compendium.folders.get(movingFolderId);
                if (!destFolder.isHidden
                    && !destFolder.isDefault
                    && destFolderId != movingFolderId
                    && destFolderId != movingFolder?.parent?.id
                    && ((!destFolder.path?.includes(movingFolderId) && destFolder.path.length > 0)
                        || destFolder.path.length === 0))
                    {
                        movingFolder.moveFolder(destFolderId);
                    }
            }
        }
    }
    async _onCreateEntity(event) {
        let parentId = 'default' 
        if (!event.currentTarget.classList.contains('create-compendium')){
            // is a button on folder
            parentId = event.currentTarget.closest('li')?.dataset?.folderId;
        }
        event.stopPropagation();
        event.preventDefault();
        const types = CONST.COMPENDIUM_ENTITY_TYPES;
        const html = await renderTemplate('templates/sidebar/compendium-create.html', {types});
        return Dialog.prompt({
          title: game.i18n.localize("COMPENDIUM.Create"),
          content: html,
          label: game.i18n.localize("COMPENDIUM.Create"),
          callback: async (html) => {
              const form = html.querySelector("#compendium-create");
              const fd = new FormDataExtended(form);
              const data = fd.toObject();
              if ( !data.label ) {
                const err = new Error(game.i18n.localize("COMPENDIUM.ErrorRequireTitle"));
                return ui.notifications.warn(err.message);
              }

              // Snippet taken from Compendium.create() (just so I can intercept the pack before it's declared unassigned)
              const response = await SocketInterface.dispatch("manageCompendium", {
                action: "create",
                data: data,
                options: {}
              });
          
              // Add the new pack to the World
              game.data.packs.push(response.result);
              game.initializePacks().then(() => {
                game.customFolders.compendium.folders.get(parentId).addCompendium(`${response.result.package}.${response.result.name}`);
              });
            },
          options: { jQuery: false }
        });
      }
    // Taken from SidebarDirectory._onSearchFilter()
    // modified slightly for custom data structures
    _onSearchFilter(event, query, html) {
        const isSearch = !!query;
        let entityIds = new Set();
        let folderIds = new Set();
    
        // Match entities and folders
        if ( isSearch ) {
          const rgx = new RegExp(RegExp.escape(query), "i");
    
          // Match entity names
          for ( let e of this.entities ) {
            if ( rgx.test(e.name) ) {
              entityIds.add(e.id);
              if ( e.parent.id ) folderIds.add(e.parent.id);
            }
          }
    
          // Match folder tree
          const includeFolders = fids => {
            const folders = this.folders.filter(f => fids.has(f._id));
            const pids = new Set(folders.filter(f => f.data.parent).map(f => f.data.parent));
            if ( pids.size ) {
              pids.forEach(p => folderIds.add(p));
              includeFolders(pids);
            }
          };
          includeFolders(folderIds);
        }
    
        // Toggle each directory item
        for ( let el of html.querySelectorAll(".directory-item,.compendium-pack") ) {
    
          // Entities
          if (el.classList.contains("entity")) {
            el.style.display = (!isSearch || entityIds.has(el.dataset.pack)) ? "" : "none";
          }
    
          // Folders
          if (el.classList.contains("folder")) {
            let match = isSearch && folderIds.has(el.dataset.folderId);
            el.style.display = (!isSearch || match) ? "" : "none";
            if (isSearch && match) el.classList.remove("collapsed");
            else el.classList.toggle("collapsed", !game.folders._expanded[el.dataset.folderId]);
          }
        }
      }

}
// extend _getEntryContextOptions()
//CompendiumFolderDirectory._getEntryContextOptions = CompendiumDirectory.prototype._getEntryContextOptions;
CompendiumFolderDirectory._onCreateCompendium = CompendiumDirectory.prototype._onCreateCompendium;
//CompendiumFolderDirectory._onDeleteCompendium = CompendiumDirectory.prototype._onDeleteCompendium;

CONFIG.CompendiumEntry = {entityClass : CompendiumEntry};
CONFIG.CompendiumFolder = {entityClass : CompendiumFolder};

let old = Compendium.create;
Compendium.create =  async function(metadata,options){
    let result = await old.bind(this,metadata,options)()
    await initFolders(true);
    return result;
}

async function deleteFolderWithinCompendium(packCode,folderElement,deleteAll){
    //ui.notifications.notify(game.i18n.localize('CF.deleteFolderNotificationStart'))
    
    let pack = game.packs.get(packCode);
    await pack.close();
    let contents = await pack.getContent();
    let tempEntity = await pack.getEntity(folderElement.getAttribute('data-temp-entity-id'));
    let tempEntityFolderId = tempEntity.data.flags.cf.id
    let folderChildren = tempEntity.data.flags.cf.children;
    let parentFolderId = null;
    let parentEntity = null;
    let tempEntityData = tempEntity.data.flags.cf
    if (tempEntityData.folderPath != null && tempEntityData.folderPath.length>0){
        parentFolderId = tempEntityData.folderPath[tempEntityData.folderPath.length-1];
        parentEntity = contents.find(e => e.name === TEMP_ENTITY_NAME && e.data.flags.cf.id === parentFolderId);
    }
    
    let allData = {};
    let toDelete = [];
    if (deleteAll){
        for (let entity of folderElement.querySelectorAll('.directory-item')){
            toDelete.push(entity.getAttribute('data-entry-id'));
        }
        for (let folder of folderElement.querySelectorAll('.compendium-folder')){
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
                            allData[parentEntity.id] = {flags:{cf:{children:parentChildren}},_id:parentEntity.id}
                        }else{
                            allData[parentEntity.id].flags.cf.children = parentChildren;
                            allData[parentEntity.id]._id=parentEntity.id
                        }
                    }
                    // Update parent folderID of entity

                    if (allData[entity.id] == null){
                        allData[entity.id] = {flags:{cf:{id:parentFolderId}},_id:entity.id}
                    }else{
                        allData[entity.id].flags.cf.id = parentFolderId;
                        allData[entity.id]._id=entity.id
                    }
                }else{
                    if (entity.name === TEMP_ENTITY_NAME 
                        && entity.data.flags.cf.folderPath.includes(tempEntityFolderId)){
                        // Another temp entity representing folder which is a child of parent
                        let newPath = entity.data.flags.cf.folderPath
                        newPath.splice(newPath.indexOf(tempEntityFolderId),1)
                        //let newPath = tempEntity.data.flags.cf.folderPath.splice(tempEntity.data.flags.cf.folderPath.length-1,1);
                        if (allData[entity.id] == null){
                            allData[entity.id] = {flags:{cf:{folderPath:newPath}},_id:entity.id}
                        }else{
                            allData[entity.id].flags.cf.folderPath = newPath
                            allData[entity.id]._id=entity.id
                        }      
                    }
                }
            }
        }
    }
    if (deleteAll){
        for (let id of toDelete){
            await pack.deleteEntity(id);
        }
    }else{
        for (let data of Object.values(allData)){
            await pack.updateEntity(data)
        }
    }
    await pack.deleteEntity(tempEntity.id)
    ui.notifications.notify(game.i18n.localize('CF.deleteFolderNotificationFinish'));
    document.querySelector('.compendium-pack[data-pack=\''+packCode+'\']').click();
    pack.render(true);
}
async function updateFolderWithinCompendium(folderObj,packCode,tempEntityId){
    //ui.notifications.notify(game.i18n.localize('CF.updateFolderNotificationStart'))
    let pack = game.packs.get(packCode);
    let entity = await pack.getEntity(tempEntityId);

    if (entity != null){

        let data = {
            flags:{
                cf:mergeObject(entity.data.flags.cf,folderObj)
            }
        }
        // if (entity.data.flags.cf.folderPath === null){
        //     data.flags.cf = null;
        // }

        data._id = entity._id;
                                        
        await pack.updateEntity(data)   
    }
    ui.notifications.notify(game.i18n.localize('CF.updateFolderNotificationFinish'));
}
async function createNewFolderWithinCompendium(folderObj,packCode,parentTempEntityId){
    // Exporting temp entity to allow for empty folders being editable
    let pack = game.packs.get(packCode);
    let newPath = []
    if (parentTempEntityId != null){
        let parent = await pack.getEntity(parentTempEntityId)
        newPath = parent.data.flags.cf.folderPath.concat(parent.data.flags.cf.id)
    }
    
    let tempData = getTempEntityData(pack.entity);
    tempData.flags.cf={
        id:folderObj.id,
        folderPath:newPath,
        color:folderObj.color,
        fontColor:folderObj.fontColor,
        name:folderObj.name,
        children:[],
        icon:folderObj.icon
    }
    let e = await pack.createEntity(tempData);
    console.log(`${modName} | Created temp entity for folder in ${pack.collection}`);
    return newPath
}
async function closeFolder(parent,save){
    let folderIcon = parent.firstChild.querySelector('h3 > .fa-folder, .fa-folder-open')
    let cogLink = parent.querySelector('a.edit-folder')
    let newFolderLink = parent.querySelector('a.create-folder');
    let moveFolderLink = parent.querySelector('a.move-folder');
    let contents = parent.querySelector('.folder-contents');
    if (folderIcon != null){
        //Closing folder
        folderIcon.classList.remove('fa-folder-open')
        folderIcon.classList.add('fa-folder') 
    }
    contents.style.display='none'
    if (game.user.isGM && cogLink != null && newFolderLink != null && moveFolderLink != null){
        cogLink.style.display='none'
        if (parent.getAttribute('data-cfolder-id')!='default'){
            newFolderLink.style.display='none'
        }
        if (parent.getAttribute('data-cfolder-id')!='default'){
            moveFolderLink.style.display='none'
        }
    }
    parent.setAttribute('collapsed','');
    if (save){
        let openFolders = game.settings.get(mod,'open-folders');
        openFolders.splice(openFolders.indexOf(parent.getAttribute('data-cfolder-id')),1);
        await game.settings.set(mod,'open-folders',openFolders);
    }
}
async function openFolder(parent,save){
    let folderIcon = parent.firstChild.querySelector('h3 > .fa-folder, .fa-folder-open')
    let cogLink = parent.querySelector('a.edit-folder')
    let newFolderLink = parent.querySelector('a.create-folder');
    let moveFolderLink = parent.querySelector('a.move-folder');
    let contents = parent.querySelector('.folder-contents');
    if (folderIcon != null){
        folderIcon.classList.remove('fa-folder')
        folderIcon.classList.add('fa-folder-open')
    }
    contents.style.display=''
    if (game.user.isGM && cogLink != null && newFolderLink != null && moveFolderLink != null){
        cogLink.style.display=''
        if (parent.getAttribute('data-cfolder-id')!='default'){
            newFolderLink.style.display=''
        }
        if (parent.getAttribute('data-cfolder-id')!='default'){
            moveFolderLink.style.display=''
        }
    }
    parent.removeAttribute('collapsed');
    if (save){
        let openFolders = game.settings.get(mod,'open-folders');
        openFolders.push(parent.getAttribute('data-cfolder-id'));
        await game.settings.set(mod,'open-folders',openFolders)   
    }
}
function filterSelectorBySearchTerm(parent,searchTerm,selector){
    if (searchTerm == null || searchTerm.length==0){
        for (let compendium of parent.querySelectorAll(selector)){
            //Show all
            if (!compendium.classList.contains('hidden')){
                compendium.style.display='';
                compendium.removeAttribute('search-failed')
            }
        }
        parent.querySelectorAll('.compendium-folder').forEach(function(folder){
            folder.style.display='';
            closeFolder(folder);
        });
    }else{
        for (let compendium of parent.querySelectorAll(selector)){
            if (!compendium.innerText.toLowerCase().includes(searchTerm.toLowerCase())){
                //Hide not matching
                compendium.style.display='none';
                compendium.setAttribute('search-failed','')
            }else{
                //Show matching
                if (!compendium.classList.contains('hidden')){
                    compendium.style.display='';
                    compendium.removeAttribute('search-failed')
                }
            }
        }
        parent.querySelectorAll('.compendium-folder').forEach(function(folder){
            let shouldHide = true;
            folder.querySelectorAll(selector).forEach(function(comp){
                if (!comp.hasAttribute('search-failed')){
                    shouldHide = false;
                }
            });
            if (shouldHide){
                folder.style.display='none';
                closeFolder(folder);
            }else{
                folder.style.display='';
                openFolder(folder);
            }
        });
    }
}
// Edit functions
class ImportExportConfig extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "compendium-folder-edit";
        options.template = "modules/compendium-folders/templates/import-export.html";
        options.width = 500;
        return options;
      }
    get title() {
        return game.i18n.localize('CF.importExportLabel');
    }
    async getData(options) {
        return {
          exportData:JSON.stringify(game.settings.get(mod,'cfolders')),
          submitText:'Import'
        }
      }
    async _updateObject(event, formData) {
        let importData = formData.importData;
        if (importData != null && importData.length > 0){
            try{
                let importJson = JSON.parse(importData);
                let success = true;
                Object.keys(importJson).forEach(function(key){
                    if (importJson[key].pathToFolder != null
                        && importJson[key].pathToFolder.length > FOLDER_LIMIT){
                            success = false;
                    }
                });
                if (success){
                    game.settings.set(mod,'cfolders',importJson).then(async function(){
                        game.customFolders.compendium = null;
                        await initFolders()
                        ui.compendium.refresh();
                        ui.notifications.info(game.i18n.localize('CF.folderImportSuccess'));
                    });
                }else{
                    ui.notifications.error(game.i18n.localize('CF.folderImportMaxDepth') +" ("+FOLDER_LIMIT+")")
                }
            }catch(error){ui.notifications.error(game.i18n.localize('CF.folderImportFailure'))}
        }
    }
}

class CompendiumFolderMoveDialog extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "compendium-folder-move";
        options.template = "modules/compendium-folders/templates/compendium-folder-move.html";
        options.width = 500;
        return options;
    }
    get title() {
        return game.i18n.localize("CF.moveFolder")+': '+this.object.name;
    }
    async getData(options) { 
        let formData = []

        for (let folder of game.customFolders.compendium.folders){
            if (!folder.isHidden 
                && !folder.isDefault 
                && (folder.id != this.object?.parent?.id)
                && (folder.id != this.object.id)
                // Folder path does not contain this.object.id
                && ((!folder.path?.includes(this.object.id) && folder.path.length > 0
                    || folder.path.length === 0)
            
                // Folder is not this
            )){
                formData.push({
                    'titleText':folder.name,
                    'fullPathTitle':folder.pathName,
                    'id':folder.id
                })
            }
        }
        formData.sort(function(first,second){
            if (first.fullPathTitle < second.fullPathTitle){
                return -1
            } else if (first.fullPathTitle > second.fullPathTitle){
                return 1;
            }
            return 0;
        });
        if (this.object.parent){
            formData.splice(0,0,{
                'titleText':'Root',
                'titlePath':'Root',
                'fullPathTitle':'Root',
                'id':'root'
            })
        }
        
        return {
            folder: this.object,
            allFolders: formData,
            submitText: game.i18n.localize("CF.moveFolder")
        }
    }

    async _updateObject(event, formData) {
        let destFolderId = null;
        document.querySelectorAll('#folder-move input[type=\'radio\']').forEach(function(e){
            if (e.checked){
                destFolderId=e.value;
                return;} 
        });
        this.object.moveFolder(destFolderId);
        return;       
    }
}
class CompendiumFolderEditConfig extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "compendium-folder-edit";
        options.template = "modules/compendium-folders/templates/compendium-folder-edit.html";
        options.width = 500;
        return options;
    }
  
    get title() {
        return (this.isEditDialog) ? `${game.i18n.localize("FOLDER.Update")}: ${this.object.name}` : game.i18n.localize("FOLDER.Create");
    }
    getGroupedPacks(){
        let allFolders = game.settings.get(mod,'cfolders');
        let assigned = {};
        let unassigned = {};
        Object.keys(allFolders).forEach(function(key){
            if (key != 'hidden' && key != 'default'){
                for (let a of allFolders[key].compendiumList){
                    if (Array.from(game.packs.keys()).includes(a)){
                        assigned[a]=game.packs.get(a);
                    }
                }
            }
        });
        for (let pack of game.packs.keys()){
            if (!Object.keys(assigned).includes(pack)){
                unassigned[pack] = game.packs.get(pack);
            }
        }
        return [assigned,unassigned];

    }
    /** @override */
    async getData(options) {
      let allPacks = this.getGroupedPacks();
      return {
        folder: this.object,
        defaultFolder:this.object._id==='default',
        fpacks: game.packs,
        apacks: alphaSortCompendiums(Object.values(allPacks[0])),
        upacks: alphaSortCompendiums(Object.values(allPacks[1])),
        submitText: game.i18n.localize( this.isEditDialog   ? "FOLDER.Update" : "FOLDER.Create"),
        deleteText: (this.isEditDialog && this.object._id != 'default') ?"Delete Folder":null
      }
    }
  
    /** @override */
    async _updateObject(event, formData) {

        this.object.name = formData.name;
        if (formData.color.length===0){
            this.object.color = '#000000'; 
        }else{
            this.object.color = formData.color;
        }
        if (formData.fontColor.length === 0){
            this.object.fontColor = '#FFFFFF'
        }else{
            this.object.fontColor = formData.fontColor;
        }
        if (formData.icon != null){
            if (formData.icon.length==0){
                this.object.folderIcon = null;
            }else{
                this.object.folderIcon = formData.icon;
            }
        }else{
            this.object.folderIcon = null;
        }
        if (this.object._id != 'default'){
            let packsToAdd = []
            let packsToRemove = []
            for (let entry of game.packs.entries){
                let formEntryId = entry.collection.replace('.','');
                if (formData[formEntryId] && !this.object?.content?.map(c => c.id)?.includes(entry.collection)){
                    // Box ticked AND compendium not in folder
                    packsToAdd.push(entry.collection);
                }else if (!formData[formEntryId] && this.object?.content?.map(c => c.id)?.includes(entry.collection)){
                    // Box unticked AND compendium in folder
                    packsToRemove.push(entry.collection);
                }
            }
            for (let packKey of packsToAdd){
                await this.object.addCompendium(packKey,false);
            }
            for (let packKey of packsToRemove){
                await this.object.removeCompendiumByCode(packKey,false,false);
            }
        
            //If folder needs to be moved to parent (for some reason)
            if (this.object.data.parent && !game.customFolders.compendium.folders.get(this.object.data.parent)?.children?.some(x => x._id === this.object._id)){
                await this.object.moveFolder(this.object.data.parent);
            }
        }
        await this.object.save();

        return
    }
    showDialog(edit=true){
        this.isEditDialog = edit;
        this.render(true);
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
        await updateFolderInCache(this.object.packCode,folderObj); 
        await updateFolderWithinCompendium(folderObj,this.object.packCode,this.object.tempEntityId);      
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
        await resetCache()
        createNewFolderWithinCompendium(folderObj,this.object.packCode,this.object.tempEntityId);
        
         
        //folderObj.path = newPath
        //await createFolderInCache(folderObj.packCode,folderObj);   
            
    }
}


async function closeFolderInsideCompendium(parent,pack,save){
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
async function openFolderInsideCompendium(parent,pack,save){
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
async function toggleFolderInsideCompendium(event,parent,pack){
    event.stopPropagation();
    if (parent.hasAttribute('collapsed')){
        await openFolderInsideCompendium(parent,pack,true);
    }else{
        await closeFolderInsideCompendium(parent,pack,true);
        for (let child of parent.querySelectorAll('.compendium-folder')){
            await closeFolderInsideCompendium(child,pack,true);
        }
    }
}
// ==========================
// Exporting Folders to compendiums
// ==========================

function addMacroFoldersExportButton(){
    let newContextOption = {
        name: "CF.exportFolderHint",
        icon: '<i class="fas fa-upload"></i>',
        condition: header => {
            return game.user?.isGM && header.parent().find('.entity').length > 0
        },
        callback: async (header) => {
            const li = header.parent()[0];
            let folder = game.customFolders.macro.folders.get(li.getAttribute('data-folder-id'));
            await exportFolderStructureToCompendium(folder);
        }  
    }
    let old = ui.macros.constructor.prototype._getFolderContextOptions();
    ui.macros.constructor.prototype._getFolderContextOptions = function(){
        return old.concat(newContextOption)
    }
    return;
}
// Mostly taken from foundry.js 
async function exportFolderStructureToCompendium(folder){
    
    // Get eligible pack destinations
    const packs = game.packs.filter(p => (p.entity === folder.data.type) && !p.locked);
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
            await pack.close();
            resetCache();
            let folderPath = await createParentFoldersWithinCompendium(folder,pack);
            // First check if there is an existing folder for current folder
            let existingFolderId = await getExistingFolderId(folder,pack)
            if (existingFolderId != null){
                await recursivelyExportFolders(index,pack,folder,existingFolderId,folderPath,form.merge.checked)
            }else{
                await recursivelyExportFolders(index,pack,folder,generateRandomFolderName('temp_'),folderPath,form.merge.checked)
            }
            resetCache()
            ui.notifications.notify(game.i18n.localize('CF.exportFolderNotificationFinish'));
            pack.render(true);
        },
        options:{}
    });

    
}
async function getExistingFolderId(folder,pack){
    let folderPath = getFolderPath(folder);
    //Also check for old folder paths (not using separator)
    let folderPathOld = folderPath.replace(FOLDER_SEPARATOR,'/')
    let content = await pack.getContent()
    let existingFolder = content.find(e => e.name === TEMP_ENTITY_NAME 
        && (e.data.flags.cf.path === folderPath 
            || e.data.flags.cf.path === folderPathOld) 
        && e.data.flags.cf.name === folder.name)
    if (existingFolder){
        return existingFolder.data.flags.cf.id;
    }
    return null;
}
async function createParentFoldersWithinCompendium(folder,pack){
    let parents = []
    let currentFolder = folder;
    let content = await pack.getContent();
    let tempEntities = content.filter(e => e.name === TEMP_ENTITY_NAME);

    while (currentFolder.parent != null){
        parents.push(currentFolder.parent);
        currentFolder = currentFolder.parent;
    }
    let previousParent = null;
    let previousPath = []
    for (let i=parents.length-1 ;i>=0;i--){
        let tempEntity = tempEntities.find(e => e.data.flags.cf.name === parents[i].name 
            && (e.data.flags.cf.path === getFolderPath(parents[i]) 
                ||arraysEqual(e.data.flags.cf.folderPath,previousPath)))
        if (tempEntity != null){
            // if folder with parent name exists, and path matches, use that tempEntity id
            previousParent = tempEntity.data.flags.cf.id;
            
        }else{
            // If folder does not exist, create tempEntity and use folderPath of previous parent value
            previousParent = generateRandomFolderName('temp_')
            tempEntity = getTempEntityData(pack.entity,{
                id:previousParent,
                name:parents[i].name,
                color:parents[i].macroList ? parents[i].color : parents[i].data.color,
                folderPath:previousPath,
                children:[]
            });
            
            await pack.createEntity(tempEntity);
           
        }
        previousPath.push(previousParent)
    }
    return previousPath;
}
async function recursivelyExportFolders(index,pack,folderObj,folderId,folderPath,merge){
    if (folderObj.children.length==0){
        let entities = folderObj.content;
        let updatedFolder = await exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,folderPath,merge)
        if (updatedFolder != null){
            return [updatedFolder];
        }
        return []
    }
    for (let child of folderObj.children){
        let newPath = Array.from(folderPath);
        if (!newPath.includes(folderId))
            newPath.push(folderId)

        let existingFolderId = await getExistingFolderId(child,pack)
        if (existingFolderId === null)
            existingFolderId = generateRandomFolderName('temp_')
        await recursivelyExportFolders(index,pack,child,existingFolderId,newPath,merge)
    }
    let entities = folderObj.content;
    
    await exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,folderPath,merge)
}
async function exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,folderPath,merge){
    let path = getFullPath(folderObj)
    let content = await pack.getContent()
    let existingFolder = content.find(e => e.name === TEMP_ENTITY_NAME 
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
        let data = await e.toCompendium();
        data.flags.cf={
            id:folderId,
            path:path,
            color:color,
        }
        let existing = merge ? index.find(i => i.name === data.name) : index.find(i => i._id === e.id);
        if ( existing ) data._id = existing._id;
        if ( data._id ){
            // Remove child from old parent
            let oldParent = content.find(n => n.name === TEMP_ENTITY_NAME && n.data?.flags?.cf?.children?.includes(data._id) && n.data.flags.cf.id != folderId)
            if (oldParent){
                let nData = {
                    _id: oldParent._id,
                    flags:{
                        cf:{
                            children:oldParent.data.flags.cf.children.filter(m => m != data._id)
                        }
                    }
                }
                await pack.updateEntity(nData)
                 //Update saved content for future reference
                oldParent.data.flags.cf.children = oldParent.data.flags.cf.children.filter(m => m != data._id);
            }
           
            packEntities.push(existing._id)
            
            await pack.updateEntity(data);            
        }
        else {
            result = await pack.createEntity(data)
            packEntities.push(result.id);
            if (result.id != e.id && folderObj.contents != null && folderObj.contents.length>0){
                folderObj.contents.splice(folderObj.contents.findIndex((x => x.id==e.id)),1,result.id);
            }
        }
        console.log(`${modName} | Exported ${e.name} to ${pack.collection}`);
    }
    if (!existingFolder){
        // Create new folder (exporting temp entity to allow for empty folders being editable)
        let tempData = getTempEntityData(pack.entity);
        tempData.flags.cf={
            id:folderId,
            path:path,
            color:color,
            name:folderObj.name,
            children:packEntities,
            folderPath:folderPath
        }
        await pack.createEntity(tempData);
    }else{
        let folderData = {
            _id:existingFolder.id,
            flags:{
                cf:{
                    children:[...new Set(existingFolder.data.flags.cf.children.concat(packEntities))]
                }
            }
        }
        await pack.updateEntity(folderData);
    }
    console.log(`${modName} | Exported temp entity to ${pack.collection}`);
    
    return folderObj
}
async function importFromCollectionWithMerge(clsColl,collection, entryId, folderPath, updateData={}, options={},merge=false) {
    const entName = clsColl.object.entity;
    const pack = game.packs.get(collection);
    if (pack.metadata.entity !== entName) return;

    // Prepare the source data from which to create the Entity
    const source = await pack.getEntity(entryId);
    let createData = mergeObject(clsColl.fromCompendium(source.data), {flags:{cf:{path:folderPath,import:true}}});
    delete createData._id;

    // Create the Entity
    
    let search = null
    if (merge){
        switch (entName){
            case 'Actor':search = game.actors.entities.filter(a => a.name === source.name && getFolderPath(a.folder)===folderPath)
                        break;
            case 'Item':search = game.items.entities.filter(i => i.name === source.name && getFolderPath(i.folder)===folderPath)
                        break;
            case 'JournalEntry':search = game.journal.entities.filter(j => j.name === source.name && getFolderPath(j.folder)===folderPath)
                        break;
            case 'Macro':search = game.macros.entities.filter(m => m.name === source.name && getMacroFolderPath(m.id)===folderPath)
                        break;
            case 'Playlist':search = game.playlists.entities.filter(p => p.name === source.name)
                        break;
            case 'RollTable':search = game.tables.entities.filter(r => r.name === source.name && getFolderPath(r.folder)===folderPath)
                        break;
            case 'Scene':search = game.scenes.entities.filter(s => s.name === source.name && getFolderPath(s.folder)===folderPath)
            
        }
    }
    if (search === null || search.length === 0){
        console.log(`${modName} | Importing ${entName} ${source.name} from ${collection}`);
        clsColl.directory.activate();
        return await clsColl.object.create(createData, options);
    }
    console.log(`${modName} | ${entName} ${source.name} already exists on correct path. Updating`);
    createData._id = search[0].id;
    return await clsColl.object.update(createData,options);
  }
// ==========================
// Importing folders from compendiums
// ==========================
async function recursivelyImportFolders(pack,coll,folder,merge){
    //First import immediate children
    let folderPath = getRenderedFolderPath(folder)
    for (let entry of folder.querySelectorAll(':scope > .folder-contents > .entry-list > li.directory-item')){
        // Will invoke importFolderData()
        await importFromCollectionWithMerge(coll,pack.collection,entry.getAttribute('data-entry-id'),folderPath, {}, {renderSheet:false},merge)
        // Wait a short amount of time for folder to fully create
        await new Promise(res => setTimeout(res,100));
    }
    //Then loop through individual folders
    let childFolders = folder.querySelectorAll(':scope > .folder-contents > .folder-list > li.compendium-folder');
    if (childFolders.length>0){
        for (let child of childFolders){
            await recursivelyImportFolders(pack,coll,child,merge);
        }
    }
}
async function importAllParentFolders(pack,coll,folder,merge){
    if (!folder.parentElement.classList.contains('directory-list')){
        let parentList = []
        let parent = folder
        while (!parent.parentElement.parentElement.classList.contains('directory-list')){
            parent = parent.parentElement.parentElement.parentElement
            parentList.push(parent);            
        }
        parentList.push(parent);

        for (let p of parentList.reverse()){
            if (p.querySelector(':scope > .folder-contents > .entry-list > li.directory-item.hidden')){
                await importFromCollectionWithMerge(coll,
                    pack.collection,
                    p.querySelector(':scope > .folder-contents > .entry-list > li.directory-item.hidden').getAttribute('data-entry-id'),
                    getRenderedFolderPath(p),
                    {flags:{cf:{import:true}}},
                    {renderSheet:false},
                    merge);
            }

            await new Promise(res => setTimeout(res,100));
        }
    }
}
async function importFolderFromCompendium(event,folder){
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
            let packCode = folder.closest('.sidebar-tab.compendium').getAttribute('data-pack');
            let pack = await game.packs.get(packCode);
            let coll = pack.cls.collection;
            if (pack.entity === 'Macro'){
                if (document.querySelector('#macros-popout') != null){
                    document.querySelector('#macros-popout').querySelector('a.header-button.close').click()
                }
            }
            await importAllParentFolders(pack,coll,folder,merge);
            await recursivelyImportFolders(pack,coll,folder,merge);
            ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationFinish"));
            await removeTempEntities(pack.entity);
            await game.settings.set(mod,'importing',false);
            if (pack.entity === 'Macro'){
                if (document.querySelector('#macros-popout') != null){
                    document.querySelector('#macros-popout').querySelector('a.header-button.close').click()
                }
            }
        }
    });
    
}
// ==========================
// Folder creation inside compendiums
// ==========================
function createFolderWithinCompendium(folderData,parentId,packCode,openFolders){
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
            createContextMenu(header,event);
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
                    id:generateRandomFolderName('temp_'),
                    path:getRenderedFolderPath(folder),
                    packCode:packCode,
                    tempEntityId:folderData.tempEntityId
                }).render(true)
            });
        }
        if (game.packs.get(packCode).entity != 'Playlist'){
            let importButton = document.createElement('a');
            importButton.innerHTML = "<i class='fas fa-upload fa-fw'></i>"
            importButton.classList.add('import-folder');
            importButton.setAttribute('title',game.i18n.localize("CF.importFolderHint"))
            importButton.addEventListener('click',event => importFolderFromCompendium(event,folder));

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

    let directoryList = document.querySelector('.sidebar-tab.compendium[data-pack=\''+packCode+'\'] ol.directory-list');
    let directoryFolderList = document.querySelector('.sidebar-tab.compendium[data-pack=\''+packCode+'\'] ol.directory-list > div.cfolders-container');
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

    folder.addEventListener('click',function(event){ toggleFolderInsideCompendium(event,folder,packCode) },false)

    for (let pack of directoryList.querySelectorAll('li.directory-item')){
        pack.addEventListener('click',function(ev){ev.stopPropagation()},false)
    }
    let childElements = folderData?.children?.map(c => directoryList.querySelector('li.directory-item[data-entry-id=\''+c+'\']'))
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
async function createFoldersWithinCompendium(groupedFoldersSorted,packCode,openFolders){
    Object.keys(groupedFoldersSorted).forEach(function(depth){
        // Now loop through folder compendiums, get them from dict, add to local list, then pass to createFolder
        for (let groupedFolder of alphaSortFolders(groupedFoldersSorted[depth],'name')){
            if (groupedFolder.folderPath != null){
                let parentFolderId = groupedFolder.folderPath[groupedFolder.folderPath.length-1];
                createFolderWithinCompendium(groupedFolder,parentFolderId,packCode,openFolders[packCode]);
            }
        }
    });
}
function createNewFolderButtonWithinCompendium(window,packCode){
    let directoryHeader = window.querySelector('header.directory-header');
    let button = document.createElement('button');
    button.classList.add('fic-create')
    button.type='submit';
    button.addEventListener('click',(e) => {
        e.stopPropagation();
        new FICFolderCreateDialog({
            parentId:null,
            name:'New Folder',
            id:generateRandomFolderName('temp_'),
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
async function importFolderData(e){
    let isMacro = e.entity === 'Macro'
    if (e.data.flags.cf != null && e.data.flags.cf.import != null && !e.folder){
        let path = e.data.flags.cf.path;
        let color = e.data.flags.cf.color;
        //a.data.folder -> id;
        let foundFolder = null;
        let folderExists=false;
        if (isMacro){
            let allMacroFolders = game.settings.get('macro-folders','mfolders')
            for (let folder of Object.entries(allMacroFolders)){
                if (folder.pathToFolder != null){
                    let folderPath = folder.pathToFolder.map(m => allMacroFolders[m].titleText).join(FOLDER_SEPARATOR)
                    if (!folderPath.contains(FOLDER_SEPARATOR)){
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
                if (folder.data.type==e.entity){
                    if (getFolderPath(folder) === path){
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
                await createMacroFolderPath(path,color,e);
            }else{
                await createFolderPath(path,color,e.entity,e);
            }
        }
    }
}
async function createFolderPath(path,pColor,entityType,e){
    let segments = path.split(FOLDER_SEPARATOR);
    let index = 0;
    for (let seg of segments){
        let folderPath = segments.slice(0,index).join(FOLDER_SEPARATOR)+FOLDER_SEPARATOR+seg
        if (index==0){
            folderPath = seg
        }
        let results = game.folders.filter(f => f.type === entityType && getFolderPath(f) === folderPath)
        if (results.length==0 ){
            //Create the folder if it does not exist
            let parentId = null
            let tContent = [];
            if (index>0){
                parentId = game.folders.filter(f => f.type===entityType && f.name===segments[index-1] && getFolderPath(f)===segments.slice(0,index).join(FOLDER_SEPARATOR))[0]
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
async function createMacroFolderPath(path,pColor,e){
    let allMacroFolders = game.settings.get('macro-folders','mfolders')
    game.settings.set('macro-folders','updating',true)  
    let lastId = null;
    let segments = path.split(FOLDER_SEPARATOR);
    let index = 0;
    for (let seg of segments){
        let folderPath = segments.slice(0,index).join(FOLDER_SEPARATOR)+FOLDER_SEPARATOR+seg
        if (index==0){
            folderPath = seg
        }
        let results = game.customFolders.macro.folders.filter(f => f.data.pathToFolder != null 
            && getFullPath(f) === folderPath)
        if (results.length==0 ){
            //create folder
            let newFolder = await CONFIG.MacroFolder.entityClass.create({
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
// ==========================
// For cleaning folder data from a compendium pack
// This is accessible from the module settings
// ==========================
async function cleanupCompendium(pack){
    ui.notifications.notify(game.i18n.format("CF.cleanupNotificationStart"),{pack:pack})
    let p = game.packs.get(pack);
    let index = await p.getIndex();
    let allData = await p.getContent();
    for (let entry of allData){
        if (entry.name.includes(TEMP_ENTITY_NAME)){
            await p.deleteEntity(entry.id)
        }else{
            let matchingIndex = index.find(i => i._id === entry.id);
            let data = await entry.toCompendium();
            if (data.flags.cf != null){
                data.flags['cf'] = null
            }
            if (matchingIndex){
                data._id = matchingIndex._id;
            }
            await p.updateEntity(data)
        }
    }
    ui.notifications.notify(game.i18n.localize("CF.cleanupNotificationFinish"))
}
class CleanupPackConfig extends FormApplication{
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
            packs : game.packs.values()
        }
    }
    
    /** @override */
    async _updateObject(event,formData){
        let pack = formData.pack;
        if (pack != null){
            await cleanupCompendium(pack);
        }
    }
}
async function cacheFolderStructure(packCode,groupedFolders,groupedFolderMetadata){
    if (!game.user.isGM) return;
    let cache = {
        pack:packCode,
        groupedFolders:groupedFolders,
        groupedFolderMetadata:groupedFolderMetadata
    }
    await game.settings.set(mod,'cached-folder',cache);
    console.log(modName+' | Cached folder structure');
}
async function loadCachedFolderStructure(packCode){
    let cache = game.settings.get(mod,'cached-folder');
    if (Object.keys(cache).length === 0){
        console.log(modName+' | No cached folder structure available');
        return null;
    }
    if (cache.pack === packCode)
        return cache.groupedFolders;
    return null;
}
async function moveEntryInCache(packCode,entryId,folderId){
    let cache = game.settings.get(mod,'cached-folder');
    if (Object.keys(cache).length === 0 || cache.pack != packCode){
        // shouldnt be reachable....
        return;
    }
    let x = await game.packs.get(packCode).getEntity(entryId)
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
async function updateFolderInCache(packCode,folderObj){
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
    cache.groupedFolders[folderMetadata.depth] = alphaSortFolders(cache.groupedFolders[folderMetadata.depth],'name')
    cache.groupedFolderMetadata[folderObj.id].index = cache.groupedFolders[folderMetadata.depth].findIndex(f => f.id === folderObj.id)
    console.debug(modName+' | Updating folder in cache')
   
    await game.settings.set(mod,'cached-folder',cache);
    console.log(modName+' | Updated cached folder structure');
}
async function resetCache(){
    if (!game.user.isGM) return;
    await game.settings.set(mod,'cached-folder',{});
    console.log(modName+' | Cleared cached folder structure');
}

function updateFolderPathForTempEntity(entity,content){
    // This constructs the folder path for temp entities
    // for each entity in contents with sub-path in entity path, add id
    let parents = content.filter(e => e.data.flags != null 
        && e.data.flags.cf != null 
        && entity.data.flags.cf.path.startsWith(e.data.flags.cf.path,0) 
        && e.name === TEMP_ENTITY_NAME);
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
    updateData._id = entity.id
    console.debug(updateData);
    
    return updateData;
}
function removeOrUpdateFolderIdForEntity(entity,content){
    let parent = content.find(e => e.name === TEMP_ENTITY_NAME 
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
        _id:entity.id
    }
    return updateData
}
//==========================
// Settings utilities
//==========================
export class Settings{
    static registerSettings(){
        game.settings.registerMenu(mod,'settingsMenu',{
            name: game.i18n.localize('CF.configuration'),
            label: game.i18n.localize('CF.importExportLabel'),
            icon: 'fas fa-wrench',
            type: ImportExportConfig,
            restricted: true
        });
        game.settings.register(mod, 'cfolders', {
            scope: 'world',
            config: false,
            type: Object,

            default:{}
        });
        game.settings.register(mod,'open-folders',{
            scope: 'client',
            config:false,
            type: Object,
            default:[]
        });     
        game.settings.registerMenu(mod,'cleanupCompendiums',{
            name:game.i18n.localize('CF.cleanup'),
            icon:'fas fa-atlas',
            label: game.i18n.localize('CF.cleanupHint'),
            type: CleanupPackConfig,
            restricted:true,
        })
        game.settings.register(mod,'open-temp-folders',{
            scope: 'client',
            config:false,
            type:Object,
            default:{}
        });
        game.settings.register(mod,'last-search-packs',{
            scope:'client',
            config:false,
            type:Object,
            default:{}
        });
        game.settings.register(mod,'converted-packs',{
            scope:'world',
            config:false,
            type:Object,
            default:[]
        });
        game.settings.register(mod,'cached-folder',{
            scope:'world',
            config:false,
            type:Object,
            default:{}
        });
        game.settings.register(mod,'importing',{
            scope:'client',
            config:false,
            type:Boolean,
            default:false
        });
        game.settings.register(mod,'default-mbn',{
            name:'Default Merge by name',
            hint:'If enabled, the Merge by name option will be enabled by default when importing compendiums',
            scope:'world',
            config:true,
            type:Boolean,
            default:false
        });
        if (game.customFolders){
            game.customFolders.compendium = {
                folders:new CompendiumFolderCollection([]),
                entries:new CompendiumEntryCollection([])
                
            }
        } else {
            game.customFolders = {
                compendium:{
                    folders:new CompendiumFolderCollection([]),
                    entries:new CompendiumEntryCollection([])
                }
            }
        }
        
    }
    static updateFolder(folderData){
        let existingFolders = game.settings.get(mod,'cfolders');
        existingFolders[folderData._id]=folderData;
        game.settings.set(mod,'cfolders',existingFolders);
    }
    static updateFolders(folders){
        game.settings.set(mod,'cfolders',folders);
    }
    static addFolder(title,color,compendiums){
        let existingFolders = game.settings.get(mod,'cfolders');
        let newFolders = existingFolders;
        newFolders.push({'title':title,'color':color,'compendiums':compendiums});
        game.settings.set(mod,'cfolders',newFolders);
    }
    static getFolders(){
        return game.settings.get(mod,'cfolders');
    }
    static async clearSearchTerms(){
        game.settings.set(mod,'last-search-packs',{})
    }
}
// ==========================
// Main hook setup
// ==========================
var eventsSetup = []
async function initFolders(refresh=false){
    let allFolders = game.settings.get(mod,'cfolders');
    game.customFolders.compendium = null;
    // let refresh = false;
    let assigned = []
    let toRemove = [];
    if (allFolders.hidden && !allFolders.hidden._id){
        allFolders.hidden._id = 'hidden'
    }
    if (allFolders.default && !allFolders.default._id){
        allFolders.default._id = 'default';
    }
    let init1 = false;
    if (Object.keys(allFolders).length <= 2 && allFolders.constructor === Object){
        // initialize settings
        init1 = true;
        let entityId = {}
  
        allFolders = {
            hidden:{
                compendiumList:[],
                titleText :'hidden-compendiums',
                _id:'hidden'
            },
            default:{
                compendiumList:[],
                titleText:'Default',
                _id:'default',
                colorText:'#000000'
            }
        };
        for (let pack of game.packs.entries){
            if (allFolders[entityId[pack.entity]]){
                allFolders[entityId[pack.entity]].compendiumList.push(pack.collection);
            }else{
                entityId[pack.entity] = 'cfolder-'+randomID(10);
                allFolders[entityId[pack.entity]] = {
                    _id:entityId[pack.entity],
                    titleText:pack.entity,
                    compendiumList:[pack.collection],
                    colorText:'#000000',
                    fontColorText:'#FFFFFF'
                }
            }
        }
    }
    for (let folder of Object.values(allFolders)){
        let compendiums = []
        folder.compendiums = []
        for (let pack of folder.compendiumList){
            let existingPack = game.customFolders?.compendium?.entries?.get(pack)
            if (game.packs.has(pack)){
                if (!existingPack)
                    compendiums.push(new CompendiumEntry(pack,folder._id))
                else
                    compendiums.push(existingPack);
            }else{
                toRemove.push(pack);
            }
            if (folder._id != 'default')
                assigned.push(pack);
        }
        let f = CompendiumFolder.import(folder,compendiums)
        // refresh flag works like "init" in this case
        if (init1)
            await f.save(false); 

    }
    // Set default folder content
    let unassigned = game.packs.entries.filter(x => !assigned.includes(x.collection))
    for (let pack of unassigned.map(y => y.collection)){
        if (game.customFolders.compendium.entries.has(pack)){
            // Pack has an entry (assigned to default folder)
            game.customFolders.compendium.entries.get(pack).folder = 'default';
        }else{
            // Pack does not have an entry (because it is new)
            new CompendiumEntry(pack,'default');
        }
    }
    game.customFolders.compendium.folders.default.compendiumList = game.customFolders.compendium.folders.default.compendiumList.concat(unassigned.map(y => y.collection));
    game.customFolders.compendium.folders.default.content = game.customFolders.compendium.folders.default.content.concat(unassigned);

    // Check for removed compendiums
    let missingCompendiums = false
    let goneCompendiums = game.customFolders.compendium.entries.filter(x => !x.pack);
    for (let c of goneCompendiums){
        c.parent.removeCompendium(c,true,false);
        missingCompendiums = true;
    }
    if (missingCompendiums){
        ui.compendium.render(true);
        return;
    }
    
    // Set child folders
    let allEntries = [...game.customFolders.compendium.folders.values()]
    for (let cf of allEntries){
        let directChildren = allEntries.filter(f => f.data?.pathToFolder?.length > 0 && f.data.pathToFolder[f.data.pathToFolder.length-1] === cf._id)
        cf.children = directChildren;
    }
    
    if (game.user.isGM)
        game.settings.set(mod,'cfolders',allFolders);
    if (refresh){
        await ui.compendium.render(true);
    }
}
Hooks.once('setup',async function(){
    let post073 = game.data.version >= '0.7.3';
    
    Settings.registerSettings()
    Hooks.once('ready',async function(){
        // Ensure compatibility with other modules that rely on the old directory.
        Hooks.on('renderCompendiumFolderDirectory',(html,e) => {
            Hooks.call('renderCompendiumDirectory',html,e);
        });
        
        while (!ui.compendium.rendered){
            // wait for old compendium directory to render
            // else we get a race condition
            await new Promise(res => setTimeout(res,500));
        }
        ui.compendium = new CompendiumFolderDirectory();
        await initFolders(true);
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
            exportFolderStructureToCompendium(game.folders.get(li.dataset.folderId))
        }  
    }
    let oldActorFolderCtxOptions = ActorDirectory.prototype._getFolderContextOptions
    ActorDirectory.prototype._getFolderContextOptions = () => oldActorFolderCtxOptions().concat(newContextOption);

    let oldItemFolderCtxOptions = ItemDirectory.prototype._getFolderContextOptions
    ItemDirectory.prototype._getFolderContextOptions = () => oldItemFolderCtxOptions().concat(newContextOption);

    let oldJournalFolderCtxOptions = JournalDirectory.prototype._getFolderContextOptions
    JournalDirectory.prototype._getFolderContextOptions = () => oldJournalFolderCtxOptions().concat(newContextOption);

    let oldRollTableFolderCtxOptions = RollTableDirectory.prototype._getFolderContextOptions
    RollTableDirectory.prototype._getFolderContextOptions = () => oldRollTableFolderCtxOptions().concat(newContextOption);

    let oldSceneFolderCtxOptions = SceneDirectory.prototype._getFolderContextOptions
    SceneDirectory.prototype._getFolderContextOptions = () => oldSceneFolderCtxOptions().concat(newContextOption);

    // Folders In Compendium changes
    if (post073){
        Settings.clearSearchTerms()
        Hooks.on('renderCompendium',async function(e){
            let packCode = e.metadata.package+'.'+e.metadata.name;
            let window = e._element[0]
            if (!e.locked && game.user.isGM)
                createNewFolderButtonWithinCompendium(window,packCode);
            if (!e.index.some(x => x.name === TEMP_ENTITY_NAME)) return;

            removeStaleOpenFolderSettings(packCode);
            let cachedFolderStructure = await loadCachedFolderStructure(packCode);
            let allFolderData={};
            let groupedFoldersSorted = {}
            let groupedFolders = {}
            
            if (cachedFolderStructure != null){
               groupedFoldersSorted = cachedFolderStructure;
            }else{
                let folderChildren = {}
                let checkedPaths = []
                let contents = await e.getContent();
                let allFolderIds = contents.filter(e => e.data.flags != null 
                    && e.data.flags.cf != null
                    && e.data.flags.cf.id != null 
                    && e.name === TEMP_ENTITY_NAME).map(e => e.data.flags.cf.id)
                let updateData = [];
                //First parse folder data
                for (let entry of contents){
                    if (entry != null 
                        && entry.data.flags.cf != null){
                        let folderId = entry.data.flags.cf.id;
                        let entryId = entry._id
                        if (folderId != null){
                            if (entry.name === TEMP_ENTITY_NAME){
                                if (entry.data.flags.cf.folderPath == null){
                                    let result = updateFolderPathForTempEntity(entry,contents);
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
                                        children:[entryId],
                                        name:name,
                                        folderPath:folderPath,
                                        tempEntityId:entryId,
                                        icon:folderIcon,
                                        fontColor:fontColor
                                    }
                                    allFolderData[folderId]=data
                                }
                            }
                            else if (entry.data.flags.cf.id != null
                                && entry.name != TEMP_ENTITY_NAME
                                && !allFolderIds.includes(entry.data.flags.cf.id)){
                                updateData.push(removeOrUpdateFolderIdForEntity(entry,contents));
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
                                await e.updateEntity(d);
                            }
                            resetCache()
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
                await cacheFolderStructure(packCode,groupedFoldersSorted,groupedFolderMetadata);
            }
            console.log(modName+' | Creating folder structure inside compendium.');
            let openFolders = game.settings.get(mod,'open-temp-folders');
            await createFoldersWithinCompendium(groupedFoldersSorted,packCode,openFolders);
            //createNewFolderButtonWithinCompendium(window,packCode);
            for (let entity of window.querySelectorAll('.directory-item')){
                if (entity.querySelector('h4').innerText.includes(TEMP_ENTITY_NAME)){
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
                        let currentId = this.getAttribute('data-entry-id');
                        this.closest('ol.directory-list').querySelector('input.folder-to-move').value = currentId
                    })
                }
                for (let folder of window.querySelectorAll('.compendium-folder')){
                    folder.addEventListener('drop',async function(event){
                        let movingItemId = this.closest('ol.directory-list').querySelector('input.folder-to-move').value;
                        if (movingItemId.length>0){
                            console.log(modName+' | Moving entry '+movingItemId+' to new folder.')
                            this.closest('ol.directory-list').querySelector('input.folder-to-move').value = '';
                            //let entryInFolderElement = this.querySelector(':scope > div.folder-contents > ol.entry-list > li.directory-item')

                            let packCode = this.closest('.sidebar-tab.compendium').getAttribute('data-pack');
                            let p = game.packs.get(packCode);                          
                           
                            let data = {
                                _id:movingItemId,
                                flags:{
                                    cf:{
                                        id:folder.getAttribute('data-folder-id')   
                                    }
                                }
                            }
                            await moveEntryInCache(packCode,movingItemId,this.getAttribute('data-folder-id'))
                            if (data) await p.updateEntity(data)
                        }
                    })
                }
            }         
            
        })

        Hooks.on('renderApplication',async function(a){
            //When compendium window renders, recreate the search bar and register custom listener
            if (a.template != null && a.template === 'templates/apps/compendium.html'){
                let pack = game.packs.get(a.collection);
                if (!pack.index.some(x => x.name === TEMP_ENTITY_NAME)) return;
                
                let window = a._element[0]
                let searchBar = window.querySelector('input[name=\'search\']')
                let newSearchBar = document.createElement('input')
                newSearchBar.name='search2';
                newSearchBar.placeholder='Search';
                newSearchBar.type='text';
                newSearchBar.autocomplete='off';
                newSearchBar.setAttribute('data-pack',a.collection)
                let existingSearchTerms = game.settings.get(mod,'last-search-packs')
                if (!Object.keys(existingSearchTerms).includes(a.collection)){
                    existingSearchTerms[a.collection] = ""
                    await game.settings.set(mod,'last-search-packs',existingSearchTerms)
                }
                newSearchBar.value = existingSearchTerms[a.collection]
                if (newSearchBar.value.length>0){
                    filterSelectorBySearchTerm(window,newSearchBar.value,'.directory-item')
                }
                
                newSearchBar.addEventListener('keyup',async function(event){
                    event.stopPropagation();
                    let existingSearchTerms = game.settings.get(mod,'last-search-packs')
                    existingSearchTerms[event.currentTarget.getAttribute('data-pack')] = event.currentTarget.value
                    game.settings.set(mod,'last-search-packs',existingSearchTerms);
                    filterSelectorBySearchTerm(window,event.currentTarget.value,'.directory-item')
                })
                let header = searchBar.parentElement;
                header.replaceChild(newSearchBar,searchBar);
            }
        });
        // Hooking into the update/create methods to extract
        // folder data from the entity
        // and create folders based on them
        Hooks.on('createActor',async function(a){
            await importFolderData(a);
        })
        Hooks.on('createItem',async function(i){
            await importFolderData(i);
        })
        Hooks.on('createJournalEntry',async function(j){
            await importFolderData(j);
        })
        Hooks.on('createMacro',async function(m){
            await importFolderData(m);
        })
        Hooks.on('createPlaylist',async function(p){
            await importFolderData(p);
        })
        Hooks.on('createRollTable',async function(r){
            await importFolderData(r);
        })
        Hooks.on('createScene',async function(s){
            await importFolderData(s);
        })
        

        Hooks.on('updateActor',async function(a){
            await importFolderData(a);
        })
        Hooks.on('updateItem',async function(i){
            await importFolderData(i);
        })
        Hooks.on('updateJournalEntry',async function(j){
            await importFolderData(j);
        })
        Hooks.on('updateMacro',async function(m){
            await importFolderData(m);
        })
        Hooks.on('updatePlaylist',async function(p){
            await importFolderData(p);
        })
        Hooks.on('updateRollTable',async function(r){
            await importFolderData(r);
        })
        Hooks.on('updateScene',async function(s){
            await importFolderData(s);
        })

        // Adding the export button to all folders
        // ONLY if it contains an entity (either direct child or in child folder)
        
        Hooks.on('renderActorDirectory',async function(a){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.actors.entities.some(a => a.name === TEMP_ENTITY_NAME)){
                await removeTempEntities('Actor')
            }
        })
        Hooks.on('renderItemDirectory',async function(e){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.items.entities.some(i => i.name === TEMP_ENTITY_NAME)){
                await removeTempEntities('Item')
            }
        })
        Hooks.on('renderJournalDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.journal.entities.some(j => j.name === TEMP_ENTITY_NAME)){
                await removeTempEntities('JournalEntry')
            }
        })
        Hooks.on('renderPlaylistDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.playlists.entities.some(p => p.name === TEMP_ENTITY_NAME)){
                await removeTempEntities('Playlist')
            }
        })
        Hooks.on('renderRollTableDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.tables.entities.some(r => r.name === TEMP_ENTITY_NAME)){
                await removeTempEntities('RollTable')
            }
        })
        Hooks.on('renderSceneDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.scenes.entities.some(s => s.name === TEMP_ENTITY_NAME)){
                await removeTempEntities('Scene')
            }
        })
        // Integration with Macro Folders
        Hooks.on('addExportButtonsForCF',async function(){
            addMacroFoldersExportButton();
        })
        Hooks.on('renderMacroDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.macros.entities.some(m => m.name === TEMP_ENTITY_NAME)){
                await removeTempEntities('Macro')
            }
        })
        Hooks.on("getCompendiumFolderDirectoryEntryContext", async (html,options) => {
            Hooks.call("getCompendiumDirectoryEntryContext",html,options)
        })
    }
});
