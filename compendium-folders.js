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
function convertExistingSubmenusToFolder(isPopout){
    deleteExistingRules()
    let submenus = document.querySelectorAll('li.compendium-entity');
    while (submenus == null){
        setTimeout(function(){submenus = document.querySelectorAll('li.compendium-entity')},1000)
    }
    //let submenus = document.querySelectorAll('li.compendium-entity')
    var allFolders = [];
    for (var submenu of submenus){
        if (submenu.classList.contains('compendium-folder')){
            continue;
        }
        let compendiumFolder = createFolderObjectForSubmenu(submenu,submenu.querySelector('h3').innerText);
        allFolders.push(compendiumFolder)
        convertSubmenuToFolder(submenu,compendiumFolder.uid);
    }
    game.settings.set(mod,'cfolders',allFolders);
}
function convertSubmenuToFolder(submenu,uid){
    
    submenu.classList.add('compendium-folder')
    let header = document.createElement('header')
    header.classList.add('compendium-folder-header', 'flexrow')

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

    submenu.setAttribute('data_cfolder_id',uid);
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

function createNewFolder(titleText,color){
    // TODO create object then call createFolder()
    Settings.addFolder(titleText,color,[]);
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
    
    // folder.addEventListener('click',function(){ toggleFolder(folder) },false)
    // cogLink.addEventListener('click',function(event){showEditDialog(folder,event)},false)
    
    header.appendChild(title)
    header.appendChild(cogLink)
    folder.appendChild(header)
    folder.appendChild(packList);
    folder.setAttribute('data_cfolder_id',compendiumFolder.uid);
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

function setupFolders(prefix){

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
    for (let folder of allFolders){
        let compendiumElements = [];
        if (folder.compendiumList.length>0){
            for (let compendiumKey of folder.compendiumList){
                compendiumElements.push(allCompendiumElementsDict[compendiumKey])
            }
        }
        createFolderFromObject(folder,compendiumElements,prefix);
    }
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
    // createNewFolder('New Folder','rgb(0,0,0)');
    // TODO edit dialog
    // let result = "New folder name"
    // let title = submenu.querySelector('h3')
    // let folderIcon = title.querySelector('i')
    // title.innerHTML = folderIcon.outerHTML+result
    
}

function addEventListeners(prefix){

    for (let submenu of document.querySelectorAll(prefix+'li.compendium-folder')){
        let submenuId = submenu.parentElement.parentElement.parentElement.classList[0]+'-'+submenu.querySelector('h3').innerText.toLowerCase()
        if (eventsSetup.indexOf(submenuId) == -1 || submenuId.includes('window')){
            submenu.addEventListener('click',function(){ toggleFolder(submenu) },false)
            submenu.querySelector('a.edit-folder').addEventListener('click',function(event){showEditDialog(submenu,event)},false)
            for (let pack of submenu.querySelectorAll('li.compendium-pack')){
                pack.addEventListener('click',function(ev){ev.stopPropagation()},false)
            }
            eventsSetup.push(submenuId)
        }
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
