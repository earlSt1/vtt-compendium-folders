# Compendium Folders

This is a module for FoundryVTT which allows you to manage compendiums a bit easier by implementing a folder system. This folder structure can be used for compendiums in addition to *inside* compendiums.

## Folders In Compendiums

_This feature only works for FVTT 0.7.3+_

##### Exporting a folder
![Exporting a folder](./cf_export1.gif)
##### Importing a folder
![Importing a folder](./cf_import1.gif)

#### Features
- Entity folder structure import/export into compendiums.
- Folders in the most recently opened compendium with save their open state, so you can easily delete entries within them without having to open everything up.
- Folders in the compendium with no entities within them (e.g a folder with only folders in it), will always be open.
- Supports all entity types (Actor,Item,JournalEntry,Scene,Rolltable)
- Delete Folders inside the compendium (which move all entries up into the parent folder), or Delete All (which deletes the folder and all entries inside it)
- Edit the name and colour of the folder, so long as it has entries inside it (see Limitations below).

#### Instructions
- To use the new functionality, each folder has a new button to the right of the Create Entity button (looking like an arrow pointing up). This will open up a prompt to pick a compendium to export to. Once you do, the folder structure will appear in the compendium you picked.
- To import the folders from a compendium, there is a similar button for each folder. This will import the folder structure you have stored into your current world, in addition to creating entities and adding them to the correct folders.

#### Limitations
- One main limitation to this is that you cannot easily construct a folder structure inside the compendium. If you want to export a new folder you will have to create a new folder in the same path as inside the compendium, place the entities you would like to export in there, then Export the folder structure of that new folder.
- The way this works is that folder data is stored in entities. This means you cannot have empty folders, and a folder without entities in it, but with a folder inside it, cannot be modified.

## Folders for Compendiums

![](./example.png)

## Instructions
Once the module initially runs, it will convert your existing submenus into folders.
Each folder has 3 icons. Starting from the right
- The Gear icon allows you to edit the compendiums inside a folder. They are grouped by Assigned (already in folders) and Unassigned (not in folders). You can also Delete a folder through this dialog, which will delete all child folders and move all compendiums within to Unassigned
- The Folder icon allows you to create a folder beneath the current folder. 
- The Folder Tree icon allows you to move a folder to another location, also bringing it's children.

You can also import and export your folder configuration, to share with others or to backup your folder structure. In the Settings tab under Compendium Folders you can find an Import/Export dialog. Pasting someone elses Import string into the import box will seamlessly import their folder structure, ignoring any missing compendiums.

I would recommend once you are happy with your layout, to save your folder configuration. This will also be useful if you are going to submit an issue or bug on GitHub.

## Future

1. ~~Move compendiums between folders~~ Now in 0.1.4!
2. ~~Create/Rename/Update/Delete folders~~ Now in 0.1.4!
3. ~~Nesting folders + Moving folders around~~ Now in 1.0.0
4. ~~Seach, collapse all, and refresh (like other tabs)~~ Now in 0.1.7!
5. ~~Import/Export folder configuration~~ Now in 1.0.0!
6. Custom folder ordering (currently defaults to alphabetical)
7. ~~Default folder for new compendiums~~
8. ~~Default open/close state for folders~~
9. ~~Custom folder and icon text color~~ Now in 1.0.6!
10. Drag/Drop functionality
11. Context menu right-click instead of buttons on the folder when open.

Any issues feel free to ping me on Discord (@Erceron#0370)

## Localization
Special thanks to the translators who contributed to this project:
- lozalojo (Spanish)
- CarnVanBeck (German)
- rinnocent (Brazilian Portugese)

## Contribution
If you'd like to support my work, feel free to leave a tip through [my paypal](http://paypal.me/cre463)
