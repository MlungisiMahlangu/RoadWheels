require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { createApp } = require('./app');

async function start() {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
    if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
        throw new Error('JWT_SECRET must contain at least 32 bytes; use a cryptographically random secret.');
    }
    const port = Number(process.env.PORT || 5000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
    const app = createApp();
    mongoose.set('bufferCommands', false);
    mongoose.set('maxTimeMS', 10000);
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') {
        throw new Error('MongoDB must support transactions: use a replica set or Atlas.');
    }
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    const server = app.listen(port, () => console.log(`RoadWheels listening on port ${port}`));
    server.requestTimeout = 30000;
    server.headersTimeout = 15000;
    const shutdown = () => {
        const deadline = setTimeout(() => process.exit(1), 10000);
        deadline.unref();
        server.close(async () => {
            await mongoose.disconnect();
            clearTimeout(deadline);
        });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    return server;
}

if (require.main === module) {
    start().catch(async (err) => {
        console.error('Unable to start RoadWheels:', err.name === 'Error' ? err.message : 'Check database availability and configuration.');
        await mongoose.disconnect();
        process.exitCode = 1;
    });
}

module.exports = { start };
