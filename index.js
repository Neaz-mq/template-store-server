const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
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
    const freeCollection = client.db("templateDb").collection("free");
    const testimonialsCollection = client.db("templateDb").collection("testimonials");

    // template related apis

    app.get('/template', async (req, res) => {
        const result = await templateCollection.find().toArray();
        res.send(result);
      });
   

  // free template related apis
    app.get('/free', async (req, res) => {
      const result = await freeCollection.find().toArray();
      res.send(result);
    });
    
   
    // testimonials related apis
    app.get('/testimonials', async (req, res) => {
      const result = await testimonialsCollection.find().toArray();
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