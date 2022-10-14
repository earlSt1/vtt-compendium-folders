# 2.5.3 (2022-10-14)
- Updated manifest for v10
- Added option to disable folders inside compendiums, keeping the sidebar folders
- Removed obsolete Fix my Compendium dialog
- Fix issues with create folder button not appearing in CoC7 compendiums
- Fix issues with dragdrop not reordering correctly inside compendiums
- Fix various issues related to moving elements inside compendiums

# 2.4.6 (2022-06-06)
- Fixed issues with import flag not being reset after importing folders
- Added option to Create RollTable from folder in compendium.
# 2.4.5 (2022-05-31)
- Fixed issue where cache would not update if you modified a shared compendium in another world
- Fixed issue where folders wouldn't render correctly for older compendiums after update 2.4.4
# 2.4.4 (2022-05-28)
- Overhauled folders in compendiums, a lot of refactoring and tidying up the module.
- Folders now retain sort mode and sort order when importing/exporting. 
- New option added to the create/edit dialog to chose between Alphabetical or Manual sort
- Folders in compendiums now support drag/drop. Behaviour is mostly the same as core Folders.
    - Dragging a folder onto an open folder will move the folder
    - Dragging a folder onto a closed folder will move the folder above the targetted folder (provided they are in the same folder)
    - Dragging a document onto a folder will move the document into the folder (like before)
    - Dragging a document onto another document in the same folder will move the document above the targetted document (provided they are in the same folder)
    - Dragging a document/folder onto the root directory (which extends over the search bar) will move the document/folder to the root directory.
    - Finally, drag/drop highlights are enabled
- Added more functions to the API and added documentation (see README for details)
- You can now import/export Playlist folder structures
- Fixed issue where editing a document in the world would sometimes generate an error in the console.
- Fixed issue where keepId option would not work on Import process
- Fixed issue where selecting the Delete All option on a folder in a compendium would not remove the selected folder
- Updating pt-BR translations (thanks MagelaCE!)
- Fixed name of swedish language in module.json
# 2.4.3 (2022-02-26)
- Sorting mode for folders is now saved (thanks @blair)
- Now supports using getFlags provided by foundry API
- Some tidying up
# 2.4.2 (2022-02-06)
- Folders in compendiums now support localized keys (as if you were using game.i18n.localize(name))
- Exporting folder structures will now remember the last compendium exported to
- Now compatible with Sidebar Macros
- Updated french localization (thanks @rectulo#4697)
- Fixed issue where exporting folder structures with folders that have the same name and depth would break the process.
- Potential fix for exporting large amounts of items into a compendium will break the folder structure
- Potential fix for issue where dragging items into a folder would not move them.
# 2.4.1 (2021-12-14)
- Compatible with FVTT v9
- Fixed issues with searching in compendiums
- Now supports Card compendiums
- Now supports new Macro Folder functionality in Core.
# 2.3.63 (2021-12-04)
- Fixed an issue where extra translated compendiums were appearing in the world
# 2.3.62 (2021-12-04)
- Fixed an issue where the compendium directory would render across the scene canvas
# 2.3.61 (2021-12-01)
- Fixed an issue with the API which caused DDB Importer's Migration process to break.
# 2.3.60 (2021-11-29)
- Using new API in import/export process. In testing this has resulted in less compendiums breaking randomly.
- Regenerating scene thumbnails when exporting a scene to a compendium
- Added 2 new functions to FICFolderAPI - renameFolder(folder,newName) and moveFolder(folderToMove,destFolder)
- Added Changelog
