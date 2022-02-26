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
