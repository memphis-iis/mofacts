!function (module1) {
  module1.link("./files", {
    appendFile: ["appendFile", "appendFileSync"],
    chmod: ["chmod", "chmodSync"],
    close: ["close", "closeSync"],
    copyFile: ["copyFile", "copyFileSync"],
    createReadStream: "createReadStream",
    createWriteStream: "createWriteStream",
    lstat: ["lstat", "lstatSync"],
    mkdir: ["mkdir", "mkdirSync"],
    open: ["open", "openSync"],
    read: ["read", "readSync"],
    readFile: ["readFile", "readFileSync"],
    readdir: ["readdir", "readdirSync"],
    readlink: ["readlink", "readlinkSync"],
    realpath: ["realpath", "realpathSync"],
    rename: ["rename", "renameSync"],
    rmdir: ["rmdir", "rmdirSync"],
    stat: ["stat", "statSync"],
    symlink: ["symlink", "symlinkSync"],
    unlink: ["unlink", "unlinkSync"],
    watchFile: "watchFile",
    unwatchFile: "unwatchFile",
    write: ["write", "writeSync"],
    writeFile: ["writeFile", "writeFileSync"]
  }, 0);
}.call(this, module);
//# sourceMappingURL=fsFixPath.js.map