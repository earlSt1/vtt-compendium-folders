function deleteExistingRules(){
    var sheet = window.document.styleSheets[0];
    for (var i=sheet.cssRules.length-1;i>=0;i--){
        if (sheet.cssRules[i].selectorText==='#compendium h3'){
            sheet.deleteRule(i);
        }
    }
}
function convertExistingSubmenuToFolder(){
    deleteExistingRules()
    let submenus = document.querySelectorAll('li.compendium-entity');
    while (submenus == null){
        setTimeout(function(){submenus = document.querySelectorAll('li.compendium-entity')},1000)
    }
    //let submenus = document.querySelectorAll('li.compendium-entity')
    for (var submenu of submenus){
        if (submenu.classList.contains('compendium-folder')){
            continue;
        }
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
    // TODO edit dialog
    // let result = "New folder name"
    // let title = submenu.querySelector('h3')
    // let folderIcon = title.querySelector('i')
    // title.innerHTML = folderIcon.outerHTML+result
    
}


var eventsSetup = []
Hooks.on('renderCompendiumDirectory', async function() {
    convertExistingSubmenuToFolder()
    for (let submenu of document.querySelectorAll('li.compendium-folder')){
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
});
