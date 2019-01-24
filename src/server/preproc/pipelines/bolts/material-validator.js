/********************************************************************
 * Material: Validation
 * This component validates the material object - checks if all of
 * the required attributes are present and sends them to the
 * appropriate stream.
 */


// the material schema
const materialSchema = {
    "description": "The OER material object",
    "type": "object",
    "properties": {
        "title": {
            "description": "The title of the OER material or course",
            "type": "string"
        },
        "description": {
            "description": "A short description of the OER material or course",
            "type": "string"
        },
        "provideruri": {
            "description": "The url of provider where the OER material can be found",
            "type": "string"
        },
        "materialurl": {
            "description": "The source/direct url of the OER material",
            "type": "string"
        },
        "author": {
            "description": "The author(s) of the OER material",
            "type": "string"
        },
        "language": {
            "description": "The origin language of the OER material",
            "type": "string",
            "minLength": 2,
            "maxLength": 2
        },
        "datecreated": {
            "description": "The date when the OER material was created",
            "type": "string"
        },
        "dateretrieved": {
            "description": "The date when the OER material was retrieved by the platform",
            "type": "string"
        },
        "type": {
            "description": "The extension and type of the OER material",
            "type": ["object", "string", "null"]
        },
        "providermetadata": {
            "description": "The provider metadata",
            "type": "object",
            "properties": {
                "title": {
                    "description": "The name of the OER provider",
                    "type": "string"
                },
                "url": {
                    "description": "The url where the OER provider is found",
                    "type": "string"
                }
            },
            "required": [
                "title",
                "url"
            ]
        },
        "materialmetadata": {
            "description": "The material metadata extracted by platform",
            "type": "object",
            "properties": {
                "rawText": {
                    "description": "The raw content of the OER material in the origin language",
                    "type": "string"
                },
                "dfxp": {
                    "description": "The dfxp file associated with the video OER material",
                    "type": "string"
                },
                "wikipediaConcepts": {
                    "description": "The wikipedia concepts extracted from the OER material",
                    "type": "array",
                    "items": {
                        "description": "The wikipedia concept information",
                        "type": "object",
                        "properties": {
                            "name":       { "type": "string" },
                            "uri":        { "type": "string" },
                            "lang":       { "type": "string" },
                            "supportLen": { "type": "number" },
                            "pageRank":   { "type": "number" },
                            "cosine":     { "type": "number" },
                        },
                        "required": [
                            "name",
                            "uri",
                            "lang",
                            "supportLen",
                            "pageRank",
                            "cosine"
                        ]
                    }
                },
                "transcriptions": {
                    "description": "The transcriptions acquired from the UPV's TTP platform",
                    "type": "object"
                }
            },
            "required": [
                "rawText",
                "wikipediaConcepts"
            ]
        },
        "license": {
            "description": "The OER material license",
            "type": "string"
        }

    },
    "required": [
        "title",
        "provideruri",
        "materialurl",
        "language",
        "providermetadata",
        "materialmetadata"
    ]
};



class MaterialValidator {

    constructor() {
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    init(name, config, context, callback) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[MaterialValidator ${this._name}]`;

        // initialize validator with
        this._validator = require('../../../../lib/schema-validator')();

        // use other fields from config to control your execution
        callback();
    }

    heartbeat() {
        // do something if needed
    }

    shutdown(callback) {
        // prepare for gracefull shutdown, e.g. save state
        callback();
    }

    receive(material, stream_id, callback) {
        // validate the provided material
        const validation = this._validator.validateSchema(material, materialSchema);
        const stream_direction = validation ? stream_id : 'stream_partial';

        // send material to the next component
        return this._onEmit(material, stream_direction, callback);



    }
}

exports.create = function (context) {
    return new MaterialValidator(context);
};