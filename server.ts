import express from 'express';
import WebSocket from "ws";
// @ts-ignore
import * as ywsUtils from "y-websocket/bin/utils";
// @ts-expect-error
import {applyUpdate, Doc, encodeStateAsUpdate, encodeStateVector} from "yjs";
import {MongodbPersistence} from "y-mongodb-provider";
import dotenv from 'dotenv'

console.log(`Environment: ${process.env.NODE_ENV}`);

const result = dotenv.config();
if (result.error) {
    throw result.error;
}

const app = express();
const server = app.listen(process.env.PORT);
const webSocketServer = new WebSocket.Server({server});

console.log(server.address());

app.get('/ping', (_, res) => {
    res.send(true);
});
//
webSocketServer.on('connection', (conn: any, req: any) => {
    ywsUtils.setupWSConnection(conn, req, {gc: true});
    console.log(getStatus());
});

const mongoContext = getMongoContext();

ywsUtils.setPersistence({
    bindState: async (docName: string, document: Doc) => {
        const persistedDocument = await mongoContext.getYDoc(docName);
        const persistedStateVector = encodeStateVector(persistedDocument);

        const diff = encodeStateAsUpdate(document, persistedStateVector);

        const isDiff = (diff.reduce((previousValue, currentValue) => previousValue + currentValue, 0) > 0);
        if (isDiff) {
            await mongoContext.storeUpdate(docName, diff);
        }

        applyUpdate(document, encodeStateAsUpdate(persistedDocument));

        document.on('update', async (update) => {
            await mongoContext.storeUpdate(docName, update);
        });

        persistedDocument.destroy();
    },
    writeState: async (docName: any, document: any) => {
        await mongoContext.flushDocument(docName);
    }
});

function getMongoContext(): MongodbPersistence {
    return new MongodbPersistence(process.env.MONGO_DB_CONNECTION_STRING, {
        collectionName: process.env.MONGO_DB_COLLECTION_NAME,
        flushSize: 20,
        multipleCollections: false
    });
}

function getStatus() {
    let connections = 0;
    const docs = ywsUtils.docs;

    docs.forEach((doc: any) => {
        connections += doc.conns.size
    });

    return {
        date: new Date().toISOString(),
        connections,
        docs: docs.size
    };
}
