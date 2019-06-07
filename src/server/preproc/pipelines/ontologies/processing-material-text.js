// module for path creation
const path = require('path');
// configurations
const config = require('alias:config/config');

module.exports = {
    "general": {
        "heartbeat": 2000,
        "pass_binary_messages": true
    },
    "spouts": [
        {
            "name": "text-input",
            "type": "inproc",
            "working_dir": "./spouts",
            "cmd": "kafka-spout.js",
            "init": {
                "kafka_host": config.kafka.host,
                "topic": "PROCESSING.MATERIAL.TEXT",
                "groupId": `${config.kafka.groupId}-text`
            }
        }
    ],
    "bolts": [
        {
            "name": "material-format",
            "type": "inproc",
            "working_dir": "./bolts",
            "cmd": "material-format.js",
            "inputs": [{
                "source": "text-input"
            }],
            "init": {
                "fields": [
                    { "name": "title" },
                    { "name": "description" },
                    { "name": "provideruri" },
                    { "name": "materialurl" },
                    { "name": "author" },
                    { "name": "language" },
                    { "name": "type" },
                    { "name": "datecreated" },
                    { "name": "dateretrieved" },
                    { "name": "materialmetadata", "default": {} },
                    { "name": "providertoken" },
                    { "name": "license" }
                ],
                "pg": config.pg
            }
        },
        {
            "name": "material-type",
            "type": "inproc",
            "working_dir": "./bolts",
            "cmd": "material-type.js",
            "inputs": [{
                "source": "material-format",
            }],
            "init": {
                "pg": config.pg
            }
        },
        {
            "name": "text-content-extraction",
            "type": "inproc",
            "working_dir": "./bolts",
            "cmd": "extraction-text.js",
            "inputs": [{
                "source": "material-type",
            }],
            "init": {
                "text_config": {
                    "preserveLineBreaks": true,
                    "includeAltText": true
                },
                "pg": config.pg
            }
        },
        // {
        //     "name": "text-content-translation",
        //     "type": "inproc",
        //     "working_dir": "./bolts",
        //     "cmd": "extraction-ttp-text.js",
        //     "inputs": [{
        //         "source": "text-content-extraction",
        //     }],
        //     "init": {
        //         "tmp_folder": path.join(__dirname + '../../../tmp'),
        //         "pg": config.pg
        //     }
        // },
        {
            "name": "wikification",
            "type": "inproc",
            "working_dir": "./bolts",
            "cmd": "extraction-wikipedia.js",
            "inputs": [{
                "source": "text-content-extraction",
            }],
            "init": {
                "userKey": config.preproc.wikifier.userKey,
                "wikifierUrl": config.preproc.wikifier.wikifierUrl,
                "pg": config.pg
            }
        },
        {
            "name": "material-validator",
            "type": "inproc",
            "working_dir": "./bolts",
            "cmd": "material-validator.js",
            "inputs": [{
                "source": "wikification",
            }],
            "init": {
                "pg": config.pg
            }
        },

        /****************************************
         * Send the completely processed materials
         * to kafka distribution
         */

        {
            "name": "kafka-material-complete-topic",
            "type": "inproc",
            "working_dir": "./bolts",
            "cmd": "kafka-material-complete.js",
            "inputs": [{
                "source": "material-validator",
            }],
            "init": {
                "kafka_host": config.kafka.host,
                "kafka_topic": "STORING.MATERIAL.COMPLETE"
            }
        },

        /****************************************
         * Send the partially processed materials
         * to kafka distribution
         */

        {
            "name": "kafka-material-partial-topic",
            "type": "inproc",
            "working_dir": "./bolts",
            "cmd": "kafka-material-partial.js",
            "inputs": [{
                "source": "material-format",
                "stream_id": "stream_partial"
            },{
                "source": "text-content-extraction",
                "stream_id": "stream_partial"
            },{
                "source": "wikification",
                "stream_id": "stream_partial"
            },{
                "source": "material-validator",
                "stream_id": "stream_partial"
            }],
            "init": {
                "kafka_host": config.kafka.host,
                "kafka_topic": "STORING.MATERIAL.PARTIAL"
            }
        }
    ],
    "variables": {}
};