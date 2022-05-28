# API Documentation
I have created a helper class as well as some custom data structures to assist with manipulating folders in compendiums programmatically.
All exposed classes are accessible from the `game.CF` object.
## `game.CF.TEMP_ENTITY_NAME`
This constant represents the name given to all temporary documents. You can use this to determine whether a document is a temporary document (holding folder data) or not.

When a compendium is rendered, Compendium Folders looks for all documents with this name, hides them, and creates folders in the compendium window using the data stored in them.
## `game.CF.FICFolder`
The building block of folders in compendiums. This object is designed to be as close to the core `Folder` class as possible. You can do things like 
```js
// Get the parent folder ID
folder.parent.id
// Get a list of child FICFolder objects
folder.childObjects
// Get a list of documents in this folder
folder.contents
// Get the compendium this folder belongs to
folder.pack
```
You can directly update the properties of a `FICFolder` and save them
```js
folder.name = 'New Name';
await folder.save();
```
Or get the update data from a folder once you have updated it, if you wanted to update multiple folders at once and add them to a list of updates
```js
const updates = []
//Find and change the folder, calling getSaveData() to return the data for updates
folder.name = 'New Name'
updates.push(folder.getSaveData())
//Then later you can use updateDocuments(data,options)
const cls = pack.documentClass;
return await cls.updateDocuments(updates,{pack:pack.collection});
```

A lot of the more complicated operations (such as getting the parent folder) only work if you use the API functions, which I will talk about below

## `game.CF.FICFolderAPI`
This is the core API that will allow you to perform multiple operations on a compendium. All operations are asynchronous.
### `loadFolders(packCode)`
Iterates through all compendium documents, extracts folder data from the temporary documents, and creates `FICFolder` objects automatically. 
- There are some checks to see whether data is missing (for example opening a compendium created by an older version of Compendium Folders), and updates are applied automatically.
- This function will also populate the `game.customFolders.fic.folders` object with a `FICFolderCollection` object (an extension of the `WorldCollection` class specifically for `FICFolders`)
- This clears the `game.customFolder.fic.folders` object every time it runs, so its a useful way of refreshing the object.

**Returns**: a `FICFolderCollection` object (an extension of the `WorldCollection` class specifically for `FICFolders`), containing all `FICFolders` for a compendium

Example usage:
```js
const folderAPI = game.CF.FICFolderAPI;
const allFolders = await folderAPI.loadFolders('world.actors');
const dogFolder = allFolders.find(f => f.name === 'Dog');
//Can also access via game.customFolders.fic.folders once you run loadFolders()
const alsoDogFolder = game.customFolders.fic.folders.find(f => f.name === 'Dog');
```

### `createFolderAtRootData(packCode,data)`
Creates a new folder at the root directory and updates `game.customFolders.fic.folders`.

**Returns** the `FICFolder` object that was created

Example usage:
```js
const folderAPI = game.CF.FICFolderAPI;
const folderData = {
    name:'Important NPCs',
    color:'#0F0F0F',
    icon:'path/to/danger.png',
    fontColor:'#AAAAAA'
}
const folder = await folderAPI.createFolderAtRootData('world.actors',folderData);
```
### `createFolderWithParentData(parent,data)`
Creates a new folder with the `FICFolder` object `parent` as the parent and updates `game.customFolders.fic.folders`

**Returns** the `FICFolder` object that was created

Example usage:
```js
const folderAPI = game.CF.FICFolderAPI;
const allFolders = await folderAPI.loadFolders('world.actors');
let dogFolder = allFolders.find(f => f.name === 'Dog');
const folderData = {
    name:'Important Dogs',
    color:'#0F0F0F',
    icon:'path/to/dog.png',
    fontColor:'#AAAAAA'
}
const newFolder = await folderAPI.createFolderWithParentData(dogFolder,folderData);
```


### `moveDocumentIntoFolder(document,folder)`
Moves `document` into the `folder` `FICFolder`

Example usage:
```js
const documentId = '0123abcd...';
const folderAPI = game.CF.FICFolderAPI;
const allFolders = await folderAPI.loadFolders();
let dogFolder = allFolders.find(f => f.name === 'Dog');
const updatedFolder = await folderAPI.moveDocumentIntoFolder(documentId,dogFolder);
```
### `moveFolder(folderToMove,destFolder)`
Moves `folderToMove` into the `destFolder` `FICFolder`.

Example usage:
```js
const folderAPI = game.CF.FICFolderAPI;
const allFolders = await folderAPI.loadFolders();
let dogFolder = allFolders.find(f => f.name === 'Dog');
let smallDogFolder = allFolders.find(f => f.name === 'Small Dogs');
await folderAPI.moveFolder(smallDogFolder,dogFolder);
```
### `moveDocumentToRoot(packCode,documentId,folderId=null)`
Moves `documentId` into the root directory. 

The `folderId` is used internally to keep track of the previous folder the document was in. You can leave this `null`, or to improve performance slightly, pass in the folder ID of the previous folder.

Example usage:
```js
const documentId = '0123abcd...';
const folderAPI = game.CF.FICFolderAPI;
await folderAPI.moveDocumentToRoot(packCode,documentId);
```
### `moveFolderToRoot(folder)`
Moves `folder` into the root directory.

**Returns** a list of updates to apply if the `save` parameter is `false`, else nothing

Example usage:
```js
const folderAPI = game.CF.FICFolderAPI;
const allFolders = await folderAPI.loadFolders();
let dogFolder = allFolders.find(f => f.name === 'Dog');
await folderAPI.moveFolderToRoot(dogFolder);
```
### `deleteFolder(folder,deleteAll=false)`
Deletes `folder` from the compendium. Depending on the value of `deleteAll` 2 things can occur:
- With `deleteAll` set to `true`, `folder`, **all child folders and documents will be removed from the compendium**
- With `deleteAll` set to `false`, `folder` will be removed from the compendium, and all child folders and documents will be moved to the parent of `folder` (or the root directory if `folder` has no parent)


Example usage:
```js
const folderAPI = game.CF.FICFolderAPI;
const allFolders = await folderAPI.loadFolders();
let dogFolder = allFolders.find(f => f.name === 'Dog');
await folderAPI.deleteFolder(dogFolder,false);
```
### `insertDocument(srcDocument,destDocument,folder)`
*Only applies to folders with sorting mode set to Manual*

Reorganises the contents of `folder`, placing `srcDocument` above `destDocument`. 

Example usage:
```js
// Places importantDocument above document in folder
const documentId = '0123abcd...';
const importantDocumentId = '1234abcd...';
const folderAPI = game.CF.FICFolderAPI;
const folders = await folderAPI.loadFolders('world.actors');
let folder = folders.find(f => f.name === 'NPCs');
await folderAPI.insertDocument(importantDocumentId,documentId,folder);
```
### `insertFolder(srcFolder,destFolder)`
*Only applies to folders with parent folder sorting mode set to Manual*

Reorganises the child folders of `srcFolder.parent`, placing `srcFolder` above `destFolder`. 

Example usage:
```js
// Places importantFolder above folder in folder.parent
const folderAPI = game.CF.FICFolderAPI;
const folders = await folderAPI.loadFolders('world.actors');
let folder = folders.find(f => f.name === 'NPCs');
let importantFolder = folders.find(f => f.name === 'Very Important NPCs');
// A check is done in the function to see if the parents match
// so folder.parent === importantFolder.parent
await folderAPI.insertDocument(importantFolder,folder);
```
### `exportFolder(packCode,folder,merge,keepId,quietMode=false)`
Exports the folder structure of `folder`, a Foundry `Folder` object, to the compendium with key `packCode`. 

If `merge` and `keepId` options are not provided, the default is used (configured in the module settings)

If `quietMode` is enabled, notifications will not be displayed to the user.

### `exportFolderWithDialog(folder)`
Same as above, but presents the user with the Export dialog so they can select the compendium to export to. 

### `importFolder(folder,merge,keepId,quietMode=false)`
Imports the folder structure of `folder`, a Compendium Folders `FICFolder` object, to the world. 

If `merge` and `keepId` options are not provided, the default is used (configured in the module settings)

If `quietMode` is enabled, notifications will not be displayed to the user.
### `importFolderWithDialog(folder)`
Same as above, but presents the user with the Import dialog so they can define the Merge by Name and keep document ID options. 

### `clearCache()`
I've implemented a basic caching system implemented for folders in compendiums. This is because whenever you update/create/delete an entry in a compendium, the compendium renders again. This caching system prevents multiple `loadFolders` calls, therefore improving performance.

Its rare to experience caching issues, especially as most API function calls perform updates on the cache, but if you do experience issues you can call this function and the cache will be reset, regenerating when you open the next foldered compendium.
## Common examples
### Importing multiple folders at once into the world
```js
const folderAPI = game.CF.FICFolderAPI;
const folders = await folderAPI.loadFolders('world.actors');
const allImportantFolders = folders.filter(f => f.name.startsWith('Important'));
for (let folder of allImportantFolders){
    await folderAPI.importFolder(folder);
}
```
### Deleting all folders in a compendium
The easiest way to do this is to use the `Remove folder data from compendium` option in the module settings

To do this with a macro, you can use the function directly
```js
const packCode = 'world.actors'
await game.CF.cleanupCompedium(packCode);
```
### Deleting all documents outside of a folder
```js
const packCode = 'world.actors';
const pack = game.packs.get(packCode);

const folderAPI = game.CF.FICFolderAPI;
const folders = await folderAPI.loadFolders(packCode);

const allDocumentsInFolders = folders.map(f => f.contents).deepFlatten();
const index = await pack.getIndex();
const allDocuments = index.filter(i => i.name != game.CF.TEMP_ENTITY_NAME).map(i => i._id)

const deleteIds = []
for (let doc of allDocuments){
    if (!allDocumentsInFolders.includes(doc))
        deleteIds.push(doc);
}

const cls = pack.documentClass;
return await cls.deleteDocuments(deleteIds,{pack:pack.collection});
```
___

Any issues feel free to ping me on Discord `@Erceron#0370`
