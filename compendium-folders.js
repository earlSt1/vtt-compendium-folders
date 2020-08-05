export const modName = 'Compendium Folders';
const mod = 'compendium-folders';



// ==========================
// Utility functions
// ==========================
function generateRandomFolderName(){
    return Math.random().toString(36).replace('0.','cfolder_' || '');
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
    // let items = Object.keys(folders).map(function(key) {
    //     return [key, folders[key]];
    //   });
    folders.sort(function(first,second){
        if (first['titleText']<second['titleText']){
            return -1;
        }
        if ( first['titleText'] > second['titleText']){
          return 1;
        }
        return 0;
    })
    // let sortedFolders = {}
    // for (let item of items){
    //     sortedFolders[item[0]]=item[1];
    // }
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
    
    let allCompendiums = Array.from(game.packs.keys())
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
    });
    if (game.user.isGM){
        game.settings.set(mod,'cfolders',allFolders);
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
        this.uid=generateRandomFolderName();
        this.pathToFolder = path;
    }
    initFromExisting(existing){
        this.title = existing['titleText'];
        this.color = existing['colorText']
        this.compendiums = existing['compendiumList'];
        this.folders = existing['folders'];
        this.uid = existing['uid'];
        this.path = existing['pathToFolder'];
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
    
    let newFolderIcon = document.createElement('i');
    let newFolderLink = document.createElement('a');
    newFolderIcon.classList.add('fas','fa-folder-plus');
    newFolderLink.classList.add('create-folder');

    newFolderLink.appendChild(newFolderIcon);


    let cogIcon = document.createElement('i')
    cogIcon.classList.add('fas','fa-cog','fa-fw')
    let cogLink = document.createElement('a')
    cogLink.classList.add('edit-folder')
    cogLink.appendChild(cogIcon)
    header.appendChild(title)
    header.appendChild(cogLink)
    header.appendChild(newFolderLink);
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
function filterCompendiumsBySearchTerm(searchTerm){
    if (searchTerm == null || searchTerm.length==0){
        for (let compendium of document.querySelectorAll('.compendium-pack')){
            //Show all
            compendium.style.display='';
            compendium.removeAttribute('search-failed')
        }
        document.querySelectorAll('.compendium-folder').forEach(function(folder){
            folder.style.display='';
            closeFolder(folder);
        });
    }else{
        for (let compendium of document.querySelectorAll('.compendium-pack')){
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
        document.querySelectorAll('.compendium-folder').forEach(function(folder){
            let shouldHide = true;
            folder.querySelectorAll('.compendium-pack').forEach(function(comp){
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

        searchBar.addEventListener('keyup',function(event){
            filterCompendiumsBySearchTerm(event.target.value);
        });

        let collapseLink = document.createElement('a');
        collapseLink.classList.add('header-control','collapse-all');
        collapseLink.title='Collapse all Folders';
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
        header.appendChild(searchDiv);
        header.appendChild(collapseLink);
        tab.insertAdjacentElement('afterbegin',header);
    }

}
// ==========================
// Creation functions

function createNewFolder(path){
    new CompendiumFolderConfig(new CompendiumFolder('New Folder','',path)).render(true) 
}

function createFolderFromObject(parent,compendiumFolder, compendiumElements,prefix,wasOpen){
    let folder = document.createElement('li')
    folder.classList.add('compendium-entity','compendium-folder')
    let header = document.createElement('header')
    header.classList.add('compendium-folder-header', 'flexrow')
    header.style.backgroundColor = compendiumFolder.colorText;

    let folderIcon = document.createElement('i')
    folderIcon.classList.add('fas','fa-fw')
    let cogIcon = document.createElement('i')
    cogIcon.classList.add('fas','fa-cog','fa-fw')
    let cogLink = document.createElement('a')
    cogLink.classList.add('edit-folder')
    cogLink.appendChild(cogIcon)

    let newFolderIcon = document.createElement('i');
    let newFolderLink = document.createElement('a');
    newFolderIcon.classList.add('fas','fa-folder-plus');
    newFolderLink.classList.add('create-folder');

    newFolderLink.appendChild(newFolderIcon);

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
    if (!wasOpen){
        contents.style.display='none';
        //packList.style.display='none';
        //folderList.style.display='none';
        cogLink.style.display='none';
        newFolderLink.style.display='none';
        folderIcon.classList.add('fa-folder');
        folder.setAttribute('collapsed','');
    }else{
        folderIcon.classList.add('fa-folder-open');
    }
    

    let title = document.createElement('h3')
    title.innerHTML = folderIcon.outerHTML+compendiumFolder.titleText;
    
    header.appendChild(title);
    header.appendChild(newFolderLink);
    header.appendChild(cogLink);
    folder.appendChild(header);
    // folder.appendChild(folderList);
    // folder.appendChild(packList);
    folder.appendChild(contents);

    folder.setAttribute('data-cfolder-id',compendiumFolder._id);
    parent.appendChild(folder)
}


function createHiddenFolder(prefix,allCompendiumElementsDict){
    let tab = document.querySelector(prefix+'.sidebar-tab[data-tab=compendium]')
    if (document.querySelector('.hidden-compendiums')==null){
        let folder = document.createElement('ol')
        folder.classList.add('hidden-compendiums');
        folder.style.display='none';
        Object.keys(allCompendiumElementsDict).forEach(function(key){
            console.log(modName+" | Adding "+key+" to hidden-compendiums");
            folder.appendChild(allCompendiumElementsDict[key]);  
        });
        tab.querySelector(prefix+'ol.directory-list').appendChild(folder);   
    }
}

/*
* Main setup function for Compendium Folders
* Takes a prefix (a selector to determine whether to modify the Sidebar or Popup window)
* and a list of previously open folders
*/
function setupFolders(prefix,openFolders){

    let allFolders = checkForDeletedCompendiums();
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

    // For nesting folders, group by depth first.
    // let depth = folder.pathToFolder.length
    // Grouped folders are format {depth:[folders]}
    let groupedFolders = {}
    let parentFolders = [];
    Object.keys(allFolders).forEach(function(key) {
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
      });
    Object.keys(groupedFolders).sort().forEach(function(depth){
        // Now loop through folder compendiums, get them from dict, add to local list, then pass to createFolder
        for (let groupedFolder of alphaSortFolders(groupedFolders[depth])){
            if (groupedFolder.titleText != 'hidden-compendiums'){

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
        }
    });
    // Create hidden compendium folder
    // Add any remaining compendiums to this folder (newly added compendiums)
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
        button.addEventListener('click',function(){createNewFolder([])});
        let folderIcon = document.createElement('i')
        folderIcon.classList.add('fas','fa-fw','fa-folder')
        button.innerHTML = folderIcon.outerHTML+game.i18n.localize("FOLDER.Create");
        document.querySelector(prefix+'#compendium .directory-footer').appendChild(button);
    }
    // Hide all empty lists
    for (let element of document.querySelectorAll('.folder-contents > ol')){
        if (element.innerHTML.length===0){
            element.style.display="none";
        }
    }

    // TODO directory header
    createDirectoryHeader();
    
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
            // Box ticked AND compendium not in folder
            packsToAdd.push(packKey);
            
          }else if (!formData[packKey] && this.object.compendiumList.indexOf(packKey)>-1){
            // Box unticked AND compendium in folder
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
    if (isPopout){
        // First refresh Popout window, then refresh sidebar
        let allFolders = document.querySelectorAll('#compendium-popout .compendium-folder')
        let openFoldersPopout = [];
        for (let folder of allFolders){
            if (!folder.hasAttribute('collapsed')){
                //folder open
                openFoldersPopout.push(folder.getAttribute('data-cfolder-id'));
            }
        }
        setupFolders('#compendium-popout ',openFoldersPopout);
        addEventListeners('#compendium-popout ');
    }
    let allFolders = document.querySelectorAll('#sidebar .compendium-folder')
        let openFoldersSidebar = [];
        for (let folder of allFolders){
            if (!folder.hasAttribute('collapsed')){
                //folder open
                openFoldersSidebar.push(folder.getAttribute('data-cfolder-id'));
            }
        }
    setupFolders('#sidebar ',openFoldersSidebar);
    addEventListeners('#sidebar ');
}
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
// ==========================
// Event funtions
// ==========================
function closeFolder(parent){
    let folderIcon = parent.querySelector('header > h3 > .fa-folder, .fa-folder-open')
    let cogLink = parent.querySelector('a.edit-folder')
    let newFolderLink = parent.querySelector('a.create-folder');
    let contents = parent.querySelector('.folder-contents');
    if (folderIcon.classList.contains('fa-folder-open')){
        //Closing folder
        folderIcon.classList.remove('fa-folder-open')
        folderIcon.classList.add('fa-folder')
        contents.style.display='none'
        if (game.user.isGM){
            cogLink.style.display='none'
            newFolderLink.style.display='none'
        }
    }
    parent.setAttribute('collapsed','');
}
function openFolder(parent){
    let folderIcon = parent.querySelector('header > h3 > .fa-folder, .fa-folder-open')
    let cogLink = parent.querySelector('a.edit-folder')
    let newFolderLink = parent.querySelector('a.create-folder');
    let contents = parent.querySelector('.folder-contents');
    folderIcon.classList.remove('fa-folder')
    folderIcon.classList.add('fa-folder-open')
    let packs = parent.querySelector('ol.compendium-list')
    contents.style.display=''
    if (game.user.isGM){
        cogLink.style.display=''
        newFolderLink.style.display=''
    }
    parent.removeAttribute('collapsed');
}
function toggleFolder(event,parent){
    event.stopPropagation();
    if (parent.hasAttribute('collapsed')){
        openFolder(parent);
    }else{
        closeFolder(parent);
    }
}
function showEditDialog(submenu,event){
    event.stopPropagation();
    let allFolders = game.settings.get(mod,'cfolders')
    let folderId = submenu.getAttribute('data-cfolder-id')
    new CompendiumFolderConfig(allFolders[folderId]).render(true);   
}
function showCreateDialogWithPath(submenu,event){
    event.stopPropagation();
    let directParent = submenu.getAttribute('data-cfolder-id');
    let path = []
    path.push(directParent);
    let currentElement = submenu;
    while (!currentElement.parentElement.classList.contains('directory-list')){
        currentElement = currentElement.parentElement.parentElement.parentElement;
        path.push(currentElement.getAttribute('data-cfolder-id'));
    }
    path.reverse();
    console.log('path: '+path);
    let allFolders = game.settings.get(mod,'cfolders');
    let newFolder = new CompendiumFolder('New Folder','',path);
    new CompendiumFolderConfig(newFolder).render(true);
}

function addEventListeners(prefix){
    for (let submenu of document.querySelectorAll(prefix+'li.compendium-folder')){
        submenu.addEventListener('click',function(event){ toggleFolder(event,submenu) },false)
        submenu.querySelector('a.edit-folder').addEventListener('click',function(event){showEditDialog(submenu,event)},false)
        submenu.querySelector('a.create-folder').addEventListener('click',function(event){showCreateDialogWithPath(submenu,event)},false);
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
// ==========================
// Main hook setup
// ==========================
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
