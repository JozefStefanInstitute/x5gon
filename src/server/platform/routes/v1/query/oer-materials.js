// external modules
const router = require('express').Router();

// internal modules
const mimetypes = require('@config/mimetypes');

/**
 * @description Adds API routes for logging user activity.
 * @param {Object} pg - Postgres connection wrapper.
 * @param {Object} logger - The logger object.
 */
module.exports = function (pg, logger, config) {

    /**********************************
     * Required configuration
     *********************************/

    // postgresql schema used in the API
    const schema = config.pg.schema;

    // offset and limit default values
    const DEFAULT_OFFSET = 0;
    const DEFAULT_LIMIT = 20;

    /**********************************
     * Helper functions
     *********************************/


    function oerMaterialQuery(params) {
        // extract parameters
        const {
            LIMIT,
            OFFSET,
            LANGUAGES,
            PROVIDER_IDS
        } = params;


        // create oer materials query statement
        const query = `
            WITH urls_extended AS (
                SELECT
                    ${schema}.urls.*,
                    ${schema}.providers.name   AS provider_name,
                    ${schema}.providers.domain AS provider_domain

                FROM ${schema}.urls LEFT JOIN ${schema}.providers
                ON ${schema}.urls.provider_id=${schema}.providers.id

                ${PROVIDER_IDS.length ? `WHERE ${schema}.urls.provider_id IN (${PROVIDER_IDS.join(',')})` : ''}
            ),

            oer_materials_query AS (
                SELECT
                    ${schema}.oer_materials.*,

                    urls_extended.url             AS url,
                    urls_extended.provider_id     AS provider_id,
                    urls_extended.provider_name   AS provider_name,
                    urls_extended.provider_domain AS provider_domain,

                    COUNT(*) OVER() AS full_count
                FROM ${schema}.oer_materials LEFT JOIN urls_extended
                ON ${schema}.oer_materials.id=urls_extended.material_id

                ${LANGUAGES.length ? `WHERE ${schema}.oer_materials.language IN (${LANGUAGES.join(',')})` : ''}

                ORDER BY ${schema}.oer_materials.id
                ${LIMIT  ? `LIMIT ${LIMIT}` : ''}
                ${OFFSET ? `OFFSET ${OFFSET}` : ''}
            )

            SELECT
                oer_materials_query.id,
                oer_materials_query.title,
                oer_materials_query.description,
                oer_materials_query.url,
                oer_materials_query.authors,
                oer_materials_query.language,
                oer_materials_query.creation_date,
                oer_materials_query.retrieved_date,
                oer_materials_query.type,
                oer_materials_query.mimetype,
                oer_materials_query.license,
                oer_materials_query.full_count,

                oer_materials_query.provider_id,
                oer_materials_query.provider_name,
                oer_materials_query.provider_domain,

                array_agg(${schema}.material_contents.id) AS material_content_ids

            FROM oer_materials_query LEFT JOIN ${schema}.material_contents
            ON oer_materials_query.id=${schema}.material_contents.material_id
            GROUP BY
                oer_materials_query.id,
                oer_materials_query.title,
                oer_materials_query.description,
                oer_materials_query.url,
                oer_materials_query.authors,
                oer_materials_query.language,
                oer_materials_query.creation_date,
                oer_materials_query.retrieved_date,
                oer_materials_query.type,
                oer_materials_query.mimetype,
                oer_materials_query.license,
                oer_materials_query.full_count,

                oer_materials_query.provider_id,
                oer_materials_query.provider_name,
                oer_materials_query.provider_domain;
        ;`;

        return query;
    }


    function specificOERMaterialQuery(materialId) {
        // create oer materials query statement
        const query = `
            WITH urls_extended AS (
                SELECT
                    ${schema}.urls.*,
                    ${schema}.providers.name   AS provider_name,
                    ${schema}.providers.domain AS provider_domain

                FROM ${schema}.urls LEFT JOIN ${schema}.providers
                ON ${schema}.urls.provider_id=${schema}.providers.id
                WHERE ${schema}.urls.material_id=${materialId}
            ),

            oer_materials_query AS (
                SELECT
                    ${schema}.oer_materials.*,
                    urls_extended.url AS url,

                    urls_extended.provider_id     AS provider_id,
                    urls_extended.provider_name   AS provider_name,
                    urls_extended.provider_domain AS provider_domain

                FROM ${schema}.oer_materials RIGHT JOIN urls_extended
                ON ${schema}.oer_materials.id=urls_extended.material_id
            )

            SELECT
                oer_materials_query.id,
                oer_materials_query.title,
                oer_materials_query.description,
                oer_materials_query.url,
                oer_materials_query.authors,
                oer_materials_query.language,
                oer_materials_query.creation_date,
                oer_materials_query.retrieved_date,
                oer_materials_query.type,
                oer_materials_query.mimetype,
                oer_materials_query.license,

                oer_materials_query.provider_id,
                oer_materials_query.provider_name,
                oer_materials_query.provider_domain,

                array_agg(${schema}.material_contents.id) AS material_content_ids

            FROM oer_materials_query LEFT JOIN ${schema}.material_contents
            ON oer_materials_query.id=${schema}.material_contents.material_id
            GROUP BY
                oer_materials_query.id,
                oer_materials_query.title,
                oer_materials_query.description,
                oer_materials_query.url,
                oer_materials_query.authors,
                oer_materials_query.language,
                oer_materials_query.creation_date,
                oer_materials_query.retrieved_date,
                oer_materials_query.type,
                oer_materials_query.mimetype,
                oer_materials_query.license,

                oer_materials_query.provider_id,
                oer_materials_query.provider_name,
                oer_materials_query.provider_domain;
        `;

        return query;
    }


    function contentsOERMaterialQuery(params) {
        // extract parameters
        const {
            materialId,
            contentId,
            OFFSET,
            LANGUAGES,
            PROVIDER_IDS
        } = params;

        // create oer materials query statement
        const query = `
            SELECT
                ${schema}.material_contents.*

            FROM ${schema}.material_contents
            WHERE ${schema}.material_contents.material_id=${materialId}

            ${contentId ? `AND ${schema}.material_contents.id=${contentId}` : ''}
        `;

        return query;

    }


    function createRequestLinks(req, params) {
        // get parameters
        const {
            fullCount,
            LIMIT,
            OFFSET,
            LANGUAGES,
            PROVIDER_IDS
        } = params;

        // construct the query parameters string
        let query = [];
        // list the languages used in the query
        for (let id=0; id < LANGUAGES.length; id++) {
            // add the array notation of the query
            query.push(`languages[${id}]=${LANGUAGES[id]}`);
        }
        // list the provider ids used in the query
        for (let id=0; id < PROVIDER_IDS.length; id++) {
            if (query.length) { query += '&'; }
            // add the array notation of the query
            query.push(`provider_ids[${id}]=${PROVIDER_IDS[id]}`);
        }

        // calculate number of pages
        const NEXT_OFFSET = OFFSET + LIMIT;
        const MAX_OFFSET = Math.floor(fullCount / LIMIT) * LIMIT;

        // construct create the domain
        const domain  = `https://platform.x5gon.org`;
        // set the base url
        let baseUrl = `${domain}${req.baseUrl}${req.path}`;

        // get the query params for the self url together
        let selfQuery = query.slice(0);
        if (LIMIT!==DEFAULT_LIMIT)   { selfQuery.push(`limit=${LIMIT}`); }
        if (OFFSET!==DEFAULT_OFFSET) { selfQuery.push(`offset=${OFFSET}`); }

        // build the self, next and last links
        const selfQueryString = selfQuery.length ? `?${selfQuery.join('&')}` : '';
        const nextQueryString = '?' + query.join('&') + (query.length ? '&' : '') + `limit=${LIMIT}&offset=${NEXT_OFFSET}`;
        const lastQueryString = '?' + query.join('&') + (query.length ? '&' : '') + `limit=${LIMIT}&offset=${MAX_OFFSET}`;

        // the links to other similar queries
        const self = `${baseUrl}${selfQueryString}`;
        const next = `${baseUrl}${nextQueryString}`;
        const last = `${baseUrl}${lastQueryString}`;

        // store the links into the return value
        let links = { self };
        if (NEXT_OFFSET < MAX_OFFSET) {
            links.next = next;
        }
        links.last = last;

        // return the urls of the query
        return links;

    }


    function materialType(mimetype) {
        for (let type in mimetypes) {
            if (mimetypes[type].includes(mimetype)) {
                return type;
            }
        }
        return null;
    }

    function oerMaterialFormat(pg_material, fields) {
        // get material parameters
        const {
            id,
            title,
            description,
            url,
            authors,
            language,
            creation_date,
            retrieved_date,
            type: extension,
            mimetype,
            license,

            provider_id,
            provider_name,
            provider_domain,

            material_content_ids
        } = pg_material;

        // get material type
        const type = materialType(mimetype);

        // setup material format
        return {
            id,
            title,
            description,
            url,
            language,
            type,
            provider: {
                id:     provider_id,
                name:   provider_name,
                domain: provider_domain
            },
            material_content_ids
        };

    }

    function oerMaterialContentFormat(pg_content, fields) {
        // get content parameters
        const {
            id,
            type,
            extension,
            value,
            language
        } = pg_content;

        // setup content format
        return {
            id,
            type,
            extension,
            value,
            language
        };

    }


    /**********************************
     * Middleware
     *********************************/

    // check query validity
    router.use((req, res, next) => {

        // transform query parameters into lowercase
        const query_parameters = {};
        for (let key in req.query) {
            query_parameters[key.toLowerCase()] = req.query[key];
        }

        const {
            limit,
            offset,
            page,
            languages,
            provider_ids
        } = query_parameters;


        /**********************************
         * check user parameters
         *********************************/

        // set error message container
        let error_msgs = [];

        if (limit && limit.match(/[^0-9,\.]+/gi)) {
            error_msgs.push('Query parameter "limit" is not a number');
        }

        if (offset && offset.match(/[^0-9,\.]+/gi)) {
            error_msgs.push('Query parameter "offset" is not a number');
        }

        if (page && page.match(/[^0-9,\.]+/gi)) {
            error_msgs.push('Query parameter "page" is not a number');
        }

        if (languages && !(Array.isArray(languages) || typeof(languages) === 'string')) {
            error_msgs.push('Query parameter "languages" is not a string or array');
        } else if (languages) {

            // get languages
            let LANGUAGES = [];
            if (typeof(languages) === 'string') {
                // split the languages string and trim them
                LANGUAGES = languages.split(',').map(lang => lang.trim());
            } else if (Array.isArray(languages)) {
                // trim each language entry
                LANGUAGES = languages.map(lang => lang.trim());
            }

            for (let lang of LANGUAGES) {
                // check if all language entries are of length 2
                if (lang.length !== 2) {
                    error_msgs.push('Query parameter "languages" is not in ISO 639-1 code');
                    break;
                }
            }
            // setup languages
            query_parameters.languages = LANGUAGES.map(lang => `'${lang}'`);
        }

        if (provider_ids && !(Array.isArray(provider_ids) || typeof(provider_ids) === 'string')) {
            error_msgs.push('Query parameter "provider_ids" is not a number or array of numbers');
        } else if (provider_ids) {

            // get providers
            let PROVIDER_IDS = [];
            if (typeof(provider_ids) === 'string') {
                // split the languages string and trim them
                PROVIDER_IDS = provider_ids.split(',').map(lang => lang.trim());
            } else if (Array.isArray(provider_ids)) {
                // trim each language entry
                PROVIDER_IDS = provider_ids.map(lang => lang.trim());
            }

            for (let id of PROVIDER_IDS) {
                // check if the provider ids are integers
                if (id.match(/[^0-9,\.]+/gi)) {
                    error_msgs.push('Query parameter "provider_ids" are not numbers');
                    break;
                }
            }
            // setup languages
            query_parameters.provider_ids = PROVIDER_IDS.map(id => parseInt(id));

        }


        /**********************************
         * notify the user about
         * the query parameter errors
         *********************************/

        if (error_msgs.length) {
            logger.warn('[warn] query parameters not in correct format',
                logger.formatRequest(req, {
                    error: error_msgs
                })
            );
            // notify the users of the parameters change
            return res.status(400).send({
                errors: { msgs: error_msgs }
            });
        }


        /**********************************
         * continue with request
         *********************************/

        // store the modified query parameters
        req.query_parameters = query_parameters;
        // continue the request
        return next();

    });


    // check parameter validity
    router.get((req, res, next) => {

        // set error message container
        let error_msgs = [];

        // check parameters
        for (let key in req.params) {
            // check if all parameters in the route are integers
            if (req.params[key].match(/[^0-9,\.]+/gi)) {
                error_msgs.push(`Parameter ${key} is not an integer, value=${req.params[key]}`);
            }
        }

        /**********************************
         * notify the user about
         * the url parameter errors
         *********************************/

        if (error_msgs.length) {
            logger.warn('[warn] query parameters not in correct format',
                logger.formatRequest(req, {
                    error: error_msgs
                })
            );
            // notify the users of the parameters change
            return res.status(400).send({
                errors: { msgs: error_msgs }
            });
        }

        /**********************************
         * continue with request
         *********************************/

        // continue the request
        return next();
    });


    /**********************************
     * Routes
     *********************************/

    router.get('/oer_materials', (req, res) => {

        /**********************************
         * setup user parameters
         *********************************/

        // get user query parameters
        const {
            limit,
            offset,
            page,
            languages,
            provider_ids
        } = req.query_parameters;

        // set default values if not provided
        const LIMIT = limit ? parseInt(limit) : DEFAULT_LIMIT;
        let OFFSET = offset ? parseInt(offset) : DEFAULT_OFFSET;
        if (page) {
            // override the offset value
            OFFSET = LIMIT * (parseInt(page) - 1);
        }

        // get languages
        let LANGUAGES = [];
        if (languages && typeof(languages) === 'string') {
            // split the languages string and trim them
            LANGUAGES = languages.split(',').map(lang => lang.trim());
        } else if (languages && Array.isArray(languages)) {
            // trim each language entry
            LANGUAGES = languages.map(lang => lang.trim());
        }

        // get providers
        let PROVIDER_IDS = provider_ids ? provider_ids : [];


        /**********************************
         * construct user query
         *********************************/

        // create the query
        const query = oerMaterialQuery({
            LIMIT,
            OFFSET,
            LANGUAGES,
            PROVIDER_IDS
        });

        // execute the user query
        pg.execute(query, [], function (error, records) {
            if (error) {
                logger.error('[error] postgresql error',
                    logger.formatRequest(req, {
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    })
                );
                // something went wrong on server side
                return res.status(500).send({
                    errors: {
                        msg: 'Error on server side'
                    }
                });
            }

            if (records.length === 0) {
                // respond to the user there are no materials
                return res.status(204).send();
            }


            /**********************************
             * prepare query results
             *********************************/

            // get full count of the records
            const { full_count: fullCount } = records[0];

            const links = createRequestLinks(req, {
                fullCount,
                LIMIT,
                OFFSET,
                LANGUAGES,
                PROVIDER_IDS
            });

            // convert the materials
            const materials = records.map(material => oerMaterialFormat(material));

            // send the materials to the user
            return res.status(200).send({
                links,
                oer_materials: materials
            });
        });

    });

    router.get('/oer_materials/:material_id', (req, res) => {
        // get material id
        const { material_id } = req.params;

        // constuct the material
        const query = specificOERMaterialQuery(material_id);

        // execute the user query
        pg.execute(query, [], function (error, records) {
            if (error) {
                logger.error('[error] postgresql error',
                    logger.formatRequest(req, {
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    })
                );
                // something went wrong on server side
                return res.status(500).send({
                    errors: {
                        msg: 'Error on server side'
                    }
                });
            }

            if (records.length === 0) {
                // respond to the user there are no materials
                return res.status(204).send();
            } else if (records.length !== 1) {
                // respond to the user there was an error in the database
                // query should not return multiple records
                return res.status(500).send({
                    errors: {
                        msg: 'Error on server side'
                    }
                });
            }


            /**********************************
             * prepare query results
             *********************************/

            // convert the materials
            const materials = oerMaterialFormat(records[0]);

            // send the materials to the user
            return res.status(200).send({
                oer_materials: materials
            });
        });

    });

    router.get('/oer_materials/:material_id/contents', (req, res) => {

        // get material id
        const {
            material_id
        } = req.params;

        // parse the material id like an integer
        const materialId = parseInt(material_id);

        // constuct the query
        const query = contentsOERMaterialQuery({ materialId });

        // execute the user query
        pg.execute(query, [], function (error, records) {
            if (error) {
                logger.error('[error] postgresql error',
                    logger.formatRequest(req, {
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    })
                );
                // something went wrong on server side
                return res.status(500).send({
                    errors: {
                        msg: 'Error on server side'
                    }
                });
            }

            if (records.length === 0) {
                // respond to the user there are no materials
                return res.status(204).send();
            }

            /**********************************
             * prepare query results
             *********************************/

            // convert the materials
            const contents = records.map(content => oerMaterialContentFormat(content));

            // send the materials to the user
            return res.status(200).send({
                oer_materials: {
                    id: materialId
                },
                contents
            });
        });

    });

    router.get('/oer_materials/:material_id/contents/:content_id', (req, res) => {
        // get material and content ids
        const {
            material_id,
            content_id
        } = req.params;

        // parse the material id like an integer
        const materialId = parseInt(material_id);
        const contentId = parseInt(content_id);

        // constuct the query
        const query = contentsOERMaterialQuery({ materialId, contentId });

        // execute the user query
        pg.execute(query, [], function (error, records) {
            if (error) {
                logger.error('[error] postgresql error',
                    logger.formatRequest(req, {
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    })
                );
                // something went wrong on server side
                return res.status(500).send({
                    errors: {
                        msg: 'Error on server side'
                    }
                });
            }

            if (records.length === 0) {
                // respond to the user there are no materials
                return res.status(204).send();
            }

            /**********************************
             * prepare query results
             *********************************/

            // convert the materials
            const contents = records.map(content => oerMaterialContentFormat(content));

            // send the materials to the user
            return res.status(200).send({
                oer_materials: {
                    id: materialId
                },
                contents
            });
        });
    });


    return router;
};
