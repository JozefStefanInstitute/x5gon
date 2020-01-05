// configurations
const config = require('@config/config');

const productionMode = config.environment === 'prod';

module.exports = {
  general: {
    heartbeat: 2000,
    pass_binary_messages: true
  },
  spouts: [
    {
      name: 'kafka.material.update',
      type: 'inproc',
      working_dir: './spouts',
      cmd: 'kafka-spout.js',
      init: {
        kafka_host: config.kafka.host,
        topic: 'UPDATE.MATERIAL.CONTENT',
        groupId: config.kafka.groupId
      }
    }
  ],
  bolts: [
    /****************************************
     * Storing OER materials into database
     */

    {
      name: 'store.pg.material.update',
      type: 'inproc',
      working_dir: './bolts',
      cmd: 'store-pg-material-update.js',
      inputs: [
        {
          source: 'kafka.material.update'
        }
      ],
      init: {
        pg: config.pg,
        final_bolt: !productionMode
      }
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: 'log.material.process.update.finished',
            type: 'inproc',
            working_dir: './bolts',
            cmd: 'log-message-postgresql.js',
            inputs: [
              {
                source: 'store.pg.material.update'
              }
            ],
            init: {
              pg: config.pg,
              postgres_table: 'material_update_queue',
              postgres_primary_id: 'material_id',
              message_primary_id: 'material_id',
              postgres_method: 'update',
              postgres_time_attrs: {
                end_process_time: true
              },
              postgres_literal_attrs: {
                status: 'material updated'
              },
              document_error_path: 'message',
              final_bolt: true
            }
          }
        ]
      : [])
  ],
  variables: {}
};
