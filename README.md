# Compendium Folders

![GitHub release (latest by date)](https://img.shields.io/github/v/release/earlSt1/vtt-compendium-folders) ![GitHub issues](https://img.shields.io/github/issues-raw/earlSt1/vtt-compendium-folders) ![GitHub all releases](https://img.shields.io/github/downloads/earlSt1/vtt-compendium-folders/total) ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fcompendium-folders) [![Buy me a coffee](https://img.shields.io/badge/-buy%20me%20a%20coffee-%23334dae?logo=Ko-fi&amp;logoColor=white)](https://ko-fi.com/erceron) 

This is a module for FoundryVTT which allows you to manage compendiums a bit easier by implementing a folder system. This folder structure can be used to organize compendiums in the directory, in addition to organize entries *inside* compendiums.

The module functionality is split into 2 parts. **Folders In Compendiums** (or **FIC**), and **Folders For Compendiums** (or **FFC**)

## Folders In Compendiums

A module that works GREAT with this is [__MoarFolders__](https://foundryvtt.com/packages/moar-folders/). I recommend installing this if you don't have it already.

Export             | Import
:-------------------------:|:-------------------------:
<img src="./cf_export1.gif" width="700" /> |  <img src="./cf_import1.gif" width="700" />

#### Features
- Entity folder structure import/export into compendiums.
- Folders in the most recently opened compendium with save their open state, so you can easily delete entries within them without having to open everything up.
- Folders in the compendium with no entities within them (e.g a folder with only folders in it), will always be open.
- Supports all entity types (Actor,Item,JournalEntry,Scene,Rolltable)
- Delete Folders inside the compendium (which move all entries up into the parent folder), or Delete All (which deletes the folder and all entries inside it)
- Edit the name, colour, icon, and sorting mode of the folder.
- Create new folders and drag/drop entries between them

#### Instructions
- To use the new functionality, each folder has a new right click context menu option named *Export Folder Structure*. This will open up a prompt to pick an unlocked compendium to export to. Once you do, the folder structure will appear in the compendium you picked.
- To import the folders from a compendium, there is a similar button for each folder. This will import the folder structure you have stored into your current world, in addition to creating entities and adding them to the correct folders.
- You can create folders in compendiums that have folders already in them. Next to the search bar there is a button to Create Folder at Root, and next to each rendered folder there is a similar Create Subfolder button to what you will see in the core application.
- If you dont have any folders in the current compendium, you wont be able to make use of this functionality. To fix this you can export an empty folder into the compendium, then the folder create buttons will appear.

#### Frequently Asked Questions
**"My compendiums are showing a lot of `#[CF_tempEntity]` things and no folders. What gives?"** - This can be caused by multiple things:
- Make sure you are on the latest version of Compendium Folders (even if you freshly installed it)
- Make sure Compendium Folders is enabled
- If youre still experiencing issues, try using the new "Validate/Fix my Compendium" feature in the module settings.

#### Future
- Auto-create folders based on attributes of entries in compendium

## Folders for Compendiums

![](./example.png)

#### Instructions
Once the module initially runs, it will convert your existing submenus into folders.
Each folder looks like the other directories, having a Create Subfolder button, and Create Compendium button. They also have extra options if you right click them
- The Edit Folder option allows you to edit folder attributes (such as name, color, icon), and assign compendiums to the folder. The compendiums are grouped by Assigned (already in folders) and Unassigned (not in folders). You can also Delete a folder through this dialog, which will delete all child folders and move all compendiums within to Unassigned 
- The Move Folder option allows you to move a folder to another location, also bringing it's children.
- The Show All/Hide All options allow you to toggle visibility of all compendiums within the folder (hiding them from players)
- The Lock/Unlock All options allow you to toggle edit lock on all compendiums within the folder.

There is also an extra context option for compendiums - Hide from GM. This will add the compendium to a hidden folder, hiding it from the GM's view. 
- You can make the compendium visible again by editing a folder and assigning it to the folder.

You can also import and export your folder configuration, to share with others or to backup your folder structure. In the Settings tab under Compendium Folders you can find an Import/Export dialog. Pasting someone elses Import string into the import box will seamlessly import their folder structure, ignoring any missing compendiums.

I would recommend once you are happy with your layout, to save your folder configuration. This will also be useful if you are going to submit an issue or bug on GitHub.

#### Frequently Asked Questions
**"I've used the 'Hide from GM' option on a compendium, how do I get it back?"** - Hiding a compendium from GM marks the compendium as "Unassigned". You can edit an existing folder and find the hidden compendium in the bottom section (Unassigned)

**"Can I copy my folder structure from one world to another?"** - Yes, in Module Settings open the Import/Export dialog. Click the Copy to Clipboard button and paste it in the same dialog on a different world. 

#### Future
- Custom folder ordering (currently defaults to alphabetical)

Any issues feel free to ping me on Discord `@Erceron#0370`

### <a href='./API.md'>API Documentation</a>
## Localization
Special thanks to the translators who contributed to this project:
- lozalojo (Spanish)
- CarnVanBeck (German)
- rinnocent, MagelaCE (Brazilian Portugese)
- Himeroos#4803 and rectulo (French)
- xdy (Swedish)
- BrotherSharper (Japanese)

## Contribution
If you'd like to support my work, feel free to buy me a coffee at [my kofi](https://ko-fi.com/erceron)

---

This project is licensed under the CC-BY-NC license. Visit https://creativecommons.org/licenses/by-nc/4.0/ for more information.
