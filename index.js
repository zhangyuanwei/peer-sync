#!/usr/bin/env node

'use strict';

var path = require('path');
var fs = require('fs');
var child_process = require('child_process');

var PEER_SYNC_CONFIGFILE = '.peersync.json';


function showUsage() {
    // TODO
}

function wrapArray(obj) {
    if (!Array.isArray(obj)) {
        obj = [obj];
    }
    return obj;
}

function mixin(target, source) {
    var key;
    var value;
    for (key in source) {
        if (source.hasOwnProperty(key)) {
            value = source[key];
            if (key.charAt(0) === "+") {
                key = key.substring(1);
                if (target.hasOwnProperty(key)) {
                    target[key] = wrapArray(target[key]);
                    [].push.apply(target[key], wrapArray(value));
                } else {
                    target[key] = value;
                }
            } else {
                target[key] = value;
            }
        }
    }
}

function getConfig(dir) {
    var config;
    var parentDir;
    var currentDir;
    var configFile;
    var currentConf;
    var stats;

    parentDir = path.dirname(dir);
    currentDir = path.basename(dir);
    if (parentDir === dir) {
        config = {};
    } else {
        config = getConfig(parentDir);
        if (config.path) {
            config.path = path.resolve(config.path, currentDir);
        }
    }

    currentConf = false;
    configFile = path.resolve(dir, PEER_SYNC_CONFIGFILE);
    try {
        //stats = fs.fstatSync(configFile);
        currentConf = JSON.parse(fs.readFileSync(configFile, "utf8"));
    } catch (_) {}

    if (currentConf !== false) {
        mixin(config, currentConf);
    }

    return config;
}

function getOperat(cmd) {
    return cmd.substring(cmd.lastIndexOf(path.sep) + 1);
}

function buildRsyncArgs(config, isPull, files, pwd) {
    var args = [];
    var flags = [
        "archive",
        "update",
        "checksum",
        "verbose",
        "partial",
        "progress",
        "links",
        "delete",
    ];
    var values = [
        "exclude",
        "include",
    ];
    var remote;
    var remotePath;

    flags.forEach(function(flag) {
        if (config[flag] || (isPull ? config["pull-" + flag] : config["push-" + flag])) {
            args.push("--" + flag);
        }
    });

    values.forEach(function(key) {
        var value;
        if (config.hasOwnProperty(key)) {
            value = config[key];
            if (!Array.isArray(value)) {
                value = [value];
            }
            value.forEach(function(item) {
                args.push("--" + key + "=" + item);
            });
        }
    });

    args.push("-e", "ssh");
    remote = config.user + "@" + config.host + ":";
    remotePath = config.path + path.sep;
    pwd = pwd + path.sep;

    if (isPull) {
        if (files.length > 0) {
            args.push(remote + path.resolve(remotePath, files[0]), pwd);
        } else {
            args.push(remote + remotePath, pwd);
        }
    } else {
        if (files.length > 0) {
            args.push.apply(args, files);
        } else {
            args.push(pwd);
        }
        args.push(remote + remotePath);
    }
    return args;
}

function runCommand(argv) {
    var op;
    var config;
    var args;
    var pwd;
    var isPull;

    op = getOperat(argv[1]);
    switch (op) {
        case "pull-peer":
            isPull = true;
            break;
        case "push-peer":
            isPull = false;
            break;
        default:
            showUsage();
            //return;
    }

    pwd = process.cwd();
    config = getConfig(pwd);
    args = buildRsyncArgs(config, isPull, argv.slice(2), pwd);

    console.log(args);
    child_process.spawnSync("rsync", args, {
        stdio: "inherit"
    });
}

runCommand(process.argv);
