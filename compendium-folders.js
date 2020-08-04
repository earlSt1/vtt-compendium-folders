export const modName = 'Compendium Folders';
const mod = 'compendium-folders';

function generateRandomFolderName(){
    return Math.random().toString(36).replace('0.','cfolder_' || '');
}
export class CompendiumFolder{
    constructor(title,color){
        this.title = title;
        this.color = color
        this.compendiums = [];
        this.folders = [];
        this.uid=generateRandomFolderName();
    }
    initFromExisting(existing){
        this.title = existing['titleText'];
        this.color = existing['colorText']
        this.compendiums = existing['compendiumList'];
        this.folders = existing['folders'];
        this.uid=existing['uid'];
    }
    get uid(){
        return this._id;
    }
    set uid(id){
        this._id=id;
    }
    get title(){
        return this.titleText;
    }
    get color(){
        return this.colorText;
    }
    set title(ntitle){
        this.titleText = ntitle;
    }
    set color(ncolor){
        this.colorText = ncolor;
    }
    get compendiums(){
        return this.compendiumList;
    }
    get folders(){
        return this.folderList;
    }
    set compendiums(compendiums){
        this.compendiumList = compendiums;
    }
    set folders(folders){
        this.folderList = folders;
    }
    addCompendium(compendium){
        this.compendiums.push(compendium);
    }
    addFolder(compendiumFolder){
        this.folders.push(compendiumFolder);
    }
}

// Module init functions
function convertExistingSubmenusToFolder(){
    console.log(modName+' | No folder data found. Converting current compendium state to folders');
    deleteExistingRules()
    let submenus = document.querySelectorAll('li.compendium-entity');
    while (submenus == null){
        setTimeout(function(){submenus = document.querySelectorAll('li.compendium-entity')},1000)
    }
    //let submenus = document.querySelectorAll('li.compendium-entity')
    var allFolders = {};
    for (var submenu of submenus){
        if (submenu.classList.contains('compendium-folder')){
            continue;
        }
        let compendiumFolder = createFolderObjectForSubmenu(submenu,submenu.querySelector('h3').innerText);
        allFolders[compendiumFolder._id]=compendiumFolder;
        convertSubmenuToFolder(submenu,compendiumFolder._id);
    }
    allFolders['hidden']={'compendiumList':[],'titleText':'hidden-compendiums'};
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
    
    let cogIcon = document.createElement('i')
    cogIcon.classList.add('fas','fa-cog','fa-fw')
    let cogLink = document.createElement('a')
    cogLink.classList.add('edit-folder')
    cogLink.appendChild(cogIcon)
    header.appendChild(title)
    header.appendChild(cogLink)
    submenu.insertAdjacentElement('afterbegin',header)

    //Close folder by default
    let packs = submenu.querySelector('ol.compendium-list')
    packs.style.display='none'
    cogLink.style.display='none'   

    submenu.setAttribute('data-cfolder-id',uid);
}
function createFolderObjectForSubmenu(submenu,titleText){
    let compendiums = submenu.querySelector('ol').querySelectorAll('li.compendium-pack')
    let compendiumNames = []
    let folderObject = new CompendiumFolder(titleText,"#000000")
    for (let compendium of compendiums){
        folderObject.addCompendium(compendium.getAttribute('data-pack'))
    }   
    return folderObject
}
function filterCompendiumsBySearchTerm(searchTerm){
    // TODO Redraw list, but filter to only matching searchTerm
}
function createDirectoryHeader(){
    let tab = document.querySelector("#sidebar .sidebar-tab[data-tab='compendium']");
    if (tab.querySelector('.directory-header')==null){
        let header = document.createElement('header');
        header.classList.add('directory-header','flexrow');
        let searchDiv = document.createElement('div');
        searchDiv.classList.add('header-search');

        let searchIcon = document.createElement('i');
        searchIcon.classList.add('fas','fa-search');
        let searchBar = document.createElement('input');
        searchBar.setAttribute('type','text');
        searchBar.setAttribute('name','search');
        searchBar.setAttribute('placeholder','Search Compendiums');
        searchBar.setAttribute('autocomplete','off');
        // TODO dynamic search
        searchBar.addEventListener('keyup',function(event){
            //console.log(event.target.value);
            filterCompendiumsBySearchTerm(event.target.value);
        });

        let collapseLink = document.createElement('a');
        collapseLink.classList.add('header-control','collapse-all');
        collapseLink.title='Collapse all Folders';
        collapseLink.addEventListener('click',function(){
            document.querySelectorAll('.compendium-folder').forEach(function(element){
                closeFolder(element);
            });
        })
        let collapseIcon = document.createElement('i');
        collapseIcon.classList.add('fas','fa-sort-amount-up');
        collapseLink.append(collapseIcon);

        
        searchDiv.appendChild(searchIcon);
        searchDiv.appendChild(searchBar);
        header.appendChild(searchDiv);
        header.appendChild(collapseLink);
        tab.insertAdjacentElement('afterbegin',header);
    }

}
// Creation functions

function createNewFolder(){
    // TODO create object then call createFolder()
    new CompendiumFolderConfig(new CompendiumFolder('New Folder','')).render(true) 
}
function createFolderFromObject(compendiumFolder, compendiumElements,prefix,wasOpen){
    let tab = document.querySelector(prefix+'.sidebar-tab[data-tab=compendium]')
    let folder = document.createElement('li')
    folder.classList.add('compendium-entity','compendium-folder')
    let header = document.createElement('header')
    header.classList.add('compendium-folder-header', 'flexrow')
    header.style.backgroundColor = compendiumFolder.colorText;

    let folderIcon = document.createElement('i')
    folderIcon.classList.add('fas','fa-fw')
    let cogIcon = document.createElement('i')
    cogIcon.classList.add('fas','fa-cog','fa-fw')
    let featherIcon = document.createElement('i')
    featherIcon.classList.add('fas','fa-feather-alt','fa-fw')
    let cogLink = document.createElement('a')
    cogLink.classList.add('edit-folder')
    cogLink.appendChild(cogIcon)

    let packList = document.createElement('ol');
    packList.classList.add('compendium-list');
    for (let compendium of compendiumElements){
        packList.appendChild(compendium);
    }
    if (!wasOpen){
        packList.style.display='none';
        cogLink.style.display='none';
        folderIcon.classList.add('fa-folder');
    }else{
        folderIcon.classList.add('fa-folder-open');
    }

    let title = document.createElement('h3')
    title.innerHTML = folderIcon.outerHTML+compendiumFolder.titleText;
    
    header.appendChild(title)
    header.appendChild(cogLink)
    folder.appendChild(header)
    folder.appendChild(packList);

    folder.setAttribute('data-cfolder-id',compendiumFolder._id);
    tab.querySelector(prefix+'ol.directory-list').appendChild(folder)
}

function deleteExistingRules(){
    var sheet = window.document.styleSheets[0];
    for (var i=sheet.cssRules.length-1;i>=0;i--){
        if (sheet.cssRules[i].selectorText==='#compendium h3'){
            sheet.deleteRule(i);
            return;
        }
    }
}
function createHiddenFolder(prefix,allCompendiumElementsDict){
    let tab = document.querySelector(prefix+'.sidebar-tab[data-tab=compendium]')
    if (document.querySelector('.hidden-compendiums')==null){
        let folder = document.createElement('ol')
        folder.classList.add('hidden-compendiums');
        folder.style.display='none';
        Object.keys(allCompendiumElementsDict).forEach(function(key){
            console.log(mod+" | Adding "+key+" to hidden-compendiums");
            folder.appendChild(allCompendiumElementsDict[key]);  
        });
        tab.querySelector(prefix+'ol.directory-list').appendChild(folder);   
    }
}
function alphaSortFolders(folders){
    let items = Object.keys(folders).map(function(key) {
        return [key, folders[key]];
      });
    items.sort(function(first,second){
        if (first[1]['titleText']<second[1]['titleText']){
            return -1;
        }
        if ( first[1]['titleText'] > second[1]['titleText']){
          return 1;
        }
        return 0;
    })
    let sortedFolders = {}
    for (let item of items){
        sortedFolders[item[0]]=item[1];
    }
    return sortedFolders
}
function setupFolders(prefix,openFolders){

    let allFolders = game.settings.get(mod,'cfolders');
    
    let allCompendiumElements = document.querySelectorAll(prefix+'li.compendium-pack');

    //Remove all current submenus
    for (let submenu of document.querySelectorAll(prefix+'li.compendium-entity')){
        submenu.remove();
    }

    let allCompendiumElementsDict = {}
    // Convert existing compendiums into dict of format { packName : packElement }
    // e.g { dnd5e.monsters : <li class ..... > }
    for (let compendiumElement of allCompendiumElements){
        allCompendiumElementsDict[compendiumElement.getAttribute('data-pack')]=compendiumElement;
    }

    // Now loop through folder compendiums, get them from dict, add to local list, then pass to createFolder
    Object.keys(alphaSortFolders(allFolders)).forEach(function(key){
        if (key != 'hidden'){

            let folder = new CompendiumFolder('','');
            folder.initFromExisting(allFolders[key]);
            folder.uid=key;

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
            if (game.user.isGM || (!game.user.isGM && compendiumElements.length>0)){
                
                createFolderFromObject(folder,compendiumElements,prefix, (openFolders.includes(folder._id)));
            }
        }
    });
    // Create hidden compendium folder
    // Add any remaining compendiums to this folder
    // (prevents adding a compendium from breaking everything)
    if ((allFolders['hidden']!=null 
        && allFolders['hidden'].compendiumList != null 
        && allFolders['hidden'].compendiumList.length>0)
        ||Object.keys(allCompendiumElementsDict).length>0){
        createHiddenFolder(prefix,allCompendiumElementsDict);
    }


    // create folder button
    if (game.user.isGM && document.querySelector(prefix+'button.cfolder-create')==null){
        let button = document.createElement('button');
        button.classList.add('cfolder-create')
        button.type='submit';
        button.addEventListener('click',function(){createNewFolder()});
        let folderIcon = document.createElement('i')
        folderIcon.classList.add('fas','fa-fw','fa-folder')
        button.innerHTML = folderIcon.outerHTML+game.i18n.localize("FOLDER.Create");
        document.querySelector(prefix+'#compendium .directory-footer').appendChild(button);
    }

    // TODO directory header
    //createDirectoryHeader();
    
}
// Delete functions
async function deleteFolder(folder){
    let folderId = folder._id;
    let allFolders = Settings.getFolders();
    let hiddenFolder = allFolders['hidden']
    ui.notifications.notify("Adding compendiums "+folder.compendiumList+" to unassigned/hidden folder");
    for (let compendium of folder.compendiumList){
        hiddenFolder.compendiumList.push(compendium);
    }
    delete allFolders[folderId];
    await game.settings.set(mod,'cfolders',allFolders);
    refreshFolders()
}
// Edit functions

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
class CompendiumFolderConfig extends FormApplication {
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "compendium-folder-edit";
      options.template = "modules/compendium-folders/compendium-folder-edit.html";
      options.width = 500;
      return options;
    }
  
    get title() {
      if ( this.object.colorText.length>1  ) {
        return `${game.i18n.localize("FOLDER.Update")}: ${this.object.titleText}`;
      }
      return game.i18n.localize("FOLDER.Create");
    }
    getGroupedPacks(){
        let allFolders = game.settings.get(mod,'cfolders');
        let assigned = {};
        let unassigned = {};
        Object.keys(allFolders).forEach(function(key){
            if (key != 'hidden'){
                for (let a of allFolders[key].compendiumList){
                    assigned[a]=game.packs.get(a);
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
        fpacks: game.packs,
        apacks: alphaSortCompendiums(Object.values(allPacks[0])),
        upacks: alphaSortCompendiums(Object.values(allPacks[1])),
        submitText: game.i18n.localize( this.object.colorText.length>1   ? "FOLDER.Update" : "FOLDER.Create"),
        deleteText: "Delete Folder"
      }
    }
  
    /** @override */
    async _updateObject(event, formData) {
      this.object.titleText = formData.name;
      if (formData.color.length===0){
          this.object.colorText = '#000000'; 
      }else{
        this.object.colorText = formData.color;
      }

      // Update compendium assignment
      let packsToAdd = []
      let packsToRemove = []
      for (let packKey of game.packs.keys()){
          if (formData[packKey] && this.object.compendiumList.indexOf(packKey)==-1){
            //Box ticked AND compendium not in folder
            packsToAdd.push(packKey);
            
          }else if (!formData[packKey] && this.object.compendiumList.indexOf(packKey)>-1){
            //Box unticked AND compendium in folder
            packsToRemove.push(packKey);
          }
      }
      if (formData.delete[0]==1){
          //do delete stuff
          new Dialog({
            title: "Delete Folder",
            content: "<p>Are you sure you want to delete the folder <strong>"+this.object.titleText+"?</strong></p>",
            buttons: {
              yes: {
                icon: '<i class="fas fa-check"></i>',
                label: "Yes",
                callback: () => deleteFolder(this.object)
              },
              no: {
                icon: '<i class="fas fa-times"></i>',
                label: "No"
              }
            }
          }).render(true);
        
      }else{
        await updateFolders(packsToAdd,packsToRemove,this.object);
      }
      
    }
  }
function refreshFolders(){
    let isPopout = document.querySelector('#compendium-popout') != null;
    let prefix = '#sidebar '
    if (isPopout){
        prefix=('#compendium-popout ')
    }
    let allFolders = document.querySelectorAll(prefix+'.compendium-folder')
    let openFolders = [];
    for (let folder of allFolders){
        if (folder.querySelector('.edit-folder').style.display!='none'){
            //folder open
            openFolders.push(folder.getAttribute('data-cfolder-id'));
        }
    }
    setupFolders(prefix,openFolders);
    addEventListeners(prefix);
}
async function updateFolders(packsToAdd,packsToRemove,folder){
    let folderId = folder._id;
    //First find where compendium currently is (what folder it belongs to)
    //Then move the compendium and update
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
        ui.notifications.notify("Removing "+packsMoved.length+" compendium"+(packsMoved.length>1?"s from other folders":" from another folder"))
    }
    // For removing packs, add them to hidden compendium
    if (packsToRemove.length>0){
        ui.notifications.notify("Adding "+packsToRemove.length+" compendium"+(packsToRemove.length>1?"s":"")+" to unassigned/hidden folder");
    }
    for (let packKey of packsToRemove){
        allFolders[folderId].compendiumList.splice(allFolders[folderId].compendiumList.indexOf(packKey),1);
        allFolders['hidden'].compendiumList.push(packKey);
        console.log(modName+' | Adding '+packKey+' to folder '+allFolders['hidden'].titleText);
    }
    allFolders[folderId].titleText = folder.titleText;
    allFolders[folderId].colorText = folder.colorText;

    await game.settings.set(mod,'cfolders',allFolders);
    refreshFolders()
}
// Events
function closeFolder(parent){
    let folderIcon = parent.querySelector('header > h3 > .fa-folder, .fa-folder-open')
    let cogLink = parent.querySelector('a.edit-folder')
    if (folderIcon.classList.contains('fa-folder-open')){
        //Closing folder
        folderIcon.classList.remove('fa-folder-open')
        folderIcon.classList.add('fa-folder')
        let packs = parent.querySelector('ol.compendium-list')
        packs.style.display='none'
        if (game.user.isGM){
            cogLink.style.display='none'
        }
    }
}
function toggleFolder(parent){

    let folderIcon = parent.querySelector('header > h3 > .fa-folder, .fa-folder-open')
    let cogLink = parent.querySelector('a.edit-folder')
    if (folderIcon.classList.contains('fa-folder-open')){
        //Closing folder
        folderIcon.classList.remove('fa-folder-open')
        folderIcon.classList.add('fa-folder')
        let packs = parent.querySelector('ol.compendium-list')
        packs.style.display='none'
        if (game.user.isGM){
            cogLink.style.display='none'
        }

    }else if (folderIcon.classList.contains('fa-folder')){
        //Opening folder
        folderIcon.classList.remove('fa-folder')
        folderIcon.classList.add('fa-folder-open')
        let packs = parent.querySelector('ol.compendium-list')
        packs.style.display=''
        if (game.user.isGM){
            cogLink.style.display=''
        }
    }
}
function showEditDialog(submenu,event){
    event.stopPropagation();
    let allFolders = game.settings.get(mod,'cfolders')
    let folderId = submenu.getAttribute('data-cfolder-id')
    new CompendiumFolderConfig(allFolders[folderId]).render(true);   
}

function addEventListeners(prefix){
    for (let submenu of document.querySelectorAll(prefix+'li.compendium-folder')){
        submenu.addEventListener('click',function(){ toggleFolder(submenu) },false)
        submenu.querySelector('a.edit-folder').addEventListener('click',function(event){showEditDialog(submenu,event)},false)
        for (let pack of submenu.querySelectorAll('li.compendium-pack')){
            pack.addEventListener('click',function(ev){ev.stopPropagation()},false)
        }
        eventsSetup.push(prefix+submenu.getAttribute('data-cfolder-id'))
        
    }
}
export class Settings{
    static registerSettings(){
        game.settings.register(mod, 'cfolders', {
            scope: 'world',
            config: false,
            type: Object,
            default:{}
        });
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
}
var eventsSetup = []

Hooks.once('setup',async function(){
    let hook = 'renderCompendiumDirectory';

    //Fix for pf1 system
    if (game.system.id === 'pf1'){
        hook = 'renderCompendiumDirectoryPF';
    }
    Hooks.on(hook, async function() {
        Settings.registerSettings()
        await loadTemplates(["modules/compendium-folder/compendium-folder-edit.html"]);
        let isPopout = document.querySelector('#compendium-popout') != null;
        let prefix = '#sidebar '
        if (isPopout){
            prefix = '#compendium-popout '
        }
        let currentSettings = game.settings.get(mod,'cfolders')
        if (Object.keys(currentSettings).length === 0 && currentSettings.constructor === Object){
            convertExistingSubmenusToFolder(prefix);
        }else{
            setupFolders(prefix,[])
        }
        addEventListeners(prefix)
    });
});
