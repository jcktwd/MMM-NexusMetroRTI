/* Copyright (C) 2024 jcktwd */

Module.register("MMM-NexusMetroRTI", {
	// Module config defaults.
	defaults: {
        updateCacheOnStart: false,
		updateInterval: 15000,
        colorize: true,
        showStation: true,
        showPlatform: true,
        platformFormat: "{{helperText}}",
        showDestination: true,
        showLocation: true,
        locationFormat: "{{eventTypeString}} {{eventStation}}",
        locationTimeFormat: "HH:mm",
        showDueIn: true,
        minETA: -1,
        maxETA: -2,
        maxTrains: 4,
        station: null,
        platform: null,
	},

    baseURL: "https://metro-rti.nexus.org.uk/api",

    rti: [],

    _platforms: null,
    _stations: null,

    templateData: {
        platform: "Platform",
        station: "Station",
        trains: [],
    },

    // Translating API response to friendly format
    locationEventStringTrans: {
        "APPROACHING": "Approaching",
        "ARRIVED": "Arrived at",
        "DEPARTED": "Departed from",
        "READY_TO_START": "Starting at",
    },

    // Translating API response to emoji format
    locationEventEmojiTrans: {
        "APPROACHING": "🛤️➡️",
        "ARRIVED": "🚉🛑",
        "DEPARTED": "🚉➡️",
        "READY_TO_START": "🛤️🛑",
    },

    // Define required scripts.
	getScripts () {
		return ["moment.js"];
	},

    getStyles () {
		return ["MMM-NexusMetroRTI.css"];
	},


    // Define start sequence.
    async start () {
        Log.info(`Starting module: ${this.name}`);

        if (this.config.updateCacheOnStart) {
            this.sendSocketNotification("UPDATE_CACHE", {});
        };

        Object.defineProperty(this, "platforms", {
            get: function() {
                return (this._platforms ?? true) ? this.getPlatforms() : this._platforms
            }
        });

        Object.defineProperty(this, "stations", {
            get: function() {
                return (this._stations ?? true) ? this.getStations() : this._stations
            }
        });

        // Process the config properties
        await this.processConfig()
        await this.updateTrains();
        this.updateDom()

        // Schedule update timer.
        setInterval(async () => {
            await this.updateTrains();
            this.updateDom();
        }, this.config.updateInterval);
    },

    socketNotificationReceived: function (notification, payload) {
        switch (notification) {
            case "UPDATED_CACHE":
                this._stations = null;
                this._platforms = null;
                console.log("Updating cached stations and platforms.")
                break;
        }
    },

    async getStations () {
        return this._stations = await (await fetch(this.file("public/cache/stations.json"))).json();
    },

    async getPlatforms () {
        return this._platforms = await (await fetch(this.file("public/cache/platforms.json"))).json();
    },

    async updateTrains() {
        let response = await fetch(
            `cors?url=${this.baseURL}/times/${this.config.station}/${this.config.platform}`
        );

        this.rti = await response.json();

        // process data
        let trainTemplateData = [];
        for (const train of this.rti) {

            // Skip processing trains that are not within specified ETA range
            if ((train.dueIn > this.config.maxETA && this.config.maxETA != -2)
                    || train.dueIn < this.config.minETA){
                continue;
            }

            // Stop processing trains once we have enough
            if (trainTemplateData.length >= this.config.maxTrains) {
                break;
            }

            data = {
                trainNumber: train.trn,

                event: train.lastEvent,
                eventTypeString: this.locationEventStringTrans[train.lastEvent] ?? train.lastEvent,
                eventStation: train.lastEventLocation.substring(
                    0,
                    train.lastEventLocation.lastIndexOf(" Platform")
                ),
                eventPlatform: train.lastEventLocation.substring(
                    train.lastEventLocation.lastIndexOf("Platform")
                ),

                eventTime: moment(train.lastEventTime).format(
                    this.config.locationTimeFormat
                ),
                destination: train.destination,
                dueIn: train.dueIn,
                line: train.line,
            }

            data.locationString = this.nunjucksEnvironment().renderString(
                this.config.locationFormat, data
            );

            trainTemplateData.push(data);
            }

        this.templateData.trains = trainTemplateData;
    },

    async processConfig() {
        if (this.config.station === null){
            this.sendSocketNotification("ERR", {
                msg: `'station' is a required config property`
            });
        };

        stations = (await this.stations)
        if (!Object.hasOwn(stations, this.config.station)){
            this.sendSocketNotification("ERR", {
                msg: `Station with code ${this.config.station} does not exist.`
            });
        };

        if (this.config.platform === null){
            this.sendSocketNotification("ERR", {
                msg: `'platform' is a required config property`
            });
        };

        platforms = (await this.platforms)
        const possibleNums = platforms[this.config.station].map(({platformNumber}) => platformNumber);
        if (!possibleNums.includes(this.config.platform)) {
            this.sendSocketNotification(
                "ERR",
                {
                    msg: `platform "${this.config.platform}" is not at station "${this.config.station}" Possible values were ${platforms[this.config.station]}`
                }
            );
        };

        this.templateData.platform = this.nunjucksEnvironment().renderString(
            this.config.platformFormat,
            platforms[this.config.station].find(
                ({platformNumber}) => this.config.platform === platformNumber
            )
        );

        this.templateData.station = stations[this.config.station];
    },

    getTemplate () {
        return "MMM-NexusMetroRTI.njk";
    },

    getTemplateData () {
        return {
            config: this.config,
            data: this.templateData,
        }
    },
})