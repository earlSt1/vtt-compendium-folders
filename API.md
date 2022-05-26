# API Documentation
I have created a helper class as well as some custom data structures to assist with manipulating folders in compendiums programmatically.
All exposed classes are accessible from the `game.CF` object.

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
You can also directly update the properties of a `FICFolder` and save them
```js
folder.name = 'New Name';
await folder.save();
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

### `createFolderAtRoot(packCode,data)`
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
const folder = await folderAPI.createFolderAtRoot('world.actors',folderData);
```
### `createFolderWithParent(parent,data)`
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
const newFolder = await folderAPI.createFolderWithParent(dogFolder,folderData);
```


### `moveDocumentToFolder(document,folder)`
Moves `document` into the `folder` `FICFolder`

Example usage:
```js
const documentId = '0123abcd...';
const folderAPI = game.CF.FICFolderAPI;
const allFolders = await folderAPI.loadFolders();
let dogFolder = allFolders.find(f => f.name === 'Dog');
const updatedFolder = await folderAPI.moveDocumentToFolder(documentId,dogFolder);
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
Any issues feel free to ping me on Discord `@Erceron#0370`
