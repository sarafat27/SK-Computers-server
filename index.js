const express = require('express');
const cors = require('cors');
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()
const jwt = require('jsonwebtoken');

//middleware
app.use(cors())
app.use(express.json())

//server testing
app.get('/', (req, res) => {
    res.send('manufacturer server is running')
})

app.listen(port, () => {
    console.log('listening to port', port)
})