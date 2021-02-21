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
async function getFolderColor(packCode,tempEntityId){
    let pack = game.packs.get(packCode)
    let tempEntity = await pack.getEntity(tempEntityId);
    return tempEntity.data.flags.cf.color
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

    if (header.parentElement.querySelector(':scope > div.folder-contents > ol.entry-list > li.directory-item') != null){
        let editOption = document.createElement('li');
        editOption.classList.add('context-item')
        let editIcon = document.createElement('i');
        editIcon.classList.add('fas','fa-edit');
        editOption.innerHTML=editIcon.outerHTML+game.i18n.localize("CF.editFolder");
        editOption.addEventListener('click',async function(ev){
            ev.stopPropagation();
            closeContextMenu();
            let path = getRenderedFolderPath(folder);
            let folderColor = await getFolderColor(packCode,tempEntityId);
            let formObj = {
                id:folderId,
                name:folderName,
                color:folderColor,
                path:path,
                packCode:packCode,
                tempEntityId:tempEntityId
            }
            new FICFolderEditDialog(formObj).render(true);
        })
        contextMenuList.appendChild(editOption);
    }
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
 
        case 'JournalEntry': return {name:TEMP_ENTITY_NAME,flags:{cf:folder}}

        case 'Macro':return {name:TEMP_ENTITY_NAME,type:'chat',command:'',flags:{cf:folder}} 

        case 'RollTable':return {name:TEMP_ENTITY_NAME,flags:{cf:folder}}

        case 'Scene':return {name:TEMP_ENTITY_NAME,flags:{cf:folder}} 
        default:     
            return null;      
    }
}
async function removeTempEntities(entityType){
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
        case 'RollTable':collection = game.tables;
            break;
        case 'Scene':collection = game.scenes;           
    }
    if (collection != null){
        let tempEntities = collection.entries.filter(x => x.name.includes(TEMP_ENTITY_NAME));
        for (let tempEntity of tempEntities){
            let entity = null;
            if (entityType==='Macro'){
                entity = collection.apps[1].constructor.collection.get(tempEntity.id);
            }else{
                entity = collection.apps[0].constructor.collection.get(tempEntity.id);
            }
            await entity.delete(entity)
        } 
    }
    
}
function getFolderPath(folder){
    if (folder === null){
        return '';
    }
    let path = folder.data.name;
    let currentFolder = folder;
    while (currentFolder.parent != null){
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
function deleteExistingRules(){
    var sheet = window.document.styleSheets[0];
    for (var i=sheet.cssRules.length-1;i>=0;i--){
        if (sheet.cssRules[i].selectorText==='#compendium h3'){
            sheet.deleteRule(i);
            return;
        }
    }
}

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
function checkForDeletedCompendiums(){
    let allFolders = game.settings.get(mod,'cfolders');
    let allCompendiums = Array.from(game.packs.keys());
    let defaultFolderExists = false;
    Object.keys(allFolders).forEach(function (key){
        let packsToRemove = [];
        for (let folderCompendium of allFolders[key].compendiumList){
            if (!allCompendiums.includes(folderCompendium)){
                packsToRemove.push(folderCompendium);
                console.log(modName+" | Compendium "+folderCompendium+" no longer exists. Removing from folder "+allFolders[key].titleText)
            }
        }
        for (let toRemove of packsToRemove){
            let compendiumIndex = allFolders[key].compendiumList.indexOf(toRemove);
            allFolders[key].compendiumList.splice(compendiumIndex,1);
        }
        if (key === 'default'){
            defaultFolderExists = true;
        }
    });
    if (game.user.isGM){
        if (!defaultFolderExists){
            allFolders['default']={'compendiumList':[],'titleText':'Default','colorText':'#000000','_id':'default'}
        }
        game.settings.set(mod,'cfolders',allFolders).then(() => {return allFolders});
    }
    return allFolders;
}
// Recursively construct folder data from macro folders settings
async function constructFolderDataFromMacroFolder(mFolderId,macroFolders){
    let folderObj = {data:{_id:mFolderId}};
    let currentFolder = macroFolders[mFolderId];
    folderObj.content = currentFolder.macroList.map(m => game.macros.get(m));
    folderObj.data.color = currentFolder.colorText;
    folderObj.data.name = currentFolder.titleText;
    folderObj.name = currentFolder.titleText;
    folderObj.data.type = 'Macro'
    let currentFolderChildren = Object.values(macroFolders).filter(m => m.pathToFolder != null && m.pathToFolder[m.pathToFolder.length-1] === mFolderId)
    folderObj.children = []
    for (let child of currentFolderChildren){
        folderObj.children.push(await recursivelyFetchChildren(child._id,macroFolders,folderObj));
    }

    // Is root folder
    if (currentFolder.pathToFolder.length === 0){
        return folderObj
    }
    let parentFolderId = currentFolder.pathToFolder.pop();
    let parentFolder = await recursivelyFetchParents(parentFolderId,macroFolders);
    folderObj.parent = parentFolder;
    folderObj.data.parent = parentFolder;
    return folderObj;

}
async function recursivelyFetchChildren(mFolderId,macroFolders,parent){
    let folderObj = {data:{_id:mFolderId}};
    let currentFolder = macroFolders[mFolderId];
    folderObj.content = currentFolder.macroList.map(m => game.macros.get(m));
    folderObj.data.color = currentFolder.colorText;
    folderObj.data.name = currentFolder.titleText;
    folderObj.name = currentFolder.titleText;
    folderObj.data.type = 'Macro'
    folderObj.data.parent = parent;
    folderObj.parent = parent;
    let currentFolderChildren = Object.values(macroFolders).filter(m => m.pathToFolder != null && m.pathToFolder[m.pathToFolder.length-1] === mFolderId)
    folderObj.children = []
    // Folder has no macros in it
    if (currentFolderChildren.length===0){
        return folderObj;
    }
    for (let child of currentFolderChildren){
        folderObj.children.push(await recursivelyFetchChildren(child._id,macroFolders,folderObj));
    }
    return folderObj
}
async function recursivelyFetchParents(mFolderId,macroFolders){
    let folderObj = {data:{_id:mFolderId}};
    let currentFolder = macroFolders[mFolderId];
    folderObj.content = currentFolder.macroList.map(m => game.macros.get(m));
    folderObj.data.color = currentFolder.colorText;
    folderObj.data.name = currentFolder.titleText;
    folderObj.name = currentFolder.titleText;
    folderObj.data.type = 'Macro'
    folderObj.children = []
    if (currentFolder.pathToFolder.length === 0){
        return folderObj
    }
    let parentFolderId = currentFolder.pathToFolder.pop();
    let parentFolder = await recursivelyFetchParents(parentFolderId,macroFolders);
    folderObj.parent = parentFolder;
    folderObj.data.parent = parentFolder;
    return folderObj;

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
        let data = duplicate(this.data);
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
        game.customFolders.compendium.folders.get(this._id).data = duplicate(this.data);
        if (refresh)
            ui.compendium.render(true,'update')
    }
    async delete(refresh=true){
        let nextFolder = (this.parent) ? this.parent : this.collection.default;
        for (let pack of this.content){
            nextFolder.addCompendium(pack);
        }
        if (this.content?.length>0)
            nextFolder.update(false);
        if (this.collection.get(this.id)){
            this.collection.remove(this.id)
        }
        let allFolders = game.settings.get(mod,'cfolders')
        // create folder
        delete allFolders[this.id];
        
        await game.settings.set(mod,'cfolders',allFolders)
        if (refresh)
            ui.compendium.render(true,'update')
        
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
    async removeCompendium(packCode,del=false,refresh=true){
        this._removePack(packCode,del);
        if (del){
            game.customFolders.compendium.entries.remove(packCode);
        }else{
            let entry = game.customFolders.compendium.entries.get(packCode);
            let hiddenFolder = this.collection.hidden;
            hiddenFolder._addPack(entry);
            await hiddenFolder.save(false);
        }
        await this.save(refresh);
    }
    async moveFolder(destId){
        let destFolder = this.collection.get(destId);

        this._moveToFolder(destFolder);
        
    }
    _addPack(pack){
        this.content = this.content.concat(pack);
        this.data.compendiumList = this.data.compendiumList.concat(pack.packCode);
        pack.folder = this._id;
    }
    _removePack(pack,del=false){
        this.content = this.content.filter(x => x.packCode != pack.packCode);
        this.data.compendiumList = this.content.map(p => p.packCode);
        if (del)
            pack.folder = null
    }
    _removeFolder(child){
        this.children = this.children.filter(c => c.id != child.id);
    }
    async _moveToFolder(destFolder){

        this.path = (destFolder) ? destFolder.path.concat(destFolder.id) : [];
        if (this.parent){
            this.parent._removeFolder(this);
            this.parent.save(false); 
        }
        if (destFolder){
            this.parent = destFolder._id;
            this.parent.children = this.parent.children.concat(this);
            this.parent.save(false);
        }else{
            this.parent = null;
        }
        
        await this.save();
        
        this._updatePath()
        ui.compendium.refresh();
    }
    // Update path of this and all child folders
    async _updatePath(currentFolder=this,parent=this){
        if (currentFolder.id != parent.id){
            currentFolder.path = parent.path.concat(parent.id);
            await currentFolder.update(currentFolder.data,false);
        }
        for (let child of currentFolder.children){
            child._updatePath(child,currentFolder);
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
            await c.parent.removeCompendium(c.code,true,false);
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
            this.folders = [...this.constructor.folders].filter(x => x.content.find(y => !y.pack.private));
            this.entities = [...this.constructor.collection].filter(z => !z.pack.private);
        }
        let tree = this.constructor.setupFolders(this.folders, this.entities);
        
        this.tree = this._sortTreeAlphabetically(tree)
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
            data.parent = parent;
        }
        const options = {top: button.offsetTop, left: window.innerWidth - 310 - FolderConfig.defaultOptions.width};
        new CompendiumFolderEditConfig(data, options).showDialog(false);
    }
    // /** @override */
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

        // Options below are GM only
        if ( !game.user.isGM ) return;

        // Create Compendium
        html.find('.create-compendium').click(this._onCreateEntity.bind(this));

        // html.find('.create-entity').click(this._onCreateEntityInFolder.bind(this));
        //Manually set icons in here for now
        $('#compendium .directory-item.folder').each((i,el) => {
            let li = $(el);
            let folder = game.customFolders.compendium.folders.get(li.data("folderId"));
            if (folder?.icon){
                let oldTag = el.querySelector('i');
                let folderCustomIcon = document.createElement('img');
                folderCustomIcon.src = folder.icon;
                oldTag.parentNode.replaceChild(folderCustomIcon,oldTag);
            }
        });
    }

    /** @override */
    _getEntryContextOptions(){
        if (!game.user.isGM)
            return;
        let x = CompendiumDirectory.prototype._getEntryContextOptions()
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
                    await game.customFolders.compendium.folders.find(x => x.compendiumList.includes(pack.collection)).removeCompendium(pack.collection,true,true);
                    await game.initializePacks();
                    ui.compendium.render();
                },
                defaultYes: false
              })
        }
        return x.concat([
            {
                name: "Hide for GM",
                icon: '<i class="fas fa-eye"></i>',
                callback: li => {
                    game.customFolders.compendium.folders.hidden.addCompendium(li.data("pack")).then(() => {
                        ui.notifications.notify("Moved compendium to hidden folder. Edit a compendium folder to see hidden/unassigned folders");
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
                
                name: "Show All To Players",
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
                    ui.compendium.render(true,'update');
                }
            },{
                name: "Hide All From Players",
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
                    ui.compendium.render(true,'update');
                }
            },{
                name: "Lock All Contents",
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
                    ui.compendium.render(true,'update');
                }
            },{
                name: "Unlock All Contents",
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
                    ui.compendium.render(true,'update');
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
        const dragData = li.classList.contains("folder") ?
            { type: "Folder", id: li.dataset.folderId, entity: this.constructor.entity } :
            { type: this.constructor.entity, id: li.dataset.pack };
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        this._dragType = dragData.type;
    }
    _onDrop(event){
        event.stopPropagation();
        let li = event.currentTarget.closest("li.folder");
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
                game.customFolders.compendium.folders.get(folderId).addCompendium(data.id)
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
        console.log("TEST");
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

export class CompendiumFolderOld{
    constructor(title,color,path){
        this.title = title;
        this.color = color;
        this.compendiums = [];
        this.folders = [];
        this.uid=generateRandomFolderName('cfolder_');
        this.pathToFolder = path;
        this.icon = null;
        this.fontColor = '#FFFFFF'
    }
    initFromExisting(existing){
        this.title = existing['titleText'];
        this.color = existing['colorText']
        this.compendiums = existing['compendiumList'];
        this.folders = existing['folders'];
        this.uid = existing['_id'];
        this.path = existing['pathToFolder'];
        this.icon = existing['folderIcon']
        this.fontColor = existing['fontColorText']
    }
    get uid(){return this._id;}
    set uid(id){this._id=id;}
    get title(){return this.titleText;}
    get color(){return this.colorText;}
    set title(ntitle){this.titleText = ntitle;}
    set color(ncolor){this.colorText = ncolor;}
    get compendiums(){return this.compendiumList;}
    get folders(){return this.folderList;}
    set compendiums(compendiums){this.compendiumList = compendiums;}
    set folders(folders){this.folderList = folders;}
    get icon(){return this.folderIcon}
    set icon(nIcon){this.folderIcon=nIcon}
    get fontColor(){return this.fontColorText;}
    set fontColor(fc){this.fontColorText=fc;}
    addCompendium(compendium){
        this.compendiums.push(compendium);
    }
    addFolder(compendiumFolder){
        this.folders.push(compendiumFolder);
    }
    get path(){
        return this.pathToFolder;
    }
    set path(npath){
        this.pathToFolder=npath;
    }
}
// ==========================
// Module init functions
// ==========================
function convertExistingSubmenusToFolder(){
    console.log(modName+' | No folder data found. Converting current compendium state to folders');
    deleteExistingRules()
    let submenus = document.querySelectorAll('li.compendium-entity');
    while (submenus == null){
        setTimeout(function(){submenus = document.querySelectorAll('li.compendium-entity')},1000)
    }
    let allFolders = game.settings.get(mod,'cfolders');
    for (var submenu of submenus){
        if (submenu.classList.contains('compendium-folder')){
            continue;
        }
        let compendiumFolder = createFolderObjectForSubmenu(submenu,submenu.querySelector('h3').innerText);
        allFolders[compendiumFolder._id]=compendiumFolder;
        convertSubmenuToFolder(submenu,compendiumFolder._id);
    }

    // create folder button
    let button = document.createElement('button');
    button.classList.add('cfolder-create')
    button.type='submit';
    button.addEventListener('click',function(){createNewFolder([])});
    let folderIcon = document.createElement('i')
    folderIcon.classList.add('fas','fa-fw','fa-folder')
    button.innerHTML = folderIcon.outerHTML+game.i18n.localize("FOLDER.Create");
    document.querySelector('#compendium .directory-footer').appendChild(button);

    createDirectoryHeader();
    game.settings.set(mod,'cfolders',allFolders);
}

function convertSubmenuToFolder(submenu,uid){
    
    submenu.classList.add('compendium-folder')

    let header = document.createElement('header')
    header.classList.add('compendium-folder-header', 'flexrow')
    header.style.backgroundColor = '#000000';
    let title = submenu.querySelector('h3')
    let titleText = title.innerText
    let folderIcon = document.createElement('i')
    folderIcon.classList.add('fas','fa-fw','fa-folder')
    title.innerHTML = folderIcon.outerHTML+titleText

    let newFolderLabel = document.createElement('label')
    let newFolderIcon = document.createElement('i');
    let newFolderLink = document.createElement('a');
    newFolderLabel.setAttribute('title',game.i18n.localize('CF.createSubfolder'));
    newFolderIcon.classList.add('fas','fa-folder-plus','fa-fw');
    newFolderLink.classList.add('create-folder');
    newFolderLabel.appendChild(newFolderIcon)
    newFolderLink.appendChild(newFolderLabel);

    let moveFolderLabel = document.createElement('label')
    let moveFolderIcon = document.createElement('i');
    let moveFolderLink = document.createElement('a');
    moveFolderLabel.setAttribute('title',game.i18n.localize('CF.moveFolder'))
    moveFolderIcon.classList.add('fas','fa-sitemap','fa-fw');
    moveFolderLink.classList.add('move-folder');
    moveFolderLabel.appendChild(moveFolderIcon);
    moveFolderLink.appendChild(moveFolderLabel);

    let cogLabel = document.createElement('label')
    cogLabel.setAttribute('title',game.i18n.localize('FOLDER.Edit'));
    let cogIcon = document.createElement('i')
    cogIcon.classList.add('fas','fa-cog','fa-fw')
    let cogLink = document.createElement('a')
    cogLink.classList.add('edit-folder')
    cogLabel.appendChild(cogIcon)
    cogLink.appendChild(cogLabel)
    header.appendChild(title)
    header.appendChild(moveFolderLink);
    header.appendChild(newFolderLink);
    header.appendChild(cogLink);
    submenu.insertAdjacentElement('afterbegin',header)

    //Close folder by default
    let contents = document.createElement('div');
    contents.classList.add('folder-contents');
    let folderList = document.createElement('ol');
    folderList.classList.add('folder-list');
    let packs = submenu.querySelector('ol.compendium-list')
    packs.insertAdjacentElement('beforebegin',contents);
    contents.appendChild(folderList);
    contents.appendChild(packs);
    
    
    contents.style.display='none'
    cogLink.style.display='none' 
    newFolderLink.style.display='none';
    moveFolderLink.style.display='none';
    submenu.setAttribute('collapsed','')

    submenu.setAttribute('data-cfolder-id',uid);
}

function createFolderObjectForSubmenu(submenu,titleText){
    let compendiums = submenu.querySelector('ol').querySelectorAll('li.compendium-pack')
    let folderObject = new CompendiumFolderOld(titleText,"#000000",[])
    for (let compendium of compendiums){
        folderObject.addCompendium(compendium.getAttribute('data-pack'))
    }
    return folderObject
}

// ==========================
// Directory header functions
// ==========================
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
function createDirectoryHeader(){
    let tab = document.querySelector("#sidebar .sidebar-tab[data-tab='compendium']");
    if (tab.querySelector('.directory-header > div.header-search')==null){
       
        let searchDiv = document.createElement('div');
        searchDiv.classList.add('header-search');
        if (game.data.version >= '0.7.3'){
            searchDiv.classList.add('flexrow');
        }

        let searchIcon = document.createElement('i');
        searchIcon.classList.add('fas','fa-search');
        let searchBar = document.createElement('input');
        searchBar.setAttribute('type','text');
        searchBar.setAttribute('name','search');
        searchBar.setAttribute('placeholder','Search Compendiums');
        searchBar.setAttribute('autocomplete','off');

        searchBar.addEventListener('keyup',function(event){
            filterSelectorBySearchTerm(tab,event.target.value,'.compendium-pack');
        });
        if (game.data.version < '0.7.3'){
            searchIcon.style.paddingRight='3px';
        }
        let collapseLink = document.createElement('a');
        collapseLink.classList.add('header-control','collapse-all');

        //collapseLink.style.flex='0 0 24px';
        collapseLink.title=game.i18n.localize('FOLDER.Collapse');
        collapseLink.addEventListener('click',function(){
            document.querySelectorAll('.compendium-folder').forEach(function(folder){
                closeFolder(folder);
            });
        })
        let collapseIcon = document.createElement('i');
        collapseIcon.classList.add('fas','fa-sort-amount-up');
        collapseLink.append(collapseIcon);
        
        
        searchDiv.appendChild(searchIcon);
        searchDiv.appendChild(searchBar);
        
        let header = tab.querySelector('.directory-header')
        if (header == null){
            header = document.createElement('header');
            header.classList.add('directory-header','flexrow');          
        }
        if (game.data.version >= '0.7.3'){
            header.appendChild(searchDiv);
            searchDiv.appendChild(collapseLink);
        }else{
            header.appendChild(searchDiv);
            header.appendChild(collapseLink);
        }
        

      
        
        
        tab.insertAdjacentElement('afterbegin',header);
    }

}
// ==========================
// Creation functions

function createNewFolder(path){
    new CompendiumFolderEditConfig(new CompendiumFolderOld('New Folder','',path)).render(true) 
}

function createFolderFromObject(parent,compendiumFolder, compendiumElements,prefix,isOpen){
    let folder = document.createElement('li')
    folder.classList.add('compendium-entity','compendium-folder')
    let header = document.createElement('header')
    header.classList.add('compendium-folder-header', 'flexrow')
    header.style.backgroundColor = compendiumFolder.colorText;
    if (compendiumFolder.fontColorText == null){
        header.style.color = '#FFFFFF';
    }else{
        header.style.color = compendiumFolder.fontColorText;
    }
    
    let cogLabel = document.createElement('label');
    let cogIcon = document.createElement('i')
    let cogLink = document.createElement('a')

    cogLabel.setAttribute('title',game.i18n.localize('FOLDER.Edit'));
    cogIcon.classList.add('fas','fa-cog','fa-fw')
    cogLink.classList.add('edit-folder')
    cogLabel.appendChild(cogIcon);
    cogLink.appendChild(cogLabel)

    let newFolderLabel = document.createElement('label');
    let newFolderIcon = document.createElement('i');
    let newFolderLink = document.createElement('a');
    
    newFolderLabel.setAttribute('title',game.i18n.localize('CF.createSubfolder'));
    newFolderIcon.classList.add('fas','fa-folder-plus','fa-fw');
    newFolderLink.classList.add('create-folder');

    newFolderLabel.appendChild(newFolderIcon);
    newFolderLink.appendChild(newFolderLabel);

    let moveFolderLabel = document.createElement('label');
    let moveFolderIcon = document.createElement('i');
    let moveFolderLink = document.createElement('a');

    moveFolderLabel.setAttribute('title',game.i18n.localize('CF.moveFolder'));
    moveFolderIcon.classList.add('fas','fa-sitemap','fa-fw');
    moveFolderLink.classList.add('move-folder');

    moveFolderLabel.appendChild(moveFolderIcon);
    moveFolderLink.appendChild(moveFolderLabel);

    let packList = document.createElement('ol');
    packList.classList.add('compendium-list');
    for (let compendium of compendiumElements){
        packList.appendChild(compendium);
    }
    let folderList = document.createElement('ol');
    folderList.classList.add('folder-list');
    let contents = document.createElement('div');
    contents.classList.add('folder-contents');
    contents.appendChild(folderList);
    contents.appendChild(packList);
    let folderIconHTML = "";
    let folderIcon = null;
    if (compendiumFolder.folderIcon == null){
        folderIcon = document.createElement('i')
        folderIcon.classList.add('fas','fa-fw')
        if (!isOpen){
            folderIcon.classList.add('fa-folder');
        }else{
            folderIcon.classList.add('fa-folder-open')
        }
        folderIconHTML=folderIcon.outerHTML
    }else{
        let folderCustomIcon = document.createElement('img');
        folderCustomIcon.src = compendiumFolder.folderIcon;
        folderIconHTML = folderCustomIcon.outerHTML;
    }
    if (!isOpen || compendiumFolder._id==='default'){
        contents.style.display='none';
        //packList.style.display='none';
        //folderList.style.display='none';
        cogLink.style.display='none';
        newFolderLink.style.display='none';
        moveFolderLink.style.display='none';
        folder.setAttribute('collapsed','');
    }
    let title = document.createElement('h3')
    title.innerHTML = folderIconHTML+compendiumFolder.titleText;

   
    
    header.appendChild(title);
    //if (compendiumFolder._id != 'default'){
    header.appendChild(moveFolderLink);
    header.appendChild(newFolderLink);
    //}
    header.appendChild(cogLink);
    folder.appendChild(header);
    // folder.appendChild(folderList);
    // folder.appendChild(packList);
    folder.appendChild(contents);

    folder.setAttribute('data-cfolder-id',compendiumFolder._id);
    if (compendiumFolder._id==='default'){
        return folder;
    }else{
        parent.appendChild(folder)
        return null;
    }
}


function createHiddenFolder(prefix,hiddenFolder,remainingElements){
    let tab = document.querySelector(prefix+'.sidebar-tab[data-tab=compendium]')
    if (document.querySelector('.hidden-compendiums')==null){
        let folder = document.createElement('ol')
        folder.classList.add('hidden-compendiums');
        folder.style.display='none';
        tab.querySelector(prefix+'ol.directory-list').appendChild(folder);   
        Object.keys(remainingElements).forEach(function(key){
            if (hiddenFolder.compendiumList != null
                && hiddenFolder.compendiumList.length>0
                && hiddenFolder.compendiumList.includes(key)){
                folder.appendChild(remainingElements[key]);
                delete remainingElements[key];
                console.log(modName+" | Adding "+key+" to hidden folder")
            }
        });
    }
}
function insertDefaultFolder(prefix,defaultFolder,folderObject){
    let allFolders = game.settings.get(mod,'cfolders');
    let allElements = document.querySelectorAll(prefix+'.sidebar-tab[data-tab=compendium] > ol > li.compendium-folder')
    for (let folder of allElements){
        let folderId = folder.getAttribute('data-cfolder-id');
        if (allFolders[folderId].titleText > defaultFolder.titleText){
            folder.insertAdjacentElement('beforebegin',folderObject);
            return;
        }
    }
    allElements[allElements.length - 1].insertAdjacentElement('afterend',folderObject);
}
function createDefaultFolder(prefix,defaultFolder,hiddenFolder,remainingElements){
    let tab = document.querySelector(prefix+'.sidebar-tab[data-tab=compendium] > ol.directory-list')
    if (document.querySelector('.compendium-folder[data-cfolder-id=default]')==null){
        let remainingElementsList = []
        Object.keys(remainingElements).forEach(function(key){
            remainingElementsList.push(remainingElements[key]);
            console.log(modName+" | Adding "+key+" to default folder")              
        });
        if (remainingElementsList.length>0){
            let folderObject = createFolderFromObject(tab,defaultFolder,remainingElementsList,prefix,false);
            insertDefaultFolder(prefix,defaultFolder,folderObject);
        }
    }
}

/*
* Main setup function for Compendium Folders
* Takes a prefix (a selector to determine whether to modify the Sidebar or Popup window)
* and a list of previously open folders
*/
function setupFolders(prefix){

    let allFolders = checkForDeletedCompendiums();
    let openFolders = game.settings.get(mod,'open-folders');
    let allCompendiumElements = document.querySelectorAll(prefix+'li.compendium-pack');

    console.debug(modName+" | Elements on screen: "+allCompendiumElements.length);
    console.debug(modName+" | Total Compendiums: "+game.packs.entries.length);
    
    //Remove all current submenus
    for (let submenu of document.querySelectorAll(prefix+'li.compendium-entity')){
        submenu.remove();
    }
    //Remove hidden compendium (so we can add new stuff to it later if from refresh)
    if (document.querySelector('.hidden-compendiums')!=null){
        document.querySelector('.hidden-compendiums').remove();
    }
    if (document.querySelector('.compendium-folder[data-cfolder-id=default]')!=null){
        document.querySelector('.compendium-folder[data-cfolder-id=default]').remove();
    }

    let allCompendiumElementsDict = {}
    // Convert existing compendiums into dict of format { packName : packElement }
    // e.g { dnd5e.monsters : <li class ..... > }
    for (let compendiumElement of allCompendiumElements){
        allCompendiumElementsDict[compendiumElement.getAttribute('data-pack')]=compendiumElement;
    }

    // For nesting folders, group by depth first.
    // let depth = folder.pathToFolder.length
    // Grouped folders are format {depth:[folders]}
    let groupedFolders = {}
    let parentFolders = [];
    Object.keys(allFolders).forEach(function(key) {
        if (key != 'hidden' && key != 'default'){
            let depth = 0;
            if (allFolders[key].pathToFolder == null){
                depth = 0;
            }else{
                depth = allFolders[key].pathToFolder.length
                // Add all parent folders to list
                // Need to make sure to render them
                for (let segment of allFolders[key].pathToFolder){
                    if (!parentFolders.includes(segment)){
                        parentFolders.push(segment);
                    }
                }
            }
            if (groupedFolders[depth] == null){
                groupedFolders[depth] = [allFolders[key]];
            }else{
                groupedFolders[depth].push(allFolders[key]);
            }
        }
      });
    Object.keys(groupedFolders).sort(function(o1,o2){
        if (parseInt(o1)<parseInt(o2)){
            return -1;
        }else if (parseInt(o1>parseInt(o2))){
            return 1;
        }return 0;
    }).forEach(function(depth){
        // Now loop through folder compendiums, get them from dict, add to local list, then pass to createFolder
        for (let groupedFolder of alphaSortFolders(groupedFolders[depth],'titleText')){
            let folder = new CompendiumFolderOld('','');
            folder.initFromExisting(groupedFolder);
            folder.uid=groupedFolder._id;

            let compendiumElements = [];
            if (folder.compendiumList.length>0){
                for (let compendiumKey of folder.compendiumList.sort()){
                    // Check if compendium exists in DOM
                    // If it doesnt, ignore
                    let comp = allCompendiumElementsDict[compendiumKey]
                    if (comp != null){
                        compendiumElements.push(comp);
                        delete allCompendiumElementsDict[compendiumKey];
                    }
                }
            }
            if (game.user.isGM || (!game.user.isGM && (compendiumElements.length>0 || parentFolders.includes(folder._id)))){
                let tab = document.querySelector(prefix+'.sidebar-tab[data-tab=compendium]')
                let rootFolder = tab.querySelector(prefix+'ol.directory-list')
                if (depth > 0){
                    rootFolder = tab.querySelector("li.compendium-folder[data-cfolder-id='"+folder.pathToFolder[depth-1]+"'] > .folder-contents > ol.folder-list")
                }
                createFolderFromObject(rootFolder,folder,compendiumElements,prefix, (openFolders.includes(folder._id)));
            }
        }
        
    });
    // Create hidden compendium folder
    if (allFolders['hidden']!=null 
        && allFolders['hidden'].compendiumList != null 
        && allFolders['hidden'].compendiumList.length>0){
        createHiddenFolder(prefix,allFolders['hidden'],allCompendiumElementsDict);
    }

    // Create default folder
    // Add any remaining compendiums to this folder (newly added compendiums)
    // (prevents adding a compendium from breaking everything)
    if (Object.keys(allCompendiumElementsDict).length>0){
        createDefaultFolder(prefix,allFolders['default'],allFolders['hidden'],allCompendiumElementsDict)
    }

    // create folder button
    if (game.user.isGM && document.querySelector(prefix+'button.cfolder-create')==null){
        let button = document.createElement('button');
        button.classList.add('cfolder-create')
        button.type='submit';
        button.addEventListener('click',function(){createNewFolder([])});
        let folderIcon = document.createElement('i')
        folderIcon.classList.add('fas','fa-fw','fa-folder')
        button.innerHTML = folderIcon.outerHTML+game.i18n.localize("FOLDER.Create");
        if (game.system.id == "pf1"){
            //For pf1, always place next to create compendium button at the bottom
            let flexdiv = document.createElement('div');
            flexdiv.classList.add('flexrow');
            document.querySelector(prefix+'#compendium .directory-footer').insertAdjacentElement('afterbegin',flexdiv);
            flexdiv.appendChild(document.querySelector('button.create-compendium'));
            flexdiv.appendChild(button);
        } else if (game.data.version >= '0.7.3'){
            document.querySelector(prefix+'#compendium .header-actions.action-buttons').appendChild(button);
        }else{
            document.querySelector(prefix+'#compendium .directory-footer').appendChild(button);
        }
    }
    // Hide all empty lists
    for (let element of document.querySelectorAll('.folder-contents > ol')){
        if (element.innerHTML.length===0){
            element.style.display="none";
        }
    }

    createDirectoryHeader();
    
}
// Delete functions
function deleteFolder(folder,allFolders){
    let hiddenFolder = allFolders['hidden']
    for (let compendium of folder.compendiumList){
        hiddenFolder.compendiumList.push(compendium);
    }
    Object.keys(allFolders).forEach(function(key){
        if (key != folder._id && key != 'hidden'){
            if (allFolders[key] != null // has not been deleted already
                && allFolders[key].pathToFolder != null
                && allFolders[key].pathToFolder.includes(folder._id)){
                //Delete folders that are children of this folder
                deleteFolder(allFolders[key],allFolders)
                
            }
        }
    });
    delete allFolders[folder._id];
}
async function deleteAllChildFolders(folder){
    let allFolders = Settings.getFolders();
    
    deleteFolder(folder,allFolders)
    await game.settings.set(mod,'cfolders',allFolders);
    ui.notifications.notify(game.i18n.localize('CF.deleteNotification').replace('{folderName}',folder.titleText));
    refreshFolders()
    
}
async function deleteFolderWithinCompendium(packCode,folderElement,deleteAll){
    ui.notifications.notify(game.i18n.localize('CF.deleteFolderNotificationStart'))
    
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
        await pack.deleteEntity(tempEntity.id);
    }
    await pack.deleteEntity({id:tempEntity.id})
    ui.notifications.notify(game.i18n.localize('CF.deleteFolderNotificationFinish'));
    document.querySelector('.compendium-pack[data-pack=\''+packCode+'\']').click();
    pack.render(true);
}
async function updateFolderWithinCompendium(folderObj){
    ui.notifications.notify(game.i18n.localize('CF.updateFolderNotificationStart'))
    let packCode = folderObj.packCode;
    let pack = game.packs.get(packCode);
    let newFolderName = folderObj.newName;
    let newColor = folderObj.newColor;
    let entity = await pack.getEntity(folderObj.tempEntityId);

    if (entity != null){

        let data = {
            flags:{
                cf:{
                    name:newFolderName,
                    color:newColor,
                    icon:folderObj.icon
                }
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
async function createNewFolderWithinCompendium(folderObj){
    // Exporting temp entity to allow for empty folders being editable
    let pack = game.packs.get(folderObj.packCode);
    let newPath = []
    if (folderObj.tempEntityId != null){
        let parent = await pack.getEntity(folderObj.tempEntityId)
        newPath = parent.data.flags.cf.folderPath
    }
    newPath.push(folderObj.parentId);
    let tempData = getTempEntityData(pack.entity);
    tempData.flags.cf={
        id:folderObj.id,
        folderPath:newPath,
        color:folderObj.color,
        name:folderObj.name,
        children:[],
        icon:folderObj.icon
    }
    let e = await pack.createEntity(tempData);
    console.log(`Created temp entity for folder in ${pack.collection}`);
    return newPath
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
                        game.customFolders = null;
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
async function moveFolder(srcFolderId,destFolderId,showNotification=false){
    let allFolders = game.settings.get(mod,'cfolders');

    let success = false;
    if (destFolderId != null && destFolderId.length>0){
        let notificationDest = ""
        let srcFolderName = ""
        if (destFolderId=='root'){
            allFolders[srcFolderId]['pathToFolder'] = []
            success = CompendiumFolderMoveDialog.updateFullPathForChildren(allFolders,srcFolderId,[])
            notificationDest="Root";
        }else{
            let destParentPath = (allFolders[destFolderId]['pathToFolder']==null)?[]:allFolders[destFolderId]['pathToFolder']
            let fullPath = destParentPath.concat([destFolderId]);
            allFolders[srcFolderId]['pathToFolder'] = fullPath;
            success = CompendiumFolderMoveDialog.updateFullPathForChildren(allFolders,srcFolderId,fullPath)
            notificationDest = allFolders[destFolderId].titleText;
            srcFolderName = allFolders[srcFolderId].titleText;
        }
        if (success==true){
            if (showNotification){
                ui.notifications.info(game.i18n.localize('CF.moveFolderNotification').replace('{src}',srcFolderName).replace('{dest}',notificationDest))
            }
            await game.settings.set(mod,'cfolders',allFolders);
            refreshFolders();
        }else{
            ui.notifications.error(game.i18n.localize('CF.folderDepthError')+" ("+FOLDER_LIMIT+")")
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
        return "Move Folder: "+this.object.name;
    }
    async getData(options) { 
        let formData = []
        /*
        let allFolders = game.settings.get(mod,'cfolders');

        Object.keys(allFolders).forEach(function(key){
            if (key != 'hidden' && key != 'default'){
                let prettyTitle = ""
                let prettyPath = []
                if (allFolders[key].pathToFolder != null){
                    for (let folder of allFolders[key].pathToFolder){
                        prettyPath.push(allFolders[folder].titleText);
                        prettyTitle = prettyTitle+allFolders[folder].titleText+"/";
                    }
                }
                prettyTitle=prettyTitle+allFolders[key].titleText
                formData.push({
                    'titleText':allFolders[key].titleText,
                    'titlePath':prettyPath,
                    'fullPathTitle':prettyTitle,
                    'id':key
                })
            }
        });
        */
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
            // let fullFirst = "";
            // let fullSecond = "";
            // for(let firstPath of first['titlePath']){
            //     fullFirst = fullFirst+firstPath+'/'
            // }
            // for (let secondPath of second['titlePath']){
            //     fullSecond = fullSecond+secondPath+'/'
            // }
            // fullFirst = fullFirst+first['titleText'];
            // fullSecond = fullSecond+second['titleText'];
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
        // let temp = Array.from(formData);
        // for (let obj of temp){
        //     if (obj.id!='root' &&(
        //         // If formData contains folders which are direct parents of this.object
        //         (this.object.pathToFolder != null
        //         && this.object.pathToFolder.length>0
        //         && obj.id === this.object.pathToFolder[this.object.pathToFolder.length-1])
        //         // or If formData contains folders where this.object is directly on the path
        //         || (allFolders[obj.id].pathToFolder != null
        //             && allFolders[obj.id].pathToFolder.includes(this.object._id))
        //         // or If formData contains this.object
        //         || obj.id === this.object._id))
        //         formData.splice(formData.indexOf(obj),1);
        //     }

        return {
            folder: this.object,
            allFolders: formData,
            submitText: game.i18n.localize("CF.moveFolder")
        }
    }
    static updateFullPathForChildren(allFolders,parentFolderId,fullPath){
        let success = true;
        Object.keys(allFolders).forEach(function(key){
            if (allFolders[key].pathToFolder != null
                && allFolders[key].pathToFolder.includes(parentFolderId)
                && key != parentFolderId){

                let temp = allFolders[key].pathToFolder.slice(allFolders[key].pathToFolder.indexOf(parentFolderId),allFolders[key].pathToFolder.length)
                //fullPath.push(parentFolderId);
                allFolders[key].pathToFolder = (fullPath).concat(temp);
                if(allFolders[key].pathToFolder.length+1 >= FOLDER_LIMIT){
                    success = false;
                }

            }
        });
        return success;
    }
    async _updateObject(event, formData) {
        let destFolderId = null;
        document.querySelectorAll('#folder-move input[type=\'radio\']').forEach(function(e){
            if (e.checked){
                destFolderId=e.value;
                return;} 
        });
        this.object.moveFolder(destFolderId);
        //moveFolder(this.object._id,destFolderId,true);
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
            if (key != 'hidden'){
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
            await this.object.removeCompendium(packKey,false,false);
        }
        if (this.object.data.parent){
            await this.object.moveFolder(this.object.data.parent._id);
        }
        await this.object.save();

        return

        // // Update compendium assignment
        // let packsToAdd = []
        // let packsToRemove = []
        // for (let packKey of game.packs.keys()){
        //     let formName = game.packs.get(packKey).metadata.package+game.packs.get(packKey).metadata.name;
        //     if (formData[formName] && !this.object.compendiumList.includes(packKey)){
        //         // Box ticked AND compendium not in folder
        //         packsToAdd.push(packKey);
            
        //     }else if (!formData[formName] && this.object.compendiumList.includes(packKey)){
        //         // Box unticked AND compendium in folder
        //         packsToRemove.push(packKey);
        //     }
        // }
        // if (formData.delete != null && formData.delete[0]==1){
        //     //do delete stuff
        //     new Dialog({
        //         title: game.i18n.localize("CF.deleteFolder"),
        //         content: "<p>"+game.i18n.localize("CF.deletePromptL1").replace('{folderName}',this.object.titleText)+"</p>"
        //                 +"<p>"+game.i18n.localize("CF.deletePromptL2")+"</p>"
        //                 +"<p><i>"+game.i18n.localize("CF.deletePromptL3")+"</i></p>",
        //         buttons: {
        //             yes: {
        //                 icon: '<i class="fas fa-check"></i>',
        //                 label: "Yes",
        //                 callback: () => deleteAllChildFolders(this.object)
        //             },
        //             no: {
        //                 icon: '<i class="fas fa-times"></i>',
        //                 label: "No"
        //             }
        //         }
        //     }).render(true);
        
        // }else{
        //     await updateFolders(packsToAdd,packsToRemove,this.object);
        // }
        
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

        return options;
    }
  
    get title() {
        return `${game.i18n.localize("FOLDER.Update")}: ${this.object.name}`;
    }
    async getData(options){
        return {
            name:this.object.name,
            color:this.object.color,
            id:this.object.id,
            icon:this.object.icon
        };
    }
    async _updateObject(options,formData){
        let folderObj = {
            id:this.object.id,
            oldName:this.object.name,
            newName:formData.name,
            newColor:formData.color,
            path:this.object.path,
            packCode:this.object.packCode,
            tempEntityId:this.object.tempEntityId,
            icon:formData.icon
        }
        await updateFolderInCache(folderObj.packCode,folderObj); 
        await updateFolderWithinCompendium(folderObj);      
        //resetCache(); 
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
            id:this.object.id
        };
    }
    async _updateObject(options,formData){
        let folderObj = {
            id:this.object.id,
            name:formData.name,
            color:formData.color,
            packCode:this.object.packCode,
            parentId:this.object.parentId,
            tempEntityId:this.object.tempEntityId,
            icon:formData.icon
        }
        let newPath = await createNewFolderWithinCompendium(folderObj); 
        //folderObj.path = newPath
        //await createFolderInCache(folderObj.packCode,folderObj);   
        resetCache();    
    }
}
function refreshFolders(){  
    if (document.querySelector('section#compendium') != null){
        setupFolders('#sidebar ');
        addEventListeners('#sidebar ');
    }
}
//TODO Fix why multiple packs being added to folder only shows 1
async function updateFolders(packsToAdd,packsToRemove,folder){
    let folderId = folder._id;
    // First find where compendium currently is (what folder it belongs to)
    // Then move the compendium and update
    let allFolders = Settings.getFolders();
    if (allFolders[folderId] == null){
        allFolders[folderId]=folder;
    }
    let packsMoved=[]
    for (let packKey of packsToAdd){
        Object.keys(allFolders).forEach(function(fId){
            if (allFolders[fId].compendiumList.indexOf(packKey)>-1){
                allFolders[fId].compendiumList.splice(allFolders[fId].compendiumList.indexOf(packKey),1);
                console.log(modName+' | Removing '+packKey+' from folder '+allFolders[fId].titleText);
                if (fId != 'hidden'){
                    packsMoved.push(packKey);
                }
            }
        });
        
        allFolders[folderId].compendiumList.push(packKey);
        console.log(modName+' | Adding '+packKey+' to folder '+folder.titleText);
    }
    if (packsMoved.length>0){
        let notification = game.i18n.localize("CF.addSinglePackNotification")
        if (packsMoved.length>1){
            notification = game.i18n.localize("CF.addMultiPackNotification").replace('{packNum}',packsMoved.length);
        }
        ui.notifications.notify(notification)
    }
    // For removing packs, add them to hidden compendium
    if (packsToRemove.length>0){
        let notification = game.i18n.localize("CF.removeSinglePackNotification")
        if (packsToRemove.length>1){
            notification = game.i18n.localize("CF.removeMultiPackNotification").replace('{packNum}',packsToRemove.length);
        }
        ui.notifications.notify(notification);
    }
    for (let packKey of packsToRemove){
        allFolders[folderId].compendiumList.splice(allFolders[folderId].compendiumList.indexOf(packKey),1);
        allFolders['hidden'].compendiumList.push(packKey);
        console.log(modName+' | Adding '+packKey+' to folder '+allFolders['hidden'].titleText);
    }
    allFolders[folderId].titleText = folder.titleText;
    allFolders[folderId].colorText = folder.colorText;
    allFolders[folderId].fontColorText = folder.fontColorText;
    allFolders[folderId].folderIcon = folder.folderIcon;

    await game.settings.set(mod,'cfolders',allFolders);
    refreshFolders()
}
// ==========================
// Event funtions
// ==========================
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

async function toggleFolder(event,parent){
    event.stopPropagation();
    if (parent.hasAttribute('collapsed')){
        await openFolder(parent,true);
    }else{
        await closeFolder(parent,true);
        for (let child of parent.querySelectorAll('.compendium-folder')){
            await closeFolder(child,true);
        }
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
function showEditDialog(submenu,event){
    event.stopPropagation();
    let allFolders = game.settings.get(mod,'cfolders')
    let folderId = submenu.getAttribute('data-cfolder-id')
    new CompendiumFolderEditConfig(allFolders[folderId]).showDialog();   
}
function showCreateDialogWithPath(submenu,event){
    event.stopPropagation();
    let directParent = submenu.getAttribute('data-cfolder-id');
    let allFolders = game.settings.get(mod,'cfolders');
    let currentDepth = allFolders[directParent].pathToFolder==null?1:allFolders[directParent].pathToFolder.length
    if (currentDepth + 1 >= FOLDER_LIMIT){
        ui.notifications.error(game.i18n.localize("CF.folderDepthError") + " ("+FOLDER_LIMIT+")")
        return
    }
    let path = []
    path.push(directParent);
    let currentElement = submenu;
    while (!currentElement.parentElement.classList.contains('directory-list')){
        currentElement = currentElement.parentElement.parentElement.parentElement;
        path.push(currentElement.getAttribute('data-cfolder-id'));
    }
    path.reverse();
   
    let newFolder = new CompendiumFolderOld('New Folder','',path);
    new CompendiumFolderEditConfig(newFolder).render(true);
}
function showMoveDialog(folder,event){
    let folderId = folder.getAttribute('data-cfolder-id');
    let folderRawObject = game.settings.get(mod,'cfolders')[folderId];
    let folderObject = new CompendiumFolderOld('','');
    folderObject.initFromExisting(folderRawObject);
    event.stopPropagation();
    new CompendiumFolderMoveDialog(folderObject).render(true);
}
function addEventListeners(prefix){
    for (let submenu of document.querySelectorAll(prefix+'li.compendium-folder')){
        submenu.addEventListener('click',function(event){ toggleFolder(event,submenu) },false)
        submenu.querySelector('a.edit-folder').addEventListener('click',function(event){showEditDialog(submenu,event)},false)
        submenu.querySelector('a.create-folder').addEventListener('click',function(event){showCreateDialogWithPath(submenu,event)},false);
        submenu.querySelector('a.move-folder').addEventListener('click',function(event){showMoveDialog(submenu,event)},false);
        for (let pack of submenu.querySelectorAll('li.compendium-pack')){
            pack.addEventListener('click',function(ev){ev.stopPropagation()},false)
        }
        eventsSetup.push(prefix+submenu.getAttribute('data-cfolder-id'))
        
    }
    setupDragEventListeners();
}
function setupDragEventListeners(){
    if (game.user.isGM){
        let window = document.querySelector('section#compendium')
        let hiddenMoveField = document.createElement('input');
        hiddenMoveField.type='hidden'
        hiddenMoveField.style.display='none';
        hiddenMoveField.classList.add('pack-to-move');
        window.querySelector('ol.directory-list').appendChild(hiddenMoveField);
        
        for (let entity of window.querySelectorAll('.compendium-pack')){
            entity.setAttribute('draggable','true')
            entity.addEventListener('dragstart',async function(){
                let currentPack = this.getAttribute('data-pack');
                this.closest('ol.directory-list').querySelector('input.pack-to-move').value = currentPack
            })
        }
        for (let folder of window.querySelectorAll('.compendium-folder')){
            folder.addEventListener('drop',async function(event){
                event.stopPropagation();
                let movingId = this.closest('ol.directory-list').querySelector('input.pack-to-move').value;
                let folderId = this.getAttribute('data-cfolder-id');
                if (movingId.length>0){
                    this.closest('ol.directory-list').querySelector('input.pack-to-move').value = ''
                    let allSettings = game.settings.get(mod,'cfolders');
                    if (!allSettings[folderId].compendiumList.includes(movingId) && folderId!='default'){
                        for (let key of Object.keys(allSettings)){
                            let currentFolder = allSettings[key];
                            let cList = currentFolder.compendiumList;
                            if (cList.includes(movingId)){
                                allSettings[key].compendiumList = cList.filter(c => c != movingId);
                            }
                        }
                        allSettings[folderId].compendiumList.push(movingId);
                        await game.settings.set(mod,'cfolders',allSettings)
                        refreshFolders();
                    }
                }
            });
        }
    }
}
// ==========================
// Exporting Folders to compendiums
// ==========================
function addExportButton(folder,isMacroFolder){
    let newButton = document.createElement('i');
    newButton.classList.add('fas','fa-upload');
    let link = document.createElement('a');
    link.setAttribute('title',"Export Folder Structure")
    if (isMacroFolder){
        link.setAttribute('data-folder',folder.parentElement.getAttribute('data-mfolder-id'));
    }else{
        link.setAttribute('data-folder',folder.parentElement.getAttribute('data-folder-id'));
    }
    link.classList.add('export-folder');
    link.appendChild(newButton);
    if (isMacroFolder){
        link.style.flex='0';
        link.addEventListener('click',async function(event){
            event.stopPropagation();
            let folder = await constructFolderDataFromMacroFolder(this.getAttribute('data-folder'),game.settings.get('macro-folders','mfolders'))
            await exportFolderStructureToCompendium(folder);
        });
    }else{
        link.addEventListener('click',async function(event){
            event.stopPropagation();
            let folder = game.folders.get(this.getAttribute('data-folder'));
            await exportFolderStructureToCompendium(folder);
        });
    }
    folder.insertAdjacentElement('beforeend',link);
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
        merge: true
    });

    // Display it as a dialog prompt
    return Dialog.prompt({
        title: game.i18n.localize("FOLDER.ExportTitle") + `: ${folder.data.name}`,
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
                color:parents[i].data.color,
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
        console.log(`Exported ${e.name} to ${pack.collection}`);
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
    }
    console.log(`Exported temp entity to ${pack.collection}`);
    
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
            case 'Scene':search = game.scenes.entities.filter(s => s.name === source.name && getFolderPath(s.folder)===folderPath)
                        break;
            case 'RollTable':search = game.tables.entities.filter(r => r.name === source.name && getFolderPath(r.folder)===folderPath)
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
            <div class='form-group'><label for='merge'>Merge by name</label><input type='checkbox' name='merge' checked/></div></form>`,
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
        if (game.user.isGM && !game.packs.get(packCode).locked){
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
        let importButton = document.createElement('a');
        importButton.innerHTML = "<i class='fas fa-upload fa-fw'></i>"
        importButton.classList.add('import-folder');
        importButton.setAttribute('title',game.i18n.localize("CF.importFolderHint"))
        importButton.addEventListener('click',event => importFolderFromCompendium(event,folder));

        header.appendChild(importButton);
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
    if (e.data.flags.cf != null && e.data.flags.cf.import != null){
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
async function createMacroFolderPath(path,pColor,e){
    let allMacroFolders = game.settings.get('macro-folders','mfolders')  
    let lastId = null;
    let segments = path.split(FOLDER_SEPARATOR);
    let index = 0;
    for (let seg of segments){
        let folderPath = segments.slice(0,index).join(FOLDER_SEPARATOR)+FOLDER_SEPARATOR+seg
        if (index==0){
            folderPath = seg
        }
        let results = Object.values(allMacroFolders).filter(f => f.pathToFolder != null 
            && f.pathToFolder.map(m => allMacroFolders[m].titleText).join(FOLDER_SEPARATOR)+(index>0?FOLDER_SEPARATOR:"")+f.titleText === folderPath)
        if (results.length==0 ){
            //create folder
            let newFolder = {
                _id:generateRandomFolderName('mfolder'),
                titleText:seg,
                macroList:[],
                pathToFolder:[]
            }
            if (index == segments.length-1){
                newFolder.colorText = pColor;
                newFolder.macroList.push(e._id)
            }
            if (lastId != null){
                newFolder.pathToFolder = Array.from(allMacroFolders[lastId].pathToFolder)
                newFolder.pathToFolder.push(lastId);
            }
            allMacroFolders[newFolder._id]=newFolder
            lastId = newFolder._id;
        }else{
            //Folder exists, add entity to thing
            lastId = results[0]._id
            if (index == segments.length-1){
                allMacroFolders[lastId].macroList.push(e._id)
            }
        }
        index++;
    }
    for (let key of Object.keys(allMacroFolders)){
        if (key != lastId){
            allMacroFolders[key].macroList.filter(m => m != e._id)
        }
    }
    await game.settings.set('macro-folders','mfolders',allMacroFolders)
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
    cache.groupedFolders[folderMetadata.depth][index].color = folderObj.newColor
    cache.groupedFolders[folderMetadata.depth][index].name = folderObj.newName
    cache.groupedFolders[folderMetadata.depth][index].icon = folderObj.icon
    cache.groupedFolders[folderMetadata.depth] = alphaSortFolders(cache.groupedFolders[folderMetadata.depth],'name')
    cache.groupedFolderMetadata[folderObj.id].index = cache.groupedFolders[folderMetadata.depth].findIndex(f => f.id === folderObj.id)
    console.debug(modName+' | Updating folder in cache')
   
    await game.settings.set(mod,'cached-folder',cache);
    console.log(modName+' | Updated cached folder structure');
}
async function resetCache(){
    await game.settings.set(mod,'cached-folder',{});
    console.log(modName+' | Cleared cached folder structure');
}
//==========================
// Folder path conversions
//==========================
function consolidateTempEntities(entity,content){
    let children = content.find(e => e.name != TEMP_ENTITY_NAME 
        && e.data.flags != null
        && e.data.flags.cf != null 
        && e.data.flags.cf.path != null 
        && e.data.flags.cf.path === entity.data.flags.cf.path)
    let excludeFolderId = entity.data.flags.cf.id
    if (children != null) { 
        // Children are using a temp entity as parent. Exclude this folderId instead
        excludeFolderId = children.data.flags.cf.id
    }
    let duplicateTempEntities = content.filter(e => e.name === TEMP_ENTITY_NAME 
        && e.data.flags.cf.path != null
        && e.data.flags.cf.path === entity.data.flags.cf.path 
        && e.data.flags.cf.id != excludeFolderId);
    let parentTempEntity = content.find(e => e.name === TEMP_ENTITY_NAME 
        && e.data.flags.cf.path  != null
        && e.data.flags.cf.path === entity.data.flags.cf.path 
        && e.data.flags.cf.id === excludeFolderId)

    if (parentTempEntity != null && duplicateTempEntities.length > 0){
        console.debug(modName+' | Found multiple temp entities at '+entity.data.flags.cf.name+' with existing parent, Deleting others')
        let toDelete = []
        for (let tempEntity of duplicateTempEntities){
            toDelete.push(tempEntity.id)
        }
        return toDelete
    }else if (parentTempEntity === null && duplicateTempEntities.length > 1){
        console.debug(modName+' | Found multiple temp entities at '+entity.data.flags.cf.name+' without existing parent, Using one duplicate and deleting others')
        let newParentTempEntity = duplicateTempEntities.pop()
        for (let tempEntity of duplicateTempEntities){
            toDelete.push(tempEntity.id)
        }
        return toDelete
    }
    
    return []
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
function updateFolderChildrenForTempEntity(entity,content){
    let children = content.filter(e => e.data.flags != null
        && e.data.flags.cf != null
        && e.data.flags.cf.path === entity.data.flags.cf.path);
    let childrenIds = children.map(e => e.id)
    let updateData = {
        flags:{
            cf:{
                children:childrenIds
            }
        },
        _id:entity.id
    }
    return updateData
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
            scope:'client',
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
        game.customFolders = {
            compendium:{
                folders:new CompendiumFolderCollection([]),
                entries:new CompendiumEntryCollection([])
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
    // static async doFolderConversions(){
    //     if (game.user.isGM){
    //         console.log(modName + ' | Checking for old compendium folder formats...')
    //         let convertedPacks = game.settings.get(mod,'converted-packs')
    //         for (let packCode of game.packs.keys()){
    //             try{
    //                 let pack = game.packs.get(packCode);
                    
    //                 if (convertedPacks.includes(packCode)){
    //                     console.debug(modName + ' | Compendium '+packCode+' already converted, skipping')
    //                     continue;
    //                 }
    //                 if (!pack.locked){
    //                     convertedPacks.push(packCode);
    //                     let allFolderData = {}
    //                     let content = await pack.getContent()
    //                     let folderEntities = content.filter(x => x.data.flags != null && x.data.flags.cf != null);
    //                     if (folderEntities.length === 0){
    //                         continue;
    //                     }
    //                     for (let entry of folderEntities){
    //                         let path = entry.data.flags.cf.path;
    //                         let name = path.split('/')[path.split('/').length-1]
    //                         let color = entry.data.flags.cf.color;
    //                         let folderId = entry.data.flags.cf.id;
    //                         let entryId = entry._id
    //                         if (allFolderData[path] == null){
    //                             allFolderData[path] = {id:folderId,color:color, children:[entryId],name:name}
    //                         }else{
    //                             allFolderData[path].children.push(entryId);
    //                         }
    //                     }
    //                     let finishedPaths = [];
    //                     for (let path of Object.keys(allFolderData).sort()){
    //                         let segments = path.split('/');
    //                         for (let seg of segments){
    //                             let index = segments.indexOf(seg)
    //                             let currentPath = seg
    //                             if (index>0){
    //                                 currentPath = segments.slice(0,index).join('/')+'/'+seg;
    //                             }
    //                             let tempEntity = content.find(x => x.data.flags != null && x.data.flags.cf != null && x.data.flags.cf.path === currentPath && x.name === TEMP_ENTITY_NAME)
    //                             let entities = content.find(x => x.data.flags != null && x.data.flags.cf != null && x.data.flags.cf.path === currentPath)
    //                             if (tempEntity == null && !finishedPaths.includes(currentPath)){
                                    
    //                                 let tempData = getTempEntityData(pack.entity);
    //                                 let folderId = generateRandomFolderName('temp_');
    //                                 let folderColor = '#000000'
    //                                 let folderName = seg;
    //                                 if (entities != null && entities.data.flags.cf.id != null){
    //                                     folderId = entities.data.flags.cf.id;
    //                                     folderColor = entities.data.flags.cf.color;
    //                                 }
    //                                 tempData.flags.cf={
    //                                     id:folderId,
    //                                     path:currentPath,
    //                                     color:folderColor,
    //                                     name:folderName
    //                                 }
    //                                 await pack.createEntity(tempData);
    //                                 console.log(`${modName} | Created temp entity for folder ${folderName} in ${pack.collection}`);
    //                                 finishedPaths.push(currentPath);
    //                             }
    //                         }
    //                     }
    //                 } 
                
    //             }catch (e){
    //                 console.debug(modName + ' | Could not convert pack '+packCode+', skipping')
    //                 continue;
    //             }
    //         }
    //         console.log(modName+' | Check complete!')
            
    //         await game.settings.set(mod,'converted-packs',convertedPacks);
    //     }
    // }
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
    game.customFolders.compendium.folders.default.compendiumList = unassigned.map(y => y.collection);
    game.customFolders.compendium.folders.default.content = unassigned;
    
    // Check for removed compendiums
    let missingCompendiums = false
    let goneCompendiums = game.customFolders.compendium.entries.filter(x => !x.pack);
    for (let c of goneCompendiums){
        c.parent.removeCompendium(c.code,true,false);
        missingCompendiums = true;
    }
    if (missingCompendiums){
        ui.compendium.render(true,'update');
        return;
    }
    
    // Set child folders
    let allEntries = [...CompendiumFolder.collection.values()]
    for (let cf of allEntries){
        let directChildren = allEntries.filter(f => f.data?.pathToFolder?.length > 0 && f.data.pathToFolder[f.data.pathToFolder.length-1] === cf._id)
        cf.children = directChildren;
    }
    
    if (game.user.isGM)
        game.settings.set(mod,'cfolders',allFolders);
    if (refresh){
        ui.compendium.render(true,'update');
    }
}

Hooks.once('setup',async function(){
    // let hooks = ['renderCompendiumFolderDirectory','renderCompendiumDirectoryPF'];
    let post073 = game.data.version >= '0.7.3';
    
    Settings.registerSettings()
    Hooks.once('ready',async function(){
        ui.compendium = new CompendiumFolderDirectory();
        initFolders(true);
    })
    //for (let hook of hooks){
        Hooks.on('renderCompendiumFolderDirectory', () => {
            initFolders();
            return;
            let isPopout = document.querySelector('#compendium-popout') != null;
            let prefix = '#sidebar '
            if (isPopout){
                prefix = '#compendium-popout '
            }
            let allFolders = game.settings.get(mod,'cfolders')
            let toReturn = allFolders['hidden']==null || allFolders['default']==null;
            if (allFolders['hidden']==null){
                allFolders['hidden']={'compendiumList':[],'titleText':'hidden-compendiums','_id':'hidden'};
            }
            if (allFolders['default']==null){
                allFolders['default']={'compendiumList':[],'titleText':'Default','_id':'default','colorText':'#000000'};
            }
            if (toReturn){
                game.settings.set(mod,'cfolders',allFolders).then(function(){
                    if (Object.keys(allFolders).length <= 2 && allFolders.constructor === Object){
                        convertExistingSubmenusToFolder(prefix);
                    }else{
                        //setupFolders(prefix)
                    }
                    //addEventListeners(prefix)
                });
            }else{
                if (Object.keys(allFolders).length <= 2 && allFolders.constructor === Object){
                    convertExistingSubmenusToFolder(prefix);
                }else{
                    //setupFolders(prefix)
                }
                //addEventListeners(prefix)
            }   
        });
    //}
    if (post073){
        Settings.clearSearchTerms()
        // Hooks.on('ready',async function(){
        //     await Settings.doFolderConversions();
        // })
        Hooks.on('renderCompendium',async function(e){
            if (!e.index.some(x => x.name === TEMP_ENTITY_NAME)) return;
            let packCode = e.metadata.package+'.'+e.metadata.name;
            let window = e._element[0]
            removeStaleOpenFolderSettings(packCode);
            let cachedFolderStructure = await loadCachedFolderStructure(packCode);
            let allFolderData={};
            let updateData = [];
            let deleteData = []
            let groupedFoldersSorted = {}
            let groupedFolders = {}
            if (cachedFolderStructure != null){
               groupedFoldersSorted = cachedFolderStructure;
            }else{
                let folderChildren = {}
                let checkedPaths = []
                let allFolderIds = e.index.filter(x => x.name === TEMP_ENTITY_NAME).map(e => e._id)
                //let contents = await e.getContent();
                let contents = [];
                for (let fId of allFolderIds){
                    contents.push(await e.getEntity(fId))
                }
                // let allFolderIds = contents.filter(e => e.data.flags != null 
                //     && e.data.flags.cf != null
                //     && e.data.flags.cf.id != null 
                //     && e.name === TEMP_ENTITY_NAME).map(e => e.data.flags.cf.id)
                //First parse folder data
                for (let entry of contents){
                    if (entry != null 
                        && entry.data.flags.cf != null){
                        //New
                        let folderId = entry.data.flags.cf.id;
                        let entryId = entry._id
                        // if (entry.data.flags.cf.id != null
                        //     && entry.name != TEMP_ENTITY_NAME
                        //     && !allFolderIds.includes(entry.data.flags.cf.id)){
                        //     updateData.push(removeOrUpdateFolderIdForEntity(entry,contents));
                        // }
                        // if (entry.data.flags.cf.folderPath == null
                        //     && entry.name === TEMP_ENTITY_NAME){
                        //     let result = updateFolderPathForTempEntity(entry,contents);
                        //     updateData.push(result);
                        // }
                        // if (entry.data.flags.cf.children == null
                        //     && entry.name === TEMP_ENTITY_NAME){
                        //     updateData.push(updateFolderChildrenForTempEntity(entry,contents));
                        // }
                        // if (entry.data.flags.cf.import != null){
                        //     updateData.push({flags:{cf:{import:null}},_id:entryId})
                        // }
                        // if (entry.data.flags.cf.path != null 
                        //     && !checkedPaths.includes(entry.data.flags.cf.path)){                           
                        //     deleteData.push.apply(deleteData,consolidateTempEntities(entry,contents));
                        //     checkedPaths.push(entry.data.flags.cf.path);
                        // }
                        if (folderId != null){
                            //if (entry.name === TEMP_ENTITY_NAME){
                            let name = entry.data.flags.cf.name
                            let color = entry.data.flags.cf.color;
                            let folderPath = entry.data.flags.cf.folderPath;
                            let folderIcon = entry.data.flags.cf.icon
                            let children = entry.data.flags.cf.children
                            let data = {
                                id:folderId,color:color, children:children,name:name,folderPath:folderPath,tempEntityId:entryId,icon:folderIcon
                            }
                            allFolderData[folderId]=data
                            //}
                            // if (folderChildren[folderId] != null && folderChildren[folderId].children != null){
                            //     folderChildren[folderId].children.push(entryId);
                            // }else{
                            //     folderChildren[folderId] = {children:[entryId]}
                            // }
                            folderChildren[folderId] = children
                        }
                    }
                }
                if (Object.keys(allFolderData).length === 0 && allFolderData.constructor === Object){
                    return;
                }
                // if (deleteData.length>0){
                //     ui.notifications.notify('Updating folder structure. Please wait...')
                //     e.close().then(async () => {
                //         if (game.user.isGM){
                //             for (let d of deleteData){
                //                 await e.deleteEntity(d)
                //             }
                //             resetCache()
                //             ui.notifications.notify('Updating complete!')
                //             e.render(true);
                //         }else{
                //             ui.notifications.warn('Please log in as a GM to convert this compendium to the new format')
                //         }
                //     });
                //     return;
                // }  
                // if (updateData.length>0){
                //     ui.notifications.notify('Updating folder structure. Please wait...')
                //     e.close().then(async () => {
                //         if (game.user.isGM){
                //             for (let d of updateData){
                //                 await e.updateEntity(d);
                //             }
                //             resetCache()
                //             ui.notifications.notify('Updating complete!')
                //             e.render(true);
                //         }else{
                //             ui.notifications.warn('Please log in as a GM to convert this compendium to the new format')
                //         }
                //     });
                //     return;
                // }          
                // for (let key of Object.keys(folderChildren)){
                //     allFolderData[key].children = folderChildren[key].children
                // }
               
            
                
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
            createNewFolderButtonWithinCompendium(window,packCode);
            for (let entity of window.querySelectorAll('.directory-item')){
                if (entity.querySelector('h4').innerText.includes(TEMP_ENTITY_NAME)){
                    entity.style.display = 'none';
                    entity.classList.add('hidden')
                }
            }
            if (game.user.isGM){
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
                            await p.updateEntity(data)
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
        Hooks.on('updateRollTable',async function(r){
            await importFolderData(r);
        })
        Hooks.on('updateScene',async function(s){
            await importFolderData(s);
        })

        // Adding the export button to all folders
        // ONLY if it contains an entity (either direct child or in child folder)
        Hooks.on('renderActorDirectory',async function(a){
            for (let folder of a._element[0].querySelectorAll('.directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null //
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder,false);
                }
            }
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.actors.entities.some(a => a.name === TEMP_ENTITY_NAME)){
                removeTempEntities('Actor')
            }
        })
        Hooks.on('renderJournalDirectory',async function(){
            for (let folder of document.querySelectorAll('#journal .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null//
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder,false);
                }
            }
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.journal.entities.some(j => j.name === TEMP_ENTITY_NAME)){
                removeTempEntities('JournalEntry')
            }
        })
        Hooks.on('renderSceneDirectory',async function(){
            for (let folder of document.querySelectorAll('#scenes .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null//
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder,false);
                } 
            }
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.scenes.entities.some(s => s.name === TEMP_ENTITY_NAME)){
                removeTempEntities('Scene')
            }
        })
        Hooks.on('renderItemDirectory',async function(e){
            for (let folder of document.querySelectorAll('#items .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null//
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder,false);
                } 
            }
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.items.entities.some(i => i.name === TEMP_ENTITY_NAME)){
                removeTempEntities('Item')
            }
        })
        Hooks.on('renderRollTableDirectory',async function(){
            for (let folder of document.querySelectorAll('#tables .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null//
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder,false);
                }  
            }
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.tables.entities.some(r => r.name === TEMP_ENTITY_NAME)){
                removeTempEntities('RollTable')
            }
        })
        Hooks.on('addExportButtonsForCF',async function(window){
            for (let folderHeader of window.querySelectorAll('.macro-folder > .macro-folder-header')){
                if (folderHeader.querySelector('a.export-folder')==null//
                    && folderHeader.parentElement.querySelector(':scope > .folder-contents').querySelector('.directory-item.entity') != null
                    && folderHeader.parentElement.getAttribute('data-mfolder-id') != 'default'
                    && game.user.isGM){
                    addExportButton(folderHeader,true);
                }  
            }
        })
        Hooks.on('renderMacroDirectory',async function(){
            let importing = game.settings.get(mod,'importing');
            if (!importing && game.macros.entities.some(m => m.name === TEMP_ENTITY_NAME)){
                removeTempEntities('Macro')
            }
        })
    }
});