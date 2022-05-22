const express = require('express');
const cors = require('cors');
const app = express()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');

//middleware
app.use(cors())
app.use(express.json())

//mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bftlc.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const partCollection = client.db('sk_computers').collection('parts')

        app.get('/part', async (req, res) => {
            const query = {}
            const parts = await partCollection.find(query).toArray()
            res.send(parts)
        })

    }
    finally {

    }
}
run().catch(console.dir)

//server testing
app.get('/', (req, res) => {
    res.send('manufacturer server is running')
})

app.listen(port, () => {
    console.log('listening to port', port)
})