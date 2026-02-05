import { MongoClient } from "mongodb";

const mongoUrl = process.env.MONGO_URL_SCRAPPING;
const dbName = process.env.MONGO_DBNAME_SCRAPPING;

if (!mongoUrl) {
  throw new Error("Missing MONGO_URL_SCRAPPING environment variable.");
}

if (!dbName) {
  throw new Error("Missing MONGO_DBNAME_SCRAPPING environment variable.");
}

type MongoClientCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongoScrapping: MongoClientCache | undefined;
}

const globalCache = global.mongoScrapping ?? { client: null, promise: null };

global.mongoScrapping = globalCache;

export async function getMongoClient(): Promise<MongoClient> {
  if (globalCache.client) {
    return globalCache.client;
  }

  if (!globalCache.promise) {
    globalCache.promise = new MongoClient(mongoUrl!).connect();
  }

  globalCache.client = await globalCache.promise;
  return globalCache.client;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  return client.db(dbName);
}
