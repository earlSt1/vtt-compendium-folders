'use strict';
import {libWrapper} from './shim.js';
import { FICManager,FICUtils,FICFolderAPI } from './fic-folders.js';
export const modName = 'Compendium Folders';
const mod = 'compendium-folders';
const FOLDER_LIMIT = 8
const TEMP_ENTITY_NAME = '#[CF_tempEntity]'
const FOLDER_SEPARATOR = '#/CF_SEP/'

// ==========================
// Utility functions
// ==========================
Handlebars.registerHelper('ifIn', function(elem, compendiums, options) {
    let packName = elem.package+'.'+elem.name;
    if(compendiums.indexOf(packName) > -1) {
      return options.fn(this);
    }
    return options.inverse(this);
});

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
function defineClasses(){
    class CompendiumEntryCollection extends WorldCollection{
        constructor(...args) {
            super(...args);
        }
        /** @override */
        get entity() {
            return "CompendiumEntry";
        }
        get documentClass(){
            return game.CF.CompendiumEntry;
        }
    }
    class CompendiumEntry  {
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
                    entries:new game.CF.CompendiumEntryCollection([]),
                    folders:new game.CF.CompendiumFolderCollection([])
                }
            }
            game.customFolders.compendium.entries.set(this._id,this);
        }
        static get metadata(){
            return {
                collection:'game.customFolders.compendium.entries'
            }
        }
        toJSON(){
            return this.data;
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
            return game.CF.CompendiumFolder.collection.get(this.data.folder)
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
    let extendedClass = WorldCollection;
    class CompendiumFolderCollection extends extendedClass{
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
        get documentClass(){
            return game.CF.CompendiumFolder;
        }
    }

    class CompendiumFolder {
        constructor(data={}){
            this.data = mergeObject({
                titleText:'New Folder',
                colorText:'#000000',
                fontColorText:'#FFFFFF',
                type:'CompendiumEntry',
                _id:'cfolder_'+randomID(10),
                entity:'CompendiumFolder',
                sorting:'a',
                parent:null,
                pathToFolder:[],
                compendiumList:[],
                compendiums:[],
                folderIcon:null,
                expanded:false,
                visible:true,
                children:[]
            },data);
        }
        _getSaveData(){
            let data = Object.assign({},this.data);
            delete data.compendiums;
            delete data.content;
            delete data.children;
            return data;
        }
        toJSON(){
            return this.data;
        }
        /** @override */
        static create(data={}){
            let newFolder = new CompendiumFolder(data);
            if (!game.customFolders){
                game.customFolders = new Map();
            }
            if (!game.customFolders.compendium){
                game.customFolders.compendium = {
                    entries:new game.CF.CompendiumEntryCollection([]),
                    folders:new game.CF.CompendiumFolderCollection([])
                }
            }
            game.customFolders.compendium.folders.set(newFolder.id,newFolder);

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
                this.collection.set(this.id,this);
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
            game.customFolders.compendium.folders.get(this.id).data = Object.assign({},this.data);
            if (refresh)
                await initFolders(false);
                ui.compendium.render(true);
        }
        async delete(refresh=true){
            let nextFolder = (this.parent) ? this.parent : this.collection.default;
            for (let pack of this.compendiumList){
                await nextFolder.addCompendium(pack);
            }

            for (let child of this.children){
                if (this.parent){
                    await child.moveFolder(this.parent.id,false);
                }else{
                    await child.moveToRoot();
                }
            }

            if (this.collection.get(this.id)){
                this.collection.delete(this.id)
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
                entry = new game.CF.CompendiumEntry(packCode,this.id);
                //game.customFolders.compendium.entries.insert(entry);
                this._addPack(entry);
                
            }
            //update(entry.data);
            await this.save(refresh);
        }
        async removeCompendium(pack,del=false,refresh=true){
            this._removePack(pack,del);
            if (del){
                game.customFolders.compendium.entries.delete(pack.packCode);
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
            pack.folder = this.id;
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
                this.parent = destFolder.id;
                this.parent.children = this.parent.children.concat(this);
                await this.parent.save(false);
                this.path = this.parent.path.concat(destFolder.id)
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
        get parent(){return this.collection.get(this.data.parent)}
        set parent(p){this.data.parent = p}
        get isDefault(){return this.id === 'default'}
        get isHidden(){return this.id === 'hidden'}
        set expanded(e){this.data.expanded = e}
        get id(){return this.data._id}
        get displayed(){return this.data.visible}
        // Recursively generate a pretty name
        get pathName(){
            if (this.parent)
                return this.parent.pathName+'/'+this.name
            return this.name;
        }
    }
    class CompendiumFolderDirectory extends SidebarDirectory{
        /** @override */
        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                id: "compendium",
                template: "modules/compendium-folders/templates/compendium-directory.html",
                title: "Compendium Packs",
                dragDrop: [{ dragSelector: ".compendium-pack,.compendium-folder", dropSelector: ".compendium-folder"}],
                filters: [{inputSelector: 'input[name="search"]', contentSelector: ".directory-list"}],           
        });
        }

        constructor(...args) {
            super(...args);
        }

        static documentName = 'CompendiumEntry';
        _toggleOpenState(pack) {
            CompendiumDirectory.prototype._toggleOpenState(pack);
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
                this.documents = [];
            }
            else if (game.user.isGM){
                this.folders = [...this.constructor.folders];
                this.documents = [...this.constructor.collection];
            }else{
                this.folders = [...this.constructor.folders].filter(x => x?.content?.find(y => !y?.pack?.private));
                this.documents = [...this.constructor.collection].filter(z => !z?.pack?.private);
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
                    if (!this.folders.some(x => x.id === parent.id) && !toAdd.some(x => x.id === parent.id))
                        toAdd.push(parent);
                    parent = parent.parent;
                }
            }
            this.folders =this.folders.concat(toAdd)
            let tree = this.constructor.setupFolders(this.folders, this.documents);
            
            this.tree = this._sortTreeAlphabetically(tree)
        }
        checkCache(){
            //Check cache
            let cache = game.settings.get(mod,'cached-folder');
            if (game.user.isGM && cache.pack && !this.documents.some(x => cache.pack === x.code)){
                console.debug(modName+ ' | Compendium '+cache.pack+' no longer exists. Clearing cache')
                game.settings.set(mod,'cached-folder',{})
            }
        }
        async refresh(){
            // Check for new packs
            // Add to default if needed

            // Check for removed packs
            await this.checkDeleted()
            ui.compendium.render(true)
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
                isPF1: game.system.id === "pf1",
                isD35E: game.system.id === 'D35E',
                isPF2e: game.system.id === 'pf2e',
                documentPartial: this.constructor.documentPartial,
                folderPartial: this.constructor.folderPartial
            };
        }
        _onCreateFolder(event) {

            event.preventDefault();
            event.stopPropagation();
            const button = event.currentTarget;
            const parent = game.customFolders.compendium.folders.get(button.dataset.parentFolder);
            const data = new game.CF.CompendiumFolder();
            if (parent){
                data.path = parent.path.concat(parent.id)
                data.parent = parent.id;
            }
            const options = {top: button.offsetTop, left: window.innerWidth - 310 - FolderConfig.defaultOptions.width};
            new CompendiumFolderEditConfig(data, options).showDialog(false);
        }
        /** @override */
        activateListeners(html){
            ContextMenu.create(this, html, ".compendium-pack", this._getEntryContextOptions());
            super.activateListeners(html);

            // Taken from CopmendiumDirectory.activateListeners(html)
            // Click to open
            html.find('.compendium-pack').click(ev => {
                let li = $(ev.currentTarget),
                pack = game.packs.get(li.data("pack"));
            if ( li.attr("data-open") === "1" ) pack.apps[0].close();
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
                html.find(".compendium-footer .compendium.spells").click((e) => this._onBrowsePF1Compendium(e, "spells"));
                html.find(".compendium-footer .compendium.items").click((e) => this._onBrowsePF1Compendium(e, "items"));
                html.find(".compendium-footer .compendium.bestiary").click((e) => this._onBrowsePF1Compendium(e, "bestiary"));
                html.find(".compendium-footer .compendium.feats").click((e) => this._onBrowsePF1Compendium(e, "feats"));
                html.find(".compendium-footer .compendium.classes").click((e) => this._onBrowsePF1Compendium(e, "classes"));
                html.find(".compendium-footer .compendium.races").click((e) => this._onBrowsePF1Compendium(e, "races"));
                html.find(".compendium-footer .compendium.buffs").click((e) => this._onBrowsePF1Compendium(e, "buffs"));
            }
            if (game.system.id === 'D35E'){
                html.find(".compendium-footer .compendium.spells").click(e => this._onBrowseD35ECompendium(e, "spells"));
                html.find(".compendium-footer .compendium.items").click(e => this._onBrowseD35ECompendium(e, "items"));
                html.find(".compendium-footer .compendium.bestiary").click(e => this._onBrowseD35ECompendium(e, "bestiary"));
                html.find(".compendium-footer .compendium.feats").click(e => this._onBrowseD35ECompendium(e, "feats"));
                html.find(".compendium-footer .compendium.enhancements").click(e => this._onBrowseD35ECompendium(e, "enhancements"));
                html.find(".compendium-footer .compendium.buffs").click(e => this._onBrowseD35ECompendium(e, "buffs"))
            }
            if (game.system.id === 'pf2e'){
                html.find(".compendium-footer > .compendium-browser-btn").on("click",(()=>{game.pf2e.compendiumBrowser.render(true)}));
            }
            // Options below are GM only
            if ( !game.user.isGM ) return;

            // Create Compendium
            html.find('.create-compendium').click(this._onCreateDocument.bind(this));
            html.find('.create-entity-c').click(this._onCreateDocument.bind(this));
        }
        _onBrowsePF1Compendium(event, type) {
            event.preventDefault();
        
            if (game.pf1.isMigrating) return ui.notifications.warn(game.i18n.localize("PF1.Migration.Ongoing"));
        
            game.pf1.compendiums[type]._render(true);
        } 
        _onBrowseD35ECompendium(event,type){
            event.preventDefault();
            game.D35E.CompendiumDirectoryPF.browser.compendiums[type]._render(true);
        }   

        /** @override */
        _getEntryContextOptions(){
            if (!game.user.isGM)
                return [];
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
                        let newPack = await pack.duplicateCompendium({label})
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
            let i = x.findIndex(c => c.name === 'COMPENDIUM.ImportAll')
            let oldCallback = x[i].callback;
            // Limit importAll to only work for compendiums with no folders in them
            x[i].condition = (li) => {
                let pack = game.packs.get(li.data("pack"));
                return !pack.index.contents.some(x => x.name === game.CF.TEMP_ENTITY_NAME)
            }
            x[i].callback = async (li) => {
                await game.settings.set(mod,'importing',true);
                await oldCallback.bind(this)(li);
                await game.settings.set(mod,'importing',false);
                let pack = game.packs.get(li.data('pack'));
                FICUtils.removeTempEntities(pack.documentClass.documentName);
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
                        content: `
                                <p>${game.i18n.localize("AreYouSure")}</p>
                                <p>${game.i18n.localize("FOLDER.DeleteWarning")}</p>
                            `,
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
                        return game.user.isGM
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
                        return game.user.isGM
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
                        return game.user.isGM
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
                        return game.user.isGM
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
                { type: "Folder", id: li.dataset.folderId, entity: this.constructor.documentName } :
                { type: this.constructor.documentName, id: li.dataset.pack };
            event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
            this._dragType = dragData.type;
        }
        async _onDrop(event){
            event.stopPropagation();
            let li = event.currentTarget.closest("li.folder");
            if (li) li.classList.remove("droptarget");
            if (li.dataset.folderId === 'default' || !game.user.isGM)
                return;
            let data;
            try{
                data = JSON.parse(event.dataTransfer.getData('text/plain'));
            }catch(err){
                return;
            }

            let folderId = li.dataset.folderId;

            if (folderId){
                if (data.type === this.constructor.documentName){
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
        async _onCreateDocument(event) {
            let parentId = 'default' 
            if (!event.currentTarget.classList.contains('create-compendium')){
                // is a button on folder
                parentId = event.currentTarget.closest('li')?.dataset?.folderId;
            }
            event.stopPropagation();
            event.preventDefault();
            const types = CONST.COMPENDIUM_ENTITY_TYPES.filter(t => t != 'Adventure');
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
                CompendiumCollection.createCompendium(data).then((pack) => {
                    console.log(pack);
                    game.customFolders.compendium.folders.get(parentId).addCompendium(`${pack.metadata.package}.${pack.metadata.name}`);
                });
                },
            options: { jQuery: false }
            });
        }
        // Taken from SidebarDirectory._onSearchFilter()
        // modified slightly for custom data structures
        _onSearchFilter(event, query, rgx, html) {
            const isSearch = !!query;
            let entityIds = new Set();
            let folderIds = new Set();
        
            // Match entities and folders
            if ( isSearch ) {
                const rgx = new RegExp(RegExp.escape(query), "i");
            
                // Match entity names
                for ( let e of this.documents ) {
                    if ( rgx.test(e.name) ) {
                    entityIds.add(e.id);
                    if ( e.parent.id ) folderIds.add(e.parent.id);
                    }
                }
            
                // Match folder tree
                const includeFolders = fids => {
                    const folders = this.folders.filter(f => fids.has(f.id));
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
            if (el.classList.contains("directory-item")) {
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
        
        get documentName(){return "CompendiumFolderDirectory"}
    }
    // extend _getEntryContextOptions()
    //CompendiumFolderDirectory._getEntryContextOptions = CompendiumDirectory.prototype._getEntryContextOptions;
    CompendiumFolderDirectory._onCreateCompendium = CompendiumDirectory.prototype._onCreateCompendium;
    CompendiumFolderDirectory._onDeleteCompendium = CompendiumDirectory.prototype._onDeleteCompendium;

    //was Compendium.create
    libWrapper.register(mod, 'CompendiumCollection.createCompendium', async function (wrapped, ...args) {
        let result = await wrapped(...args)
        await initFolders(true);
        return result;
    }, 'WRAPPER');
    //was Compendium.delete
    libWrapper.register(mod, 'CompendiumCollection.prototype.deleteCompendium', async function (wrapped, ...args) {
        let packCode = this.collection;
        await game.customFolders.compendium.folders.contents.find(x => x.compendiumList.includes(packCode)).removeCompendiumByCode(packCode,true,false);
        let result = await wrapped(...args) 
        await initFolders(true); 
        return result;
    }, 'WRAPPER');

    // Override search filter for compendiums
    libWrapper.register(mod, 'Compendium.prototype._onSearchFilter', function (wrapped, ...args) {
        if (this.collection.index.contents.some(x => x.name === TEMP_ENTITY_NAME)){
            //Do custom search
            let existingSearchTerms = game.settings.get(mod,'last-search-packs')
            let query = [...args][1]
            let html = [...args][3]
            existingSearchTerms[this.collection.collection] = query
            game.settings.set(mod,'last-search-packs',existingSearchTerms);
            if (query?.length>0){
                filterSelectorBySearchTerm(html,query,'.directory-item')
            }else{          
                let openTempFolders = game.settings.get(mod,'open-temp-folders')[this.collection.collection];
                for (let folder of html.querySelectorAll('.compendium-folder')){
                    if (openTempFolders && openTempFolders.includes(folder.dataset.folderId)){
                        folder.querySelector('.folder-contents').style.display = '';
                        folder.removeAttribute('collapsed');
                        folder.querySelector('header > h3 > i')?.classList.remove('fa-folder');
                        folder.querySelector('header > h3 > i')?.classList.add('fa-folder-open');
                    } else {
                        folder.querySelector('.folder-contents').style.display = 'none';
                        folder.setAttribute('collapsed','');
                        folder.querySelector('header > h3 > i')?.classList.add('fa-folder');
                        folder.querySelector('header > h3 > i')?.classList.remove('fa-folder-open');
                    }
                }
                for (let entry of html.querySelectorAll('.compendium-folder')){
                    if (!entry.classList.contains('hidden')){
                        entry.style.display=''
                    }
                }
                for (let entry of html.querySelectorAll('.directory-item')){
                    if (!entry.classList.contains('hidden')){
                        entry.style.display=''
                    }
                }
            }
        }else{
            wrapped(...args)     
        }
    }, 'MIXED');

    CONFIG.CompendiumEntry = {documentClass : CompendiumEntry};
    CONFIG.CompendiumFolder = {documentClass : CompendiumFolder};
    CONFIG.CompendiumEntryCollection = {documentClass : CompendiumEntryCollection};
    CONFIG.CompendiumFolderCollection = {documentClass : CompendiumFolderCollection};
    CONFIG.CompendiumFolderDirectory = {documentClass : CompendiumFolderDirectory};
   
    game.CF = {
        CompendiumEntry,
        CompendiumFolder,
        CompendiumEntryCollection,
        CompendiumFolderCollection,
        CompendiumFolderDirectory,
        TEMP_ENTITY_NAME,
        FOLDER_SEPARATOR,
        FICManager,
        FICFolderAPI,
        cleanupCompendium,
    };

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
        defaultFolder:this.object.id==='default',
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
        if (this.object.id != 'default'){
            let packsToAdd = []
            let packsToRemove = []
            for (let entry of game.packs.contents){
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
            if (this.object.data.parent && !game.customFolders.compendium.folders.get(this.object.data.parent)?.children?.some(x => x.id === this.object.id)){
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


// ==========================
// For cleaning folder data from a compendium pack
// This is accessible from the module settings
// ==========================
async function cleanupCompendium(pack){
    ui.notifications.notify(game.i18n.format("CF.cleanupNotificationStart",{pack:pack}))
    let p = game.packs.get(pack);
    let index = await p.getIndex();
    let allData = await p.getDocuments();
    for (let entry of allData){
        if (entry.name === TEMP_ENTITY_NAME){
            await FICUtils.packDeleteEntity(p,entry.id)
        }else{
            let matchingIndex = index.find(i => i._id === entry.id);
            let data = await entry.toCompendium();
            if (data.flags.cf != null){
                data.flags['cf'] = null
            }
            if (matchingIndex){
                data.id = matchingIndex._id;
            }
            await FICUtils.packUpdateEntity(p,data)
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
            packs : game.packs.contents.filter(x => !x.locked)
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

//----------------------------------
// Validation checks on compendiums
//----------------------------------
class FixCompendiumConfig extends FormApplication{
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "select-compendium";
        options.template = "modules/compendium-folders/templates/select-compendium.html";
        return options;
    }
  
    get title() {
        return "Validate Compendium";
    }
    async getData(options) { 
        return {
            packs : game.packs.contents.filter(x => !x.locked && x.index.some(e => e.name === game.CF.TEMP_ENTITY_NAME))
        }
    }
    
    /** @override */
    async _updateObject(event,formData){
        let pack = formData.pack;
        if (pack != null){
            this.validateCompendium(pack);
        }
    }
    async validateCompendium(packName){
        let pack = game.packs.get(packName);
        let documents = await pack.getDocuments();
        let allFolders = documents.filter(x => x.name === game.CF.TEMP_ENTITY_NAME);
        let allNonFolders = documents.filter(x => x.name != game.CF.TEMP_ENTITY_NAME);
        let updateData = [];
        let messages = [];
        try{
            for (let nonFolder of allNonFolders){
                let changes = this.updateEntityParentIfInvalid(nonFolder,documents);
                if (Object.keys(changes).length > 0){
                    updateData[nonFolder.id] = changes;
                    messages.push([`Need to update parent folder id for document "${nonFolder.name}" [${nonFolder.id}]`])
                }
                changes = this.updatePathIfInvalid(nonFolder,documents);
                if (Object.keys(changes).length > 0){
                    updateData[nonFolder.id] = foundry.utils.mergeObject(changes,updateData[nonFolder.id]);
                    messages.push(`Need to update path for document "${nonFolder.name}" [${nonFolder.id}]`);
                }
            }
            // for (let folder of allFolders){
            //     let changes = this.updateFolderPathIfInvalid(folder,documents);
            //     if (Object.keys(changes).length > 0){
            //         updateData[folder.id] = (changes);
            //         messages.push([`Need to update folderPath for folder "${folder.data.flags.cf.name}" [${folder.id}]`])
            //     }
            // }
            if (messages.length>0){
                let html =  await renderTemplate('modules/compendium-folders/templates/fix-compendium.html', {messages});
                new Dialog({
                    title: "Repair Compendium",
                    content:html,
                    buttons: {
                        cancel: {
                            icon: '<i class="fas fa-times"></i>',
                            label: "Cancel",
                            callback: () => {}
                        },
                        fix:{
                            icon: '<i class="fas fa-check"></i>',
                            label: "Attempt to fix",
                            callback: ()=> {
                                try{
                                    this.attemptToFix(pack,updateData)
                                }catch(err){
                                    let allDocumentData = documents.map(x => JSON.stringify(foundry.utils.mergeObject({name:x.name,entityId:x.id},x.data?.flags?.cf)))
                                    Dialog.prompt({
                                        title:"Repair Error",
                                        content:`
                                            <h2> Error while repairing</h2>
                                            <i>Please save the contents below and add the file to a new 
                                                <a href="https://github.com/earlSt1/vtt-compendium-folders/issues/new?assignees=&labels=&template=fix-my-compendium.md&title=Fix+my+Compendium+issue">GitHub issue</a> so I can investigate
                                            </i>
                                            <div class="form-group"><textarea name='fixCompendiumErrorData' readonly>
                                                ${err}\n===MESSAGES===\n
                                                ${messages.join('\n')}\n===FOLDER_DATA===\n
                                                ${allDocumentData.join('\n')}
                                            </textarea></div>`,
                                        callback: () => {}
                                    })
                                }

                            }
                        }
                    }
                }).render(true);
            }else{
                Dialog.prompt({
                    title:"Validate Compendium",
                    content:"<p>No issues found in your compendium!</p>",
                    callback: () => {}
                });
            }
        }catch(exception){
            let allDocumentData = documents.map(x => JSON.stringify(foundry.utils.mergeObject({name:x.name,entityId:x.id},x.data?.flags?.cf)))
            Dialog.prompt({
                title:"Validation Error",
                content:`
                    <h2> Error while validating</h2>
                    <i>Please save the contents below and add the file to a new 
                        <a href="https://github.com/earlSt1/vtt-compendium-folders/issues/new?assignees=&labels=&template=fix-my-compendium.md&title=Fix+my+Compendium+issue">GitHub issue</a> so I can investigate
                    </i>
                    <div class="form-group"><textarea name='fixCompendiumErrorData' readonly>
                        ${exception}\n===MESSAGES===\n
                        ${messages.join('\n')}\n===FOLDER_DATA===\n
                        ${allDocumentData.join('\n')}
                    </textarea></div>
                `,callback: () => {}
            })
        }
    }
    async attemptToFix(pack,updateData){
        for (let update of Object.values(updateData)){
            const document = await pack.getDocument(update.id);
            await document.update(update, {pack:pack.collection});
        }
        ui.notifications.notify("Repairs complete!");
    }
    updateEntityParentIfInvalid(entity,contents){
        if (entity.data?.flags?.cf?.path){
            let fId = entity.data.flags.cf.id
            let parentEntity = contents.find(x => x.name === TEMP_ENTITY_NAME && x.data.flags.cf.id === fId);
            if (!parentEntity){
                console.debug(modName+' | No parent found for document '+entity.name+', overriding folder id...')
                return {
                    id:entity.id,
                    flags:{
                        cf:{
                            id:null
                        }
                    }
                }
            }
            else if (entity.data.flags.cf.id != parentEntity.data.flags.cf.id){
                console.debug(modName+' | Need to update parent folder ID for '+entity.name);
                return {
                    id:entity.id,
                    flags:{
                        cf:{
                            id:parentEntity.data.flags.cf.id,
                        }
                    }
                }
            }
        }
        return {};
    }
    updateFolderPathIfInvalid(folder,contents){
        let folderPath = folder.data.flags.cf.folderPath;
        let newFolderPath = folderPath;
        let path = folder.data.flags.cf.path;
        for (let folderId of folderPath){
            if (!contents.some(x => x.name === TEMP_ENTITY_NAME && x.data.flags.cf.id === folderId)){
                console.debug(modName+' | Need to update folderPath for folder '+folder.data.flags.cf.id);
                let correctFolder = contents.find(x => x.name === TEMP_ENTITY_NAME && x.data.flags.cf.path === path);
                if (correctFolder){
                    newFolderPath[folderPath.indexOf(folderId)] = correctFolder.data.flags.cf.id;
                }
            }
        }
        if (folderPath != newFolderPath){
            return {
                id:folder.id,
                flags:{
                    cf:{
                        folderPath:newFolderPath
                    }
                }
            }
        }
        return {};
    }
    updatePathIfInvalid(entity,contents){
        let path = entity.data?.flags?.cf?.path;
        let folderId = entity?.data?.flags?.cf?.id;
        if (!path && folderId){
            let folder = contents.find(x => x.name === TEMP_ENTITY_NAME && x.data.flags.cf.id === folderId);
            if (folder){
                if (folder.data?.flags?.cf?.path && path != folder.data.flags.cf.path){
                    console.debug(`${modName} | Need to update path for ${entity.name} to ${folder.data.flags.cf.path}`)
                    return{
                        id:entity.id,
                        flags:{
                            cf:{
                                path:folder.data.flags.cf.path
                            }
                        } 
                    }
                }
                else{
                    console.debug(`${modName} | Need to manually construct path for ${entity.name}`)
                    let folderPath = folder.data.flags.cf.folderPath;
                    let pathNames = folderPath.map(x => contents.find(y => y.name === game.CF.TEMP_ENTITY_NAME && y.data.flags.cf.id === x).data.flags.cf.name)
                    let newPath = pathNames.join(game.CF.FOLDER_SEPARATOR)
                    return{
                        id:entity.id,
                        flags:{
                            cf:{
                                path:newPath
                            }
                        } 
                    }
                }
            }
        }
        return {}
    }
}
//==========================
// Settings utilities
//==========================
export class Settings{
    static registerSettings(){
        game.settings.registerMenu(mod,'settingsMenu',{
            name: game.i18n.localize('CF.configuration'),
            label: game.i18n.localize('CF.importExportLabel'),
            icon: 'fas fa-cog',
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
        game.settings.registerMenu(mod,'fix-compendium',{
            name:'Validate and Fix',
            label: 'Fix Compendium',
            icon: 'fas fa-wrench',
            scope:'world',
            config:true,
            type:FixCompendiumConfig,
            restricted:true
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
            scope:'world',
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
        game.settings.register(mod,'default-keep-id',{
            name:'Default Keep ID',
            hint:'If enabled, the Keep ID option will be enabled by default when importing compendiums',
            scope:'world',
            config:true,
            type:Boolean,
            default:false
        });
        game.settings.register(mod,'auto-create-folders',{
            name:'Auto Create folders on Import',
            hint: 'If enabled, dragging a document from a compendium into your world will create folder structures automatically',
            scope:'world',
            config:true,
            type:Boolean,
            default:false
        });
        game.settings.register(mod,'last-pack',{
            scope:'client',
            config:false,
            type:String,
            default:''
        })
        let FolderCollection = CONFIG.CompendiumFolderCollection.documentClass;
        let EntryCollection = CONFIG.CompendiumFolderCollection.documentClass;
        
        if (game.customFolders){
            game.customFolders.compendium = {
                folders:new FolderCollection([]),
                entries:new EntryCollection([])
                
            }
        } else {
            game.customFolders = {
                compendium:{
                    folders:new FolderCollection([]),
                    entries:new EntryCollection([])
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
async function initFolders(refresh=false){
    let CompendiumFolder =  CONFIG.CompendiumFolder.documentClass;
    let CompendiumEntry =  CONFIG.CompendiumEntry.documentClass;

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
        for (let pack of game.packs.contents){
            if (allFolders[entityId[pack.documentClass.documentName]]){
                allFolders[entityId[pack.documentClass.documentName]].compendiumList.push(pack.collection);
            }else{
                entityId[pack.documentClass.documentName] = 'cfolder-'+randomID(10);
                allFolders[entityId[pack.documentClass.documentName]] = {
                    _id:entityId[pack.documentClass.documentName],
                    titleText:pack.documentClass.documentName,
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
    let unassigned = game.packs.contents.filter(x => !assigned.includes(x.collection))
    for (let pack of unassigned.map(y => y.collection)){
        if (game.customFolders.compendium.entries.has(pack)){
            // Pack has an entry (assigned to default folder)
            game.customFolders.compendium.entries.get(pack).folder = 'default';
        }else{
            if (pack.length > 1){
            // Pack does not have an entry (because it is new)
                new CompendiumEntry(pack,'default');
            }
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
Hooks.once('init',async function(){
    defineClasses();
    Settings.registerSettings();
    game.CF.FICManager.setup();
    Hooks.once('ready',async function(){
        game.CF.FICFolderAPI.clearCache();
        if (game.settings.get(mod,'importing')){
            await game.settings.set(mod,'importing',false);
        }
        // Ensure compatibility with other modules that rely on the old directory.
        Hooks.on('renderCompendiumFolderDirectory',(html,e) => {
            Hooks.call('renderCompendiumDirectory',html,e);
        });
                
        while (!ui.compendium.rendered){
            // wait for old compendium directory to render
            // else we get a race condition
            await new Promise(res => setTimeout(res,500));
        }
        ui.compendium = new game.CF.CompendiumFolderDirectory();

        await initFolders(true);
    })
       
    Hooks.on("getCompendiumFolderDirectoryEntryContext", async (html,options) => {
        Hooks.call("getCompendiumDirectoryEntryContext",html,options);
    })
    
});
