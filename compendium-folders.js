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
    console.log("Compendiums for "+titleText+" are "+compendiumNames);
   
    return folderObject
}
// Creation functions

function createNewFolder(){
    // TODO create object then call createFolder()
    new CompendiumFolderConfig(new CompendiumFolder('New Folder','#000000')).render(true) 
}
function createFolderFromObject(compendiumFolder, compendiumElements,prefix){
    let tab = document.querySelector(prefix+'.sidebar-tab[data-tab=compendium]')
    let folder = document.createElement('li')
    folder.classList.add('compendium-entity','compendium-folder')
    let header = document.createElement('header')
    header.classList.add('compendium-folder-header', 'flexrow')
    header.style.backgroundColor = compendiumFolder.colorText;

    let folderIcon = document.createElement('i')
    folderIcon.classList.add('fas','fa-fw','fa-folder')
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
    packList.style.display='none';
    cogLink.style.display='none';

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
function createHiddenFolder(prefix,compendiums,allCompendiumElements){
    let tab = document.querySelector(prefix+'.sidebar-tab[data-tab=compendium]')
    let folder = document.createElement('ol')
    folder.classList.add('hidden-compendiums');
    folder.style.display='none';
    for (let compendium of compendiums){
        
        folder.appendChild(document.querySelector("[data-pack='"+compendium+"']"));
    }
    tab.querySelector(prefix+'ol.directory-list').appendChild(folder)
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
function setupFolders(prefix){

    let allFolders = game.settings.get(mod,'cfolders');
    
    let allCompendiumElements = document.querySelectorAll(prefix+'li.compendium-pack');
    if (allFolders['hidden']!=null 
        && allFolders['hidden'].compendiumList != null 
        && allFolders['hidden'].compendiumList.length>0){
        createHiddenFolder(prefix,allFolders['hidden'].compendiumList,allCompendiumElements)
    }
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
                    compendiumElements.push(allCompendiumElementsDict[compendiumKey])
                }
            }
            createFolderFromObject(folder,compendiumElements,prefix);
        }
    });
    // create folder button
    if (document.querySelector(prefix+'button.cfolder-create')==null){
        let button = document.createElement('button');
        button.classList.add('cfolder-create')
        button.type='submit';
        button.addEventListener('click',function(){createNewFolder()});
        let folderIcon = document.createElement('i')
        folderIcon.classList.add('fas','fa-fw','fa-folder')
        button.innerHTML = folderIcon.outerHTML+game.i18n.localize("FOLDER.Create");
        document.querySelector(prefix+'#compendium .directory-footer').appendChild(button);
    }
    
}
// Delete functions
async function deleteFolder(folder){
    let folderId = folder._id;
    let allFolders = Settings.getFolders();
    let hiddenFolder = allFolders['hidden']
    for (let compendium of folder.compendiumList){
        hiddenFolder.compendiumList.push(compendium);
    }
    delete allFolders[folderId];
    await game.settings.set(mod,'cfolders',allFolders);
    refreshFolders()
}
// Edit functions

Handlebars.registerHelper('ifIn', function(elem, folder, options) {
    let packName = elem.package+'.'+elem.name;
    if(folder.indexOf(packName) > -1) {
      return options.fn(this);
    }
    return options.inverse(this);
  });
class CompendiumFolderConfig extends FormApplication {
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "compendium-folder-edit";
      options.template = "modules/compendium-folders/compendium-folder-edit.html";
      options.width = 500;
      return options;
    }
  
    get title() {
      if ( this.object._id ) return `${game.i18n.localize("FOLDER.Update")}: ${this.object.titleText}`;
      return game.i18n.localize("FOLDER.Create");
    }
  
    /** @override */
    async getData(options) {
      return {
        folder: this.object,
        fpacks: game.packs,

        submitText: game.i18n.localize(this.object._id ? "FOLDER.Update" : "FOLDER.Create"),
        deleteText: "Delete Folder"
      }
    }
  
    /** @override */
    async _updateObject(event, formData) {
      this.object.titleText = formData.name;
      this.object.colorText = formData.color;

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
            // TODO decide what happens here
            // Add to Hidden folder, else issues arise
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
    setupFolders(prefix);
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
    for (let packKey of packsToAdd){
        Object.keys(allFolders).forEach(function(fId){
            if (allFolders[fId].compendiumList.indexOf(packKey)>-1){
                allFolders[fId].compendiumList.splice(allFolders[fId].compendiumList.indexOf(packKey),1);
                console.log(modName+' | Removing '+packKey+' from folder '+allFolders[fId].titleText);
            }
        });
        
        allFolders[folderId].compendiumList.push(packKey);
        console.log(modName+' | Adding '+packKey+' to folder '+folder.titleText);
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
function toggleFolder(parent){

    let folderIcon = parent.querySelector('header > h3 > .fa-folder, .fa-folder-open')
    let cogLink = parent.querySelector('a.edit-folder')
    if (folderIcon.classList.contains('fa-folder-open')){
        //Closing folder
        folderIcon.classList.remove('fa-folder-open')
        folderIcon.classList.add('fa-folder')
        let packs = parent.querySelector('ol.compendium-list')
        packs.style.display='none'
        cogLink.style.display='none'

    }else if (folderIcon.classList.contains('fa-folder')){
        //Opening folder
        folderIcon.classList.remove('fa-folder')
        folderIcon.classList.add('fa-folder-open')
        let packs = parent.querySelector('ol.compendium-list')
        packs.style.display=''
        cogLink.style.display=''
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
            default:[]
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

Hooks.on('renderCompendiumDirectory', async function() {
    Settings.registerSettings()
    await loadTemplates(["modules/compendium-folder/compendium-folder-edit.html"]);
    let isPopout = document.querySelector('#compendium-popout') != null;
    let prefix = '#sidebar '
    if (isPopout){
        prefix = '#compendium-popout '
    }

    if (game.settings.get(mod,'cfolders').length==0){
        convertExistingSubmenusToFolder(prefix);
    }else{
        setupFolders(prefix)
    }
    addEventListeners(prefix)
});
