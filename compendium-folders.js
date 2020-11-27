export const modName = 'Compendium Folders';
const mod = 'compendium-folders';
const FOLDER_LIMIT = 8
const TEMP_ENTITY_NAME = '#[CF_tempEntity]'

// ==========================
// Utility functions
// ==========================
async function findEntryInFolder(packCode,folderId){
    let pack = game.packs.get(packCode)
    let contents = await pack.getContent();
    return contents.find(x => x.data.flags != null && x.data.flags.cf != null && x.data.flags.cf.id != null && x.data.flags.cf.id === folderId)
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
    let packCode = event.currentTarget.closest('.sidebar-tab.compendium').getAttribute('data-pack')
    if (document.querySelector('nav#folder-context-menu')!=null){
        closeContextMenu()
    }
    let contextMenu = document.createElement('nav');
    contextMenu.classList.add('expand-down');

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
            let entry = await findEntryInFolder(packCode,folderId)
            if (entry != null){
                let formObj = {
                    id:folderId,
                    name:folderName,
                    color:entry.data.flags.cf.color,
                    path:path,
                    packCode:packCode
                }
                new FICFolderEditDialog(formObj).render(true);
            }
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
                    callback: () => deleteFolderWithinCompendium(packCode,folder,false)
                },
                deleteAll:{
                    icon: '<i class="fas fa-trash"></i>',
                    label: "Delete All",
                    callback: ( )=> deleteFolderWithinCompendium(packCode,folder,true)
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
    contextMenu.style.marginTop="30px"; 

    header.insertAdjacentElement('afterbegin',contextMenu);
}
function getFullPath(folderObj){
    let path = folderObj.name;
    let currentFolder = folderObj;
    while (currentFolder.parent != null){
        currentFolder = currentFolder.parent;
        path = currentFolder.name+'/'+path;
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
        case 'RollTable':collection = game.tables;
            break;
        case 'Scene':collection = game.scenes;           
    }
    if (collection != null){
        let tempEntities = collection.entries.filter(x => x.name.includes(TEMP_ENTITY_NAME));
        for (let tempEntity of tempEntities){
            const entity = collection.apps[0].constructor.collection.get(tempEntity.id);
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
        path = currentFolder.parent.data.name+'/'+path;
        currentFolder = currentFolder.parent;
    }
    return path;
}
function getRenderedFolderPath(folder){
    let path = folder.querySelector('h3').innerText;
    let currentFolder = folder;

    while (currentFolder.parentElement.parentElement.parentElement.tagName === 'LI'){
        path = currentFolder.parentElement.parentElement.parentElement.querySelector('h3').innerText + '/' + path;
        currentFolder = currentFolder.parentElement.parentElement.parentElement
    }
    return path;
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

function alphaSortFolders(folders){
    folders.sort(function(first,second){
        if (first['titleText']<second['titleText']){
            return -1;
        }
        if ( first['titleText'] > second['titleText']){
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
// ==========================
// Folder object structure
// ==========================
export class CompendiumFolder{
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
    let folderObject = new CompendiumFolder(titleText,"#000000",[])
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
    new CompendiumFolderEditConfig(new CompendiumFolder('New Folder','',path)).render(true) 
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
        for (let groupedFolder of alphaSortFolders(groupedFolders[depth])){
            let folder = new CompendiumFolder('','');
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
    let folderPath = getRenderedFolderPath(folderElement);
    let folderName = folderElement.querySelector('h3').innerText;
    let contents = await pack.getContent();
    for (let entity of contents){
        if (entity.data.flags != null && entity.data.flags.cf != null){
            let entityPath = entity.data.flags.cf.path;
            if (entityPath != null && entityPath.startsWith(folderPath+'/') || entityPath === folderPath){
                if (deleteAll){
                    //anything starting with path is deleted
                    await pack.deleteEntity(entity.id);
                }else{
                    //anything starting with path removes folderName and update
                    // Remove double slash, leading slash, and following slash
                    let newName = entityPath.replace(folderName+'/','').replace(/\/\//,'/').replace(/^\//,'').replace(/\/$/,'');
                    
                    let data = {
                        flags:{
                            cf:{
                                path:newName
                            }
                        }
                    }
                    if (newName.length === 0){
                        data.flags.cf = null;
                    }

                    data._id = entity._id;
                                                    
                    await pack.updateEntity(data)
                }
            }
        }
    }
    ui.notifications.notify(game.i18n.localize('CF.deleteFolderNotificationFinish'));
    document.querySelector('.compendium-pack[data-pack=\''+packCode+'\']').click();
    pack.render(true);
}
async function updateFolderWithinCompendium(folderObj){
    ui.notifications.notify(game.i18n.localize('CF.updateFolderNotificationStart'))
    let packCode = folderObj.packCode;
    let pack = game.packs.get(packCode);
    await pack.close();
    let folderPath = folderObj.path;
    let oldFolderName = folderObj.oldName;
    let newFolderName = folderObj.newName;
    newFolderName = newFolderName.replace('/','');
    let newColor = folderObj.newColor;
    let contents = await pack.getContent();
    for (let entity of contents){
        if (entity.data.flags != null && entity.data.flags.cf != null){
            let entityPath = entity.data.flags.cf.path;
            if (entityPath != null && entityPath.startsWith(folderPath)){
                //anything starting with path replaces folderName and update
                // Remove double slash, leading slash, and following slash
                let newPath = entityPath.replace(oldFolderName,newFolderName).replace(/\/\//,'/').replace(/^\//,'').replace(/\/$/,'');
                
                let data = {
                    flags:{
                        cf:{
                            path:newPath
                        }
                    }
                }
                // If path matches current folder, set color
                if (entity.data.flags.cf.id === folderObj.id){
                    data.flags.cf.color = newColor;
                }
                if (newPath.length === 0){
                    data.flags.cf = null;
                }

                data._id = entity._id;
                                                
                await pack.updateEntity(data)   
            }
        }
    }
    ui.notifications.notify(game.i18n.localize('CF.updateFolderNotificationFinish'));
    document.querySelector('.compendium-pack[data-pack=\''+packCode+'\']').click();
    pack.render(true);
}
async function createNewFolderWithinCompendium(folderObj){
     // Exporting temp entity to allow for empty folders being editable
     let pack = game.packs.get(folderObj.packCode);
     let path = folderObj.name;
     if (folderObj.path != null && folderObj.path.length>0){
         path = folderObj.path+'/'+folderObj.name
     }
     let tempData = getTempEntityData(pack.entity);
     tempData.flags.cf={
         id:folderObj.id,
         path:path,
         color:folderObj.color,
         name:folderObj.name
     }
     await pack.createEntity(tempData);
     console.log(`Created temp entity for folder in ${pack.collection}`);
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
                    game.settings.set(mod,'cfolders',importJson).then(function(){
                        refreshFolders();
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
        return "Move Folder: "+this.object.titleText;
    }
    async getData(options) { 
        let formData = []
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
        formData.sort(function(first,second){
            let fullFirst = "";
            let fullSecond = "";
            for(let firstPath of first['titlePath']){
                fullFirst = fullFirst+firstPath+'/'
            }
            for (let secondPath of second['titlePath']){
                fullSecond = fullSecond+secondPath+'/'
            }
            fullFirst = fullFirst+first['titleText'];
            fullSecond = fullSecond+second['titleText'];
            if (fullFirst < fullSecond){
                return -1
            } else if (fullFirst > fullSecond){
                return 1;
            }
            return 0;
        });
        if (this.object.pathToFolder != null && this.object.pathToFolder.length>0){
            formData.splice(0,0,{
                'titleText':'Root',
                'titlePath':'Root',
                'fullPathTitle':'Root',
                'id':'root'
            })
        }
        let temp = Array.from(formData);
        for (let obj of temp){
            if (obj.id!='root' &&(
                // If formData contains folders which are direct parents of this.object
                (this.object.pathToFolder != null
                && this.object.pathToFolder.length>0
                && obj.id === this.object.pathToFolder[this.object.pathToFolder.length-1])
                // or If formData contains folders where this.object is directly on the path
                || (allFolders[obj.id].pathToFolder != null
                    && allFolders[obj.id].pathToFolder.includes(this.object._id))
                // or If formData contains this.object
                || obj.id === this.object._id))
                formData.splice(formData.indexOf(obj),1);
            }

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
        moveFolder(this.object._id,destFolderId,true);
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
        submitText: game.i18n.localize( this.object.colorText.length>1   ? "FOLDER.Update" : "FOLDER.Create"),
        deleteText: (this.object.colorText.length>1 && this.object._id != 'default') ?"Delete Folder":null
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
        if (formData.fontColor.length === 0){
            this.object.fontColorText = '#FFFFFF'
        }else{
            this.object.fontColorText = formData.fontColor;
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
        

        // Update compendium assignment
        let packsToAdd = []
        let packsToRemove = []
        for (let packKey of game.packs.keys()){
            let formName = game.packs.get(packKey).metadata.package+game.packs.get(packKey).metadata.name;
            if (formData[formName] && !this.object.compendiumList.includes(packKey)){
                // Box ticked AND compendium not in folder
                packsToAdd.push(packKey);
            
            }else if (!formData[formName] && this.object.compendiumList.includes(packKey)){
                // Box unticked AND compendium in folder
                packsToRemove.push(packKey);
            }
        }
        if (formData.delete != null && formData.delete[0]==1){
            //do delete stuff
            new Dialog({
                title: game.i18n.localize("CF.deleteFolder"),
                content: "<p>"+game.i18n.localize("CF.deletePromptL1").replace('{folderName}',this.object.titleText)+"</p>"
                        +"<p>"+game.i18n.localize("CF.deletePromptL2")+"</p>"
                        +"<p><i>"+game.i18n.localize("CF.deletePromptL3")+"</i></p>",
                buttons: {
                    yes: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "Yes",
                        callback: () => deleteAllChildFolders(this.object)
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
            id:this.object.id
        };
    }
    async _updateObject(options,formData){
        let folderObj = {
            id:this.object.id,
            oldName:this.object.name,
            newName:formData.name,
            newColor:formData.color,
            path:this.object.path,
            packCode:this.object.packCode
        }
        updateFolderWithinCompendium(folderObj);
                
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
            name:formData.name.replace('/','|'),
            color:formData.color,
            path:this.object.path,
            packCode:this.object.packCode
        }
        createNewFolderWithinCompendium(folderObj);        
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
    new CompendiumFolderEditConfig(allFolders[folderId]).render(true);   
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
   
    let newFolder = new CompendiumFolder('New Folder','',path);
    new CompendiumFolderEditConfig(newFolder).render(true);
}
function showMoveDialog(folder,event){
    let folderId = folder.getAttribute('data-cfolder-id');
    let folderRawObject = game.settings.get(mod,'cfolders')[folderId];
    let folderObject = new CompendiumFolder('','');
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
function addExportButton(folder){
    let newButton = document.createElement('i');
    newButton.classList.add('fas','fa-upload');
    let link = document.createElement('a');
    link.setAttribute('title',"Export Folder Structure")
    link.setAttribute('data-folder',folder.parentElement.getAttribute('data-folder-id'));
    link.classList.add('export-folder');
    link.appendChild(newButton);
    link.addEventListener('click',async function(event){
        event.stopPropagation();
        
        await exportFolderStructureToCompendium(this.getAttribute('data-folder'));
    });
    folder.insertAdjacentElement('beforeend',link);
}
// Mostly taken from foundry.js 
async function exportFolderStructureToCompendium(folderId){
    
    let folder = game.folders.get(folderId);
    
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
            await recursivelyExportFolders(index,pack,folder,generateRandomFolderName('temp_'),form.merge.checked)
            ui.notifications.notify(game.i18n.localize('CF.exportFolderNotificationFinish'));
            pack.render(true);
        },
        options:{}
    });

    
}
async function recursivelyExportFolders(index,pack,folderObj,folderId,merge){
    if (folderObj.children.length==0){
        let entities = folderObj.content;
        let updatedFolder = await exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,merge)
        if (updatedFolder != null){
            return [updatedFolder];
        }
        return []
    }
    for (let child of folderObj.children){
        await recursivelyExportFolders(index,pack,child,generateRandomFolderName('temp_'),merge)
    }
    let entities = folderObj.content;
    
    await exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,merge)
}
async function exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId,merge){
    let path = getFullPath(folderObj)
    let color = '#000000'
    if (folderObj.data.color != null && folderObj.data.color.length>0){
        color = folderObj.data.color;
    }
    for ( let e of entities ) {
        let data = await e.toCompendium();
        data.flags.cf={
            id:folderId,
            path:path,
            color:color
        }
        let existing = merge ? index.find(i => i.name === data.name) : index.find(i => i._id === e.id);
        if ( existing ) data._id = existing._id;
        if ( data._id ) await pack.updateEntity(data);
        else pack.createEntity(data).then(result => {
            if (result.id != e.id && folderObj.contents != null && folderObj.contents.length>0){
                folderObj.contents.splice(folderObj.contents.findIndex((x => x.id==e.id)),1,result.id);
            }
        });
        console.log(`Exported ${e.name} to ${pack.collection}`);
    }
    // Exporting temp entity to allow for empty folders being editable
    let tempData = getTempEntityData(pack.entity);
    tempData.flags.cf={
        id:folderId,
        path:path,
        color:color,
        name:folderObj.name
    }
    await pack.createEntity(tempData);
    console.log(`Exported temp entity to ${pack.collection}`);
    
    return folderObj
}
async function importFromCollectionWithMerge(clsColl,collection, entryId, folderPath, updateData={}, options={},merge=false) {
    const entName = clsColl.object.entity;
    const pack = game.packs.get(collection);
    if (pack.metadata.entity !== entName) return;

    // Prepare the source data from which to create the Entity
    const source = await pack.getEntity(entryId);
    let createData = mergeObject(clsColl.fromCompendium(source.data), updateData);
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
    for (let entry of folder.querySelectorAll(':scope > .folder-contents > .entry-list > li.directory-item')){
        // Will invoke importFolderData()
        await importFromCollectionWithMerge(coll,pack.collection,entry.getAttribute('data-entry-id'),getRenderedFolderPath(folder), {}, {renderSheet:false},merge)
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
        while (!parent.parentElement.classList.contains('directory-list')){
            parent = parent.parentElement.parentElement.parentElement
            parentList.push(parent);            
        }
        parentList.push(parent);

        for (let p of parentList.reverse()){
            await importFromCollectionWithMerge(coll,
                pack.collection,
                p.querySelector(':scope > .folder-contents > .entry-list > li.directory-item.hidden').getAttribute('data-entry-id'),
                getRenderedFolderPath(p),
                {},
                {renderSheet:false},
                merge);

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
            let merge = h[0].querySelector('input[name=\'merge\']').checked
            ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationStart"))
            let packCode = folder.closest('.sidebar-tab.compendium').getAttribute('data-pack');
            let pack = await game.packs.get(packCode);
            let coll = pack.cls.collection;
            await importAllParentFolders(pack,coll,folder,merge);
            await recursivelyImportFolders(pack,coll,folder,merge);
            ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationFinish"));
            removeTempEntities(pack.entity);
        }
    });
    
}
// ==========================
// Folder creation inside compendiums
// ==========================
function createFolderWithinCompendium(folderData,parent,packCode,openFolders){
    //Example of adding folders to compendium view
    let folder = document.createElement('li')
    folder.classList.add('compendium-folder');
    folder.setAttribute('data-folder-id',folderData.id);
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
                    packCode:packCode
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

    //If no folder data, or folder is in open folders AND folder has an id, close folder by default
    if ((openFolders == null || !openFolders.includes(folderData.id)) && folderData.id != "noid"){
        contents.style.display = 'none';
        folder.setAttribute('collapsed','');
        headerTitle.innerHTML = "<i class=\"fas fa-fw fa-folder\"></i>"+folderData.name;
    }else{
        headerTitle.innerHTML = "<i class=\"fas fa-fw fa-folder-open\"></i>"+folderData.name;
    }

    let directoryList = document.querySelector('.sidebar-tab.compendium[data-pack=\''+packCode+'\'] ol.directory-list');
    if (parent != null){
        parent.querySelector('ol.folder-list').insertAdjacentElement('beforeend',folder)
    }else{
        directoryList.insertAdjacentElement('beforeend',folder);
    }

    folder.addEventListener('click',function(event){ toggleFolderInsideCompendium(event,folder,packCode) },false)

    for (let pack of directoryList.querySelectorAll('li.directory-item')){
        pack.addEventListener('click',function(ev){ev.stopPropagation()},false)
    }
    for (let existing of directoryList.querySelectorAll('li.directory-item')){
        let existingId = existing.getAttribute('data-entry-id')
        if (folderData.children != null && folderData.children.includes(existingId)){
            packList.appendChild(existing);
        }
    }
    return folder;
}
async function createFoldersWithinCompendium(allFolderData,packCode,openFolders,tempEntities){
    let createdFolders = {}
    let foldersWithoutTempEntities = []
    for (let path of Object.keys(allFolderData).sort()){
        let segments = path.split('/');
        for (let seg of segments){
            let index = segments.indexOf(seg)
            let currentPath = seg
            if (index>0){
                currentPath = segments.slice(0,index).join('/')+'/'+seg;
            }
            if (!Object.keys(createdFolders).includes(currentPath)){
                //Create folder
                let currentId = 'noid';
                if (allFolderData[currentPath]==null){
                    //If folderData not provided, create blank folder
                    allFolderData[currentPath] = {
                        id:generateRandomFolderName('temp_'),
                        color:'#000000',
                        name:seg,
                        path:currentPath
                    }
                    
                }else{
                    //Update folderData with temp ID and name
                    allFolderData[currentPath].name=seg;
                    allFolderData[currentPath].path=currentPath;
                }
                let parent = null
                if (index>0){
                    parent = createdFolders[segments.slice(0,index).join('/')]
                }                   
                createdFolders[currentPath]=createFolderWithinCompendium(allFolderData[currentPath],parent,packCode,openFolders[packCode]);
            }
        }
    } 
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
    if (e.data.flags.cf != null){
        let path = e.data.flags.cf.path;
        let color = e.data.flags.cf.color;
        //a.data.folder -> id;
        let foundFolder = null;
        let folderExists=false;
        for (let folder of game.folders.values()){
            if (folder.data.type==e.entity){
                if (getFolderPath(folder) === path){
                    folderExists=true;
                    foundFolder=folder;
                }
            }
        }
        if (folderExists){
            await e.update({folder : foundFolder.id,flags:{cf:null}})
        }else{
            await createFolderPath(path,color,e.entity,e);
        }
    }
}
async function createFolderPath(path,pColor,entityType,e){
    let segments = path.split('/');
    let index = 0;
    for (let seg of segments){
        let folderPath = segments.slice(0,index).join('/')+'/'+seg
        if (index==0){
            folderPath = seg
        }
        let results = game.folders.filter(f => f.type === entityType && getFolderPath(f) === folderPath)
        if (results.length==0 ){
            //Create the folder if it does not exist
            let parentId = null
            let tContent = [];
            if (index>0){
                parentId = game.folders.filter(f => f.type===entityType && f.name===segments[index-1] && getFolderPath(f)===segments.slice(0,index).join('/'))[0]
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
        game.settings.register(mod,'last-search',{
            scope:'client',
            config:false,
            type:String,
            default:""
        });
        game.settings.register(mod,'converted-folders',{
            scope:'world',
            config:false,
            type:Boolean,
            default:false
        })
        game.settings.register(mod,'converted-packs',{
            scope:'world',
            config:false,
            type:Object,
            default:[]
        })
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
    static async doFolderConversions(){
        if (game.user.isGM){
            console.log(modName + ' | Checking for old compendium folder formats...')
            let convertedPacks = game.settings.get(mod,'converted-packs')
            for (let packCode of game.packs.keys()){
                try{
                    let pack = game.packs.get(packCode);
                    
                    if (convertedPacks.includes(packCode)){
                        console.debug(modName + ' | Compendium '+packCode+' already converted, skipping')
                        continue;
                    }
                    if (!pack.locked){
                        convertedPacks.push(packCode);
                        let allFolderData = {}
                        let content = await pack.getContent()
                        let folderEntities = content.filter(x => x.data.flags != null && x.data.flags.cf != null);
                        if (folderEntities.length === 0){
                            continue;
                        }
                        for (let entry of folderEntities){
                            let path = entry.data.flags.cf.path;
                            let name = path.split('/')[path.split('/').length-1]
                            let color = entry.data.flags.cf.color;
                            let folderId = entry.data.flags.cf.id;
                            let entryId = entry._id
                            if (allFolderData[path] == null){
                                allFolderData[path] = {id:folderId,color:color, children:[entryId],name:name}
                            }else{
                                allFolderData[path].children.push(entryId);
                            }
                        }
                        let finishedPaths = [];
                        for (let path of Object.keys(allFolderData).sort()){
                            let segments = path.split('/');
                            for (let seg of segments){
                                let index = segments.indexOf(seg)
                                let currentPath = seg
                                if (index>0){
                                    currentPath = segments.slice(0,index).join('/')+'/'+seg;
                                }
                                let tempEntity = content.find(x => x.data.flags != null && x.data.flags.cf != null && x.data.flags.cf.path === currentPath && x.name === TEMP_ENTITY_NAME)
                                let entities = content.find(x => x.data.flags != null && x.data.flags.cf != null && x.data.flags.cf.path === currentPath)
                                if (tempEntity == null && !finishedPaths.includes(currentPath)){
                                    
                                    let tempData = getTempEntityData(pack.entity);
                                    let folderId = generateRandomFolderName('temp_');
                                    let folderColor = '#000000'
                                    let folderName = seg;
                                    if (entities != null && entities.data.flags.cf.id != null){
                                        folderId = entities.data.flags.cf.id;
                                        folderColor = entities.data.flags.cf.color;
                                    }
                                    tempData.flags.cf={
                                        id:folderId,
                                        path:currentPath,
                                        color:folderColor,
                                        name:folderName
                                    }
                                    await pack.createEntity(tempData);
                                    console.log(`${modName} | Created temp entity for folder ${folderName} in ${pack.collection}`);
                                    finishedPaths.push(currentPath);
                                }
                            }
                        }
                    } 
                
                }catch (e){
                    console.debug(modName + ' | Could not convert pack '+packCode+', skipping')
                    continue;
                }
            }
            console.log(modName+' | Check complete!')
            
            await game.settings.set(mod,'converted-packs',convertedPacks);
        }
    }
}
// ==========================
// Main hook setup
// ==========================
var eventsSetup = []

Hooks.once('setup',async function(){
    let hooks = ['renderCompendiumDirectory','renderCompendiumDirectoryPF'];
    let post073 = game.data.version >= '0.7.3';
    let hasFICChanges = game.modules.get(mod).data.version >= '2.0.0';
    Settings.registerSettings()
    for (let hook of hooks){
        Hooks.on(hook, async function() {
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
                        setupFolders(prefix)
                    }
                    addEventListeners(prefix)
                });
            }else{
                if (Object.keys(allFolders).length <= 2 && allFolders.constructor === Object){
                    convertExistingSubmenusToFolder(prefix);
                }else{
                    setupFolders(prefix)
                }
                addEventListeners(prefix)
            }   
        });
    }
    if (post073 && hasFICChanges){
        Hooks.on('ready',async function(){
            await Settings.doFolderConversions();
        })
        Hooks.on('renderCompendium',async function(e){
            let packCode = e.metadata.package+'.'+e.metadata.name;
            let window = e._element[0]
            removeStaleOpenFolderSettings(packCode);
            let contents = await e.getContent();
            let tempEntities = contents.filter(x => x.name === TEMP_ENTITY_NAME)
            
            let allFolderData={};
            //First parse folder data
            for (let entry of contents){
                if (entry != null && entry.data.flags.cf != null && entry.data.flags.cf.path != null){
                    let path = entry.data.flags.cf.path;
                    let name = path.split('/')[path.split('/').length-1]
                    let color = entry.data.flags.cf.color;
                    let folderId = entry.data.flags.cf.id;
                    let entryId = entry._id
                    if (allFolderData[path] == null){
                        allFolderData[path] = {id:folderId,color:color, children:[entryId],name:name}
                    }else{
                        allFolderData[path].children.push(entryId);
                    }
                }
            }
            if (Object.keys(allFolderData).length === 0 && allFolderData.constructor === Object){
                return;
            }
            console.log(modName+' | Creating folder structure inside compendium.');
            let openFolders = game.settings.get(mod,'open-temp-folders');
            await createFoldersWithinCompendium(allFolderData,packCode,openFolders,tempEntities);
            createNewFolderButtonWithinCompendium(window,packCode);
            if (game.user.isGM){
                // Moving between folders
                let hiddenMoveField = document.createElement('input');
                hiddenMoveField.type='hidden'
                hiddenMoveField.style.display='none';
                hiddenMoveField.classList.add('folder-to-move');
                window.querySelector('ol.directory-list').appendChild(hiddenMoveField);
                
                for (let entity of window.querySelectorAll('.directory-item')){
                    if (entity.querySelector('h4').innerText.includes(TEMP_ENTITY_NAME)){
                        entity.style.display = 'none';
                        entity.classList.add('hidden')
                    }
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
                            let entryInFolderElement = this.querySelector(':scope > div.folder-contents > ol.entry-list > li.directory-item')

                            let packCode = this.closest('.sidebar-tab.compendium').getAttribute('data-pack');
                            let p = game.packs.get(packCode);
    
                            let folderData = null;
                            if (entryInFolderElement != null){
                                let entryInFolder = await p.getEntry(entryInFolderElement.getAttribute('data-entry-id'));
                                folderData = entryInFolder.flags.cf;
                            }else{
                                //Create new folder
                                folderData = {
                                    id:generateRandomFolderName('temp_'),
                                    path:getRenderedFolderPath(this),
                                    color:'#000000'
                                }
                            }                             

                            let data = {
                                _id:movingItemId,
                                flags:{
                                    cf:folderData
                                }
                            }
                                                        
                            await p.updateEntity(data)
                        }
                    })
                }
            }
            let newSearchBar = window.querySelector('input[name=\'search2\']')
            if (newSearchBar.value.length>0){
                filterSelectorBySearchTerm(window,newSearchBar.value,'.directory-item')
            }
            
        })

        Hooks.on('renderApplication',async function(a){
            //When compendium window renders, recreate the search bar and register custom listener
            if (a.template != null && a.template === 'templates/apps/compendium.html'){
                let pack = game.packs.get(a.collection);
                let contents = await pack.getContent()
                if (!contents.some(e => e.name === TEMP_ENTITY_NAME)){
                    return;
                }
                let window = a._element[0]
                let searchBar = window.querySelector('input[name=\'search\']')
                let newSearchBar = document.createElement('input')
                newSearchBar.name='search2';
                newSearchBar.placeholder='Search';
                newSearchBar.type='text';
                newSearchBar.autocomplete='off';
                newSearchBar.value = game.settings.get(mod,'last-search')
                
                newSearchBar.addEventListener('keyup',async function(event){
                    event.stopPropagation();
                    game.settings.set(mod,'last-search',event.currentTarget.value);
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
        Hooks.on('createJournalEntry',async function(j){
            await importFolderData(j);
        })
        Hooks.on('createScene',async function(s){
            await importFolderData(s);
        })
        Hooks.on('createItem',async function(i){
            await importFolderData(i);
        })
        Hooks.on('createRollTable',async function(r){
            await importFolderData(r);
        })
        
        Hooks.on('updateActor',async function(a){
            await importFolderData(a);
        })
        Hooks.on('updateJournalEntry',async function(j){
            await importFolderData(j);
        })
        Hooks.on('updateScene',async function(s){
            await importFolderData(s);
        })
        Hooks.on('updateItem',async function(i){
            await importFolderData(i);
        })
        Hooks.on('updateRollTable',async function(r){
            await importFolderData(r);
        })

        // Adding the export button to all folders
        // ONLY if it contains an entity (either direct child or in child folder)
        Hooks.on('renderActorDirectory',async function(){
            for (let folder of document.querySelectorAll('.directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null //
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder);
                }
            }
        })
        Hooks.on('renderJournalDirectory',async function(){
            for (let folder of document.querySelectorAll('#journal .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null//
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder);
                }
            }
        })
        Hooks.on('renderSceneDirectory',async function(){
            for (let folder of document.querySelectorAll('#scenes .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null//
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder);
                } 
            }
        })
        Hooks.on('renderItemDirectory',async function(){
            for (let folder of document.querySelectorAll('#items .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null//
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder);
                } 
            }
        })
        Hooks.on('renderRollTableDirectory',async function(){
            for (let folder of document.querySelectorAll('#tables .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null//
                    && folder.parentElement.querySelector(':scope > ol.subdirectory').querySelector('.directory-item.entity') != null
                    && game.user.isGM){
                    addExportButton(folder);
                }  
            }
        })
    }
});
