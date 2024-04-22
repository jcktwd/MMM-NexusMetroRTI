/* Copyright (C) 2024 jcktwd */

"use strict"

const fs = require("node:fs/promises");
const NodeHelper = require("node_helper");
const Log = require("logger");

module.exports = NodeHelper.create({
    socketNotificationReceived: async function(notification, payload) {
        switch (notification) {
            case "UPDATE_CACHE":
                Log.log("Updating cache files")
                await this.updateCache();
                break
            case "ERR":
                Log.log(payload.msg);
                break
        }
    },


    updateCache: async function() {
        await fs.writeFile(
            `${this.path}/public/cache/stations.json`,
            (await fetch(
                "https://metro-rti.nexus.org.uk/api/stations")
            ).body
        );
        await fs.writeFile(
            `${this.path}/public/cache/platforms.json`,
            (await fetch(
                "https://metro-rti.nexus.org.uk/api/stations/platforms")
            ).body
        );
        Log.log(this.name + " updated cached stations and platforms");
        this.sendSocketNotification("UPDATED_CACHE");
    },


});
