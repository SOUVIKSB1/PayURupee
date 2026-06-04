const mongoose = require('mongoose');

// mongodb-memory-server is a dev-time helper to run MongoDB in-memory for tests or dev
let MongoMemoryServer;
try {
  // require lazily so production where dependency isn't installed doesn't crash
  MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
} catch (err) {
  MongoMemoryServer = null;
}

module.exports = async function connectDB() {
  let uri = process.env.MONGO_URI;
  const useMemoryFallback = (process.env.FALLBACK_IN_MEMORY === 'true');

  // If no MONGO_URI provided and mongodb-memory-server is available, start it
  if (!uri && MongoMemoryServer) {
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    console.log('No MONGO_URI found — using in-memory MongoDB (mongodb-memory-server) for development');
  }

  if (!uri && !MongoMemoryServer) {
    throw new Error('MONGO_URI is not set and mongodb-memory-server is not available. Set MONGO_URI or install dev dependency.');
  }

  // try connecting with a few retries to handle slow DB startups (docker/service)
  const maxAttempts = 5;
  let fallbackAttempted = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(uri, {
        // useUnifiedTopology and useNewUrlParser are defaults in Mongoose 7
      });
      console.log('Connected to MongoDB');
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt} failed: ${err.message}`);
      // If we've exhausted attempts and user opted into fallback, try in-memory
      if (attempt === maxAttempts) {
        if (!MongoMemoryServer) {
          console.error('All MongoDB connection attempts failed. Please ensure MongoDB is running and MONGO_URI is correct.');
          throw err;
        }

        if (!useMemoryFallback && process.env.MONGO_URI && !fallbackAttempted) {
          console.error('Connection to provided MONGO_URI failed. To automatically fall back to an in-memory DB, set FALLBACK_IN_MEMORY=true');
          throw err;
        }

        if (!fallbackAttempted) {
          console.log('Falling back to in-memory MongoDB (mongodb-memory-server)');
          const mongod = await MongoMemoryServer.create();
          uri = mongod.getUri();
          fallbackAttempted = true;
          attempt = 0;
          continue;
        }
      }

      // exponential-ish backoff
      const waitMs = attempt * 2000;
      console.log(`Retrying in ${waitMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
};
