const express = require('express');
const cors = require('cors');
const app = express()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

//middleware
app.use(cors())
app.use(express.json())

//mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bftlc.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next()
    })
}

async function run() {
    try {
        await client.connect();
        const partCollection = client.db('sk_computers').collection('parts')
        const userCollection = client.db('sk_computers').collection('users')
        const orderCollection = client.db('sk_computers').collection('orders')
        const reviewCollection = client.db('sk_computers').collection('reviews')
        const profileCollection = client.db('sk_computers').collection('profiles')
        const paymentCollection = client.db('sk_computers').collection('payments')

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                res.status(403).send({ message: 'forbidden' })
            }
        }

        //get all products for home page
        app.get('/part', async (req, res) => {
            const query = {}
            const parts = await partCollection.find(query).sort({ _id: -1 }).limit(6).toArray()
            res.send(parts)
        });

        //get detail of one product in purchase page
        app.get('/part/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const singlePart = await partCollection.findOne(query);
            res.send(singlePart)
        });

        //insert or update a users info
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '30d'
            })
            res.send({ result, token })
        });

        //get a users info
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })

        //insert an order info
        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result)
        });

        //get my orders list in my orders page
        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email }
                const orders = await orderCollection.find(query).toArray()
                return res.send(orders)
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }
        });

        //delete a product from my order
        app.delete('/userProduct/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result)
        });

        //post a review in add review page
        app.post('/review', verifyJWT, async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result)
        })

        //get all reviews for home page
        app.get('/review', async (req, res) => {
            const result = await reviewCollection.find().sort({ _id: -1 }).toArray();
            res.send(result)
        });

        //update my profile in my profile page
        app.put('/profile/:email', async (req, res) => {
            const email = req.params.email;
            const profile = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const updatedDoc = {
                $set: profile
            }
            const result = await profileCollection.updateOne(filter, updatedDoc, options);
            res.send(result)
        });
        //update a user to admin by an admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updatedDoc = {
                $set: { role: 'admin' }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        });
        //check a user wheather he is admin or not
        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })
        //insert a new product by admin
        app.post('/product', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await partCollection.insertOne(product)
            res.send(result)
        });
        //get all products by admin 
        app.get('/products', verifyJWT, verifyAdmin, async (req, res) => {
            const products = await partCollection.find().toArray()
            res.send(products)
        });

        //Delete product by admin
        app.delete('/adminProduct/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await partCollection.deleteOne(query);
            res.send(result)
        });
        //get all orders for admin
        app.get('/allOrders', verifyJWT, verifyAdmin, async (req, res) => {
            const allOrders = await orderCollection.find().toArray();
            res.send(allOrders)
        });

        //payment API
        //Get a info of specific order by id
        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const order = await orderCollection.findOne(query)
            res.send(order)
        });

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { totalPrice } = req.body;
            const amount = totalPrice * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({ clientSecret: paymentIntent.client_secret })
        });
        //add paid property to an order when paid
        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder)
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