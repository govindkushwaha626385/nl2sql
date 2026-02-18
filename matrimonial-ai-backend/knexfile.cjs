require('dotenv').config();

/** @type { import("knex").Knex.Config } */
module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 1, max: 5 },
  migrations: {
    directory: './src/db/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './src/db/seeds',
    extension: 'ts',
  },
};
