export const modName = 'Compendium Folders';
const mod = 'compendium-folders';
const FOLDER_LIMIT = 8
const PATH_EXP = /(?<= \|\#CF\[.*name\=\").+(?=\"\,color)/
const COLOR_EXP = /(?<=\,color\=\")\#[\d\w]{6}/
const ID_EXP = /(?<= \|\#CF\[id=\")temp_.*(?=\",name)/
const NAME_EXP = /.*(?= \|\#CF\[.*\])/

// ==========================
// Utility functions
// ==========================
function getFullPath(folderObj){
    let path = folderObj.name;
    let currentFolder = folderObj;
    while (currentFolder.parent != null){
        currentFolder = currentFolder.parent;
        path = currentFolder.name+'/'+path;
    }
    return path;
}
async function removeStaleFolderSettings(packCode){
    let openFolders = game.settings.get(mod,'open-temp-folders')
    let newSettings = {}
    newSettings[packCode]=openFolders[packCode];
    await game.settings.set(mod,'open-temp-folders',newSettings);
}
function getFolderPath(folder){
    let path = folder.data.name;
    let currentFolder = folder;
    while (currentFolder.parent != null){
        path = currentFolder.parent.data.name+'/'+path;
        currentFolder = currentFolder.parent;
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
function getMaxDepth(){
    let allFolders = game.settings.get(mod,'cfolders');
    let maxDepth = 1;
    Object.keys(allFolders).forEach(function(key){
        if (allFolders[key].pathToFolder != null
            && allFolders[key].pathToFolder.length > maxDepth){
                maxDepth = allFolders[key].pathToFolder.length;
        };
    });
    return maxDepth;
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
    let compendiumNames = []
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
            compendium.style.display='';
            compendium.removeAttribute('search-failed')
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
                compendium.style.display='';
                compendium.removeAttribute('search-failed')
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
    for (let folder of document.querySelectorAll(prefix+'.sidebar-tab[data-tab=compendium] > ol > li.compendium-folder')){
        let folderId = folder.getAttribute('data-cfolder-id');
        if (allFolders[folderId].titleText > defaultFolder.titleText){
            folder.insertAdjacentElement('beforebegin',folderObject);
            return;
        }
    }
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
    updateFullPathForChildren(allFolders,parentFolderId,fullPath){
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

        let allFolders = game.settings.get(mod,'cfolders');
        let success = false;
        if (destFolderId != null && destFolderId.length>0){
            let notificationDest = ""
            if (destFolderId=='root'){
                allFolders[this.object._id]['pathToFolder'] = []
                success = this.updateFullPathForChildren(allFolders,this.object._id,[])
                notificationDest="Root";
            }else{
                let destParentPath = (allFolders[destFolderId]['pathToFolder']==null)?[]:allFolders[destFolderId]['pathToFolder']
                let fullPath = destParentPath.concat([destFolderId]);
                allFolders[this.object._id]['pathToFolder'] = fullPath;
                success = this.updateFullPathForChildren(allFolders,this.object._id,fullPath)
                notificationDest = allFolders[destFolderId].titleText;
            }
            if (success==true){
                ui.notifications.info(game.i18n.localize('CF.moveFolderNotification').replace('{src}',this.object.titleText).replace('{dest}',notificationDest))
                await game.settings.set(mod,'cfolders',allFolders);
                refreshFolders();
            }else{
                ui.notifications.error(game.i18n.localize('CF.folderDepthError')+" ("+FOLDER_LIMIT+")")
            }
        }
        
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
            await recursivelyExportFolders(index,pack,folder,generateRandomFolderName('temp_'))
            ui.notifications.notify(game.i18n.localize('CF.exportFolderNotificationFinish'));
        },
        options:{}
    });

    
}
async function recursivelyExportFolders(index,pack,folderObj,folderId){
    if (folderObj.children.length==0){
        let entities = folderObj.content;
        let updatedFolder = await exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId)
        return [updatedFolder];
    }
    for (let child of folderObj.children){
        await recursivelyExportFolders(index,pack,child,generateRandomFolderName('temp_'))
    }
    let entities = folderObj.content;
    
    await exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId)
}
async function exportSingleFolderToCompendium(index,pack,entities,folderObj,folderId){
    let path = getFullPath(folderObj)
    for ( let e of entities ) {
        let data = await e.toCompendium();
        let color = '#000000'
        if (folderObj.data.color != null && folderObj.data.color.length>0){
            color = folderObj.data.color;
        }
        data.name =  data.name+' |#CF[id=\"'+folderId+'\",name="'+path+'",color="'+color+'"]';
        let existing = index.find(i => i.name === data.name);
        if ( existing ) data._id = existing._id;
        if ( data._id ) await pack.updateEntity(data);
        else pack.createEntity(data).then(result => {
            if (result.id != e.id && folderObj.contents != null && folderObj.contents.length>0){
                folderObj.contents.splice(folderObj.contents.findIndex((x => x.id==e.id)),1,result.id);
            }
        });
        console.log(`Exported ${e.name} to ${pack.collection}`);
    }
    return folderObj
}

// ==========================
// Importing folders from compendiums
// ==========================
async function recursivelyImportFolders(pack,coll,folder){
    //First import immediate children
    for (let entry of folder.querySelectorAll(':scope > .folder-contents > .entry-list > li.directory-item')){
        // Will invoke importFolderData()
        await coll.importFromCollection(pack.collection,entry.getAttribute('data-entry-id'), {}, {renderSheet:false})
        
    }
    //Then loop through individual folders
    let childFolders = folder.querySelectorAll(':scope > .folder-contents > .folder-list > li.compendium-folder');
    if (childFolders.length>0){
        for (let child of childFolders){
            await recursivelyImportFolders(pack,coll,child);
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
        content: `<p>${l1}</p>
            <p>${l2}</p>
            <ul><li>${l3}</li><li>${l4}</li></ul>`,
        yes: async () => {
            ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationStart"))
            let packCode = folder.closest('.sidebar-tab.compendium').getAttribute('data-pack');
            let pack = await game.packs.get(packCode);
            let coll = pack.cls.collection;

            await recursivelyImportFolders(pack,coll,folder);
            ui.notifications.notify(game.i18n.localize("CF.importFolderNotificationFinish"));
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
    let header = document.createElement('header');
    header.classList.add('compendium-folder-header','flexrow')
    let headerTitle = document.createElement('h3');
    
    header.style.color='#ffffff';
    header.style.backgroundColor=folderData.color
    let contents = document.createElement('div');
    contents.classList.add('folder-contents');
    contents.setAttribute("data-pack",packCode);
    
    let folderList = document.createElement('ol');
    folderList.classList.add('folder-list');
    let packList = document.createElement('ol');
    packList.classList.add('entry-list');
    
    let importButton = document.createElement('a');
    importButton.innerHTML = "<i class='fas fa-upload fa-fw'></i>"
    importButton.classList.add('import-folder');
    importButton.setAttribute('title',game.i18n.localize("CF.importFolderHint"))
    importButton.addEventListener('click',event => importFolderFromCompendium(event,folder));

    folder.appendChild(header);
    header.appendChild(headerTitle);
    header.appendChild(importButton)
    folder.appendChild(contents);
    contents.appendChild(folderList);
    contents.appendChild(packList);

    //If no folder data, or folder is in open folders AND folder has an id
    if ((openFolders == null || !openFolders.includes(folderData.id)) && folderData.id != "noid"){
        contents.style.display = 'none';
        folder.setAttribute('collapsed','');
        headerTitle.innerHTML = "<i class=\"fas fa-fw fa-folder\"></i>"+folderData.name;
    }else{
        headerTitle.innerHTML = "<i class=\"fas fa-fw fa-folder-open\"></i>"+folderData.name;
    }

    let directoryList = document.querySelector('.sidebar-tab.compendium[data-pack=\''+packCode+'\'] ol.directory-list');
    if (parentId != null){
        directoryList.querySelector('li.compendium-folder[data-folder-id=\''+parentId+'\'] ol.folder-list').insertAdjacentElement('beforeend',folder)
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
}

//==========================
// Used to update entity when imported from compendium
// To keep folder parent and remove folderdata from name
// ==========================
async function importFolderData(e){
    let path = PATH_EXP.exec(e.name);
    let color = COLOR_EXP.exec(e.name);
    
    if (path != null && color != null){
        let correctName = NAME_EXP.exec(e.name);
        if (correctName != null){
            await e.update({name:correctName});
        }  
        
        console.log(e);
        //a.data.folder -> id;
        let foundFolder = null;
        let folderExists=false;
        for (let folder of game.folders.values()){
            if (folder.data.type==e.entity){
                if (getFolderPath(folder) === path[0]){
                    folderExists=true;
                    foundFolder=folder;
                }
            }
        }
        if (folderExists){
            await e.update({folder : foundFolder.id})
        }else{
            await createFolderPath(path[0],color[0],e.entity,e);
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
                await e.update({folder:f.id});
            }
        }
        index++;
    }
}

async function cleanupCompendium(pack){
    ui.notifications.notify(game.i18n.format("CF.cleanupNotificationStart"),{pack:pack})
    let allData = await game.packs.get(pack).getData();
    for (let entry of allData.index){
        if (PATH_EXP.exec(entry.name) != null){
            entry.name = NAME_EXP.exec(entry.name)[0];
            await game.packs.get(pack).updateEntity(entry);
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
        //do cleanup pack
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
// ==========================
// Main hook setup
// ==========================
var eventsSetup = []

Hooks.once('setup',async function(){
    let hooks = ['renderCompendiumDirectory','renderCompendiumDirectoryPF'];
    let post073 = game.data.version >= '0.7.3';
    let hasFICChanges = game.modules.get(mod).data.version >= '2.0.0';
    for (let hook of hooks){
        Hooks.on(hook, async function() {

            Settings.registerSettings()
            
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
        Hooks.on('renderCompendium',async function(e){
            let packCode = e.metadata.package+'.'+e.metadata.name;
            removeStaleFolderSettings(packCode);
            let allFolderData={};
            //First parse folder data
            for (let entry of document.querySelectorAll('.sidebar-tab.compendium .directory-item')){
                let eId = entry.getAttribute('data-entry-id');
                let name = entry.querySelector('h4.entry-name > a').textContent;
                let nameResult = NAME_EXP.exec(name);
                let folderId = ID_EXP.exec(name);
                if (nameResult != null){
                    entry.querySelector('h4.entry-name > a').textContent = nameResult[0]
                }
                let pathResult = PATH_EXP.exec(name);
                let colorResult = COLOR_EXP.exec(name);
                if (pathResult != null && colorResult != null){
                    if (allFolderData[pathResult[0]] == null){
                        allFolderData[pathResult[0]] = {id:folderId[0],color:colorResult[0], children:[eId]}
                    }else{
                        allFolderData[pathResult[0]].children.push(eId);
                    }
                }
            }
            let createdFolders = []
            let openFolders = await game.settings.get(mod,'open-temp-folders');
            for (let path of Object.keys(allFolderData).sort()){
                let segments = path.split('/');
                for (let seg of segments){
                    let index = segments.indexOf(seg)
                    let currentPath = seg
                    if (index>0){
                        currentPath = segments.slice(0,index).join('/')+'/'+seg;
                    }
                    if (!createdFolders.includes(currentPath)){
                        //Create folder
                        let currentId = 'noid';
                        if (allFolderData[currentPath]==null){
                            //If folderData not provided, create blank folder
                            allFolderData[currentPath] = {
                                id:currentId,
                                color:'#000000',
                                name:seg
                            }
                        }else{
                            //Update folderData with temp ID and name
                            allFolderData[currentPath].name=seg;
                        }
                        let parentId = null
                        if (index>0){
                            parentId = allFolderData[segments.slice(0,index).join('/')].id
                        }   
                        createFolderWithinCompendium(allFolderData[currentPath],parentId,packCode,openFolders[packCode])
                        
                        createdFolders.push(currentPath);
                    }
                }
            }        
        })
        Hooks.on('renderApplication',async function(a){
            if (a.template != null && a.template === 'templates/apps/compendium.html'){
                let window = a._element[0]
                let searchBar = window.querySelector('input[name=\'search\']')
                let newSearchBar = document.createElement('input')
                newSearchBar.name='search2';
                newSearchBar.placeholder='Search';
                newSearchBar.type='text';
                newSearchBar.autocomplete='off';
                newSearchBar.addEventListener('keyup',async function(event){
                    event.stopPropagation();
                    filterSelectorBySearchTerm(window,event.currentTarget.value,'.directory-item')
                })
                let header = searchBar.parentElement;
                header.replaceChild(newSearchBar,searchBar);
            }
        });
        // Hooking into the creation methods to remove
        // folder data from the name of the entity
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

        // Adding the export button to all folders
        Hooks.on('renderActorDirectory',async function(){
            for (let folder of document.querySelectorAll('.directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null){
                    addExportButton(folder);
                }
            }
        })
        Hooks.on('renderJournalDirectory',async function(){
            for (let folder of document.querySelectorAll('#journal .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null){
                    addExportButton(folder);
                }
            }
        })
        Hooks.on('renderSceneDirectory',async function(){
            for (let folder of document.querySelectorAll('#scenes .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null){
                    addExportButton(folder);
                } 
            }
        })
        Hooks.on('renderItemDirectory',async function(){
            for (let folder of document.querySelectorAll('#items .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null){
                    addExportButton(folder);
                } 
            }
        })
        Hooks.on('renderRollTableDirectory',async function(){
            for (let folder of document.querySelectorAll('#tables .directory-item > .folder-header')){
                if (folder.querySelector('a.export-folder')==null){
                    addExportButton(folder);
                }  
            }
        })
    }
});
