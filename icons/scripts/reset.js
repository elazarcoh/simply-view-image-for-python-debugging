const fs = require("fs");
const path = require("path");

const outputDirectory = "dist";

// Function to recursively delete directory
function deleteDirectoryRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const currentPath = path.join(dirPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        deleteDirectoryRecursive(currentPath);
      } else {
        fs.unlinkSync(currentPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

// clear dist folder
deleteDirectoryRecursive(outputDirectory);
console.log(`deleted "${outputDirectory}" folder`);

// re-create dist folder
fs.mkdirSync(outputDirectory);