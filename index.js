const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middlewares

app.use(cors({
  origin: '*'
}));

app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0zyo6s3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {

  try {

    // Connect the client to the server	(optional starting in v4.7)

    const templateCollection = client.db("templateDb").collection("template");
    const userCollection = client.db("templateDb").collection("users");
    const freeCollection = client.db("templateDb").collection("free");
    const testimonialsCollection = client.db("templateDb").collection("testimonials");
    const cartCollection = client.db("templateDb").collection("carts");
    const paymentCollection = client.db("templateDb").collection("payments");
    const visitCollection = client.db("templateDb").collection("visits");

    app.post('/api/visit', async (req, res) => {
      console.log('Visit endpoint hit'); // Add this line for debugging
      try {
        // Increment the visit count
        await visitCollection.updateOne(
          {},
          { $inc: { count: 1 } },
          { upsert: true } // Create the document if it does not exist
        );
    
        // Fetch the updated visit count
        const visitData = await visitCollection.findOne({});
        res.send({ visits: visitData.count });
      } catch (error) {
        console.error('Error updating visit count:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });
    

    app.get('/admin-stats', async (req, res) => {
      try {
        const users = await userCollection.estimatedDocumentCount();
        const templates = await templateCollection.estimatedDocumentCount();
        const free = await freeCollection.estimatedDocumentCount();
        const orders = await paymentCollection.estimatedDocumentCount();
    
        const result = await paymentCollection.aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: '$price'
              }
            }
          }
        ]).toArray();
    
        const revenue = result.length > 0 ? result[0].totalRevenue : 0;
    
        // Fetch the visit count
        const visitData = await visitCollection.findOne({});
        const visits = visitData ? visitData.count : 0;
    
        res.send({
          users,
          templates,
          free,
          orders,
          revenue,
          visits // Add the visit count to the response
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });
    

    // jwt related api

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });


    // middlewares 

    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);

      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }

      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }


    // use verify admin after verifyToken

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }


    // users related api

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });


    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists: 
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });


    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });


    // Add this route to fetch admin users

    app.get('/admins', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const admins = await userCollection.find({ role: 'admin' }, { projection: { _id: 1, name: 1, email: 1 } }).toArray();
        res.json(admins);
      } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });


    // template related apis

    app.get('/template', async (req, res) => {
      const result = await templateCollection.find().toArray();
      res.send(result);
    });


    app.get('/template/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const options = {

        projection: { type: 1, category: 1, price: 1, image: 1,  description: 1, specifications: 1, product: 1, documents: 1, picture: 1, revisions: 1, files: 1 },
      };

      const result = await templateCollection.findOne(query, options);
      res.send(result);

    });

    app.post('/template', verifyToken, verifyAdmin, async (req, res) => {
      const temp = req.body;
      const result = await templateCollection.insertOne(temp);
      res.send(result);
    });

    app.delete('/template/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await templateCollection.deleteOne(query);
      res.send(result);
    });

    app.patch('/template/:id', async (req, res) => {
      const temp = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          type: temp.type,
          category: temp.category,
          price: temp.price,
          image: temp.image,
          description: temp.description,
          specifications: temp.specifications,
          product: temp.product,
          revisions: temp.revisions,
          documents: temp.documents,
          picture: temp.picture,
          files: temp.files,
        }
      }

      const result = await templateCollection.updateOne(filter, updatedDoc)
      res.send(result);
    });


    // free template related apis

    app.get('/free', async (req, res) => {
      const result = await freeCollection.find().toArray();
      res.send(result);
    });


    app.post('/free', verifyToken, verifyAdmin, async (req, res) => {
      const temp = req.body;
      const result = await freeCollection.insertOne(temp);
      res.send(result);
    });


    app.get('/free/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const options = {
        // Include only the `title` and `imdb` fields in the returned document
        projection: { type: 1, category: 1, price: 1, image: 1,  description: 1, specifications: 1, product: 1, documents: 1, picture: 1, revisions: 1, files: 1 },
      };
      const result = await freeCollection.findOne(query, options);
      res.send(result);
    });


    app.delete('/free/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await freeCollection.deleteOne(query);
      res.send(result);
    });


    app.patch('/free/:id', async (req, res) => {
      const temp = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          type: temp.type,
          category: temp.category,
          price: temp.price,
          image: temp.image,
          description: temp.description,
          specifications: temp.specifications,
          product: temp.product,
          revisions: temp.revisions,
          documents: temp.documents,
          picture: temp.picture,
          files: temp.files,
        }
      }

      const result = await freeCollection.updateOne(filter, updatedDoc)
      res.send(result);

    });



    // testimonials related apis

    app.get('/testimonials', async (req, res) => {
      const result = await testimonialsCollection.find().toArray();
      res.send(result);
    });


    // cart collection apis

    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });


    // payment intent

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });


    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne({
        ...payment,
        createdAt: new Date() // Add this line to include the timestamp
      });
    
      // Carefully delete each item from the cart
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };
    
      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });
    


    // Route to get monthly statistics
app.get('/monthly-stats', verifyToken, verifyAdmin, async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).send({ message: 'Month and year are required' });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  try {
    const orders = await paymentCollection.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const result = await paymentCollection.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$price' }
        }
      }
    ]).toArray();

    const revenue = result.length > 0 ? result[0].totalRevenue : 0;

    res.send({
      orders,
      revenue
    });
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});



    // using aggregate pipeline

    app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $unwind: "$tempItemIds"
        },

        {
          $lookup: {
            from: "template",
            localField: "tempItemIds",
            foreignField: "_id",
            as: "templateItem"
          }
        },

        {
          $unwind: "$templateItem"
        },

        {
          $group: {
            _id: '$templateItem.category',
            quantity: { $sum: 1 },
            revenue: { $sum: '$templateItem.price' }
          }
        },
        
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }

      ]).toArray();

      res.send(result);

    });


    // Send a ping to confirm a successful connection

    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Templates are here')
})

app.listen(port, () => {
  console.log(`Template store is live on port ${port}`);
})