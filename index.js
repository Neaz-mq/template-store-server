const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const SSLCommerzPayment = require('sslcommerz-lts');
const http = require('http');
const app = express();
const server = http.createServer(app);
const socketIo = require("socket.io");
const io = socketIo(server);

let messagesCollection;
let adminSocketId; // Variable to track the admin's socket ID

io.on("connection", (socket) => {
  console.log("A user connected");

  // Listen for incoming messages
  socket.on("sendMessage", async (data) => {
    const { email, message } = data;
    if (!email || !message) {
      console.error("Invalid message data");
      return;
    }

    console.log("Received message:", data);

    // Ensure only the user's email is sent
    const userEmail = data.user?.email; // Safely access `email` field

    if (!userEmail) {
      console.error("User email is missing in the data");
      return;
    }
    // Construct the message object to include only the email
    const messageData = {
      user: userEmail, // Save only the email
      message: data.message,
      timestamp: new Date(),
    };

    try {
      await messagesCollection.insertOne(messageData);
      console.log("Message saved to MongoDB:", messageData);

      // Emit the message to all clients with the sender's email
      io.emit("receiveMessage", {
        email: userEmail, // Send only the email
        message: data.message,
        timestamp: new Date(),
      });

      // Optional: Send a notification to the sender or other clients if needed.
      if (data.user?.displayName !== 'Admin') {  // Skip notification to admin if admin is the sender
        socket.broadcast.emit("receiveNotification", {
          user: data.user.displayName || 'Anonymous', // Sender's name or 'Anonymous'
          message: data.message, // Message content
        });
      }
    } catch (error) {
      console.error("Failed to save message to MongoDB:", error);
    }
  });
});

// Increase payload size limit (example: 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// middlewares

app.use(cors({
  origin: '*'
}));

app.use(express.json());
app.use(express.urlencoded());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: axios } = require('axios');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0zyo6s3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false //true for live, false for sandbox

// Create a MongoClient with a MongoClientOptions object to set the Stable API version

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

client.connect().then(() => {
  messagesCollection = client.db("templateDb").collection("messages");
});



/*  */
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
    const exclusiveCollection = client.db("templateDb").collection("exclusive");
    const messagesCollection = client.db("templateDb").collection("messages");
    const offerCollection = client.db("templateDb").collection("offer");
    const dealCollection = client.db("templateDb").collection("deal");

   
  // Fetch all messages for a specific user
app.get('/messages', async (req, res) => {
  const email = req.query.email;  // Fetch email from query parameters
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    // Fetch messages only for the specified user
    const messages = await messagesCollection.find({ email }).toArray();
    res.json(messages);  // Send back the messages for this email
  } catch (err) {
    res.status(500).send(err.message);
  }
});

    
// Save a new message
app.post('/messages', async (req, res) => {
  try {
    const { user, message } = req.body;
    if (!user?.email || !message) {
      return res.status(400).json({ error: 'Invalid message data' });
    }

    const sanitizedMessage = {
      email: user.email,
      message,
      timestamp: new Date(),
    };

    await messagesCollection.insertOne(sanitizedMessage);
    res.status(201).send("Message saved");
  } catch (err) {
    res.status(500).send(err.message);
  }
});


io.on("connection", async (socket) => {
  console.log("User connected");

  // Track the admin's socket ID
  socket.on('joinAdmin', () => {
    adminSocketId = socket.id;  // Store the socket ID for the admin
    console.log("Admin connected with socket ID:", adminSocketId);
  });

  socket.on("joinRoom", async (email) => {
    console.log(`User joined room: ${email}`);
    socket.join(email); // Join room specific to the user's email

    // Fetch and send previous messages for this user
    try {
      const previousMessages = await messagesCollection.find({ email }).toArray();
      socket.emit("loadPreviousMessages", previousMessages);  // Send previous messages back to client
    } catch (err) {
      console.error("Error fetching previous messages:", err);
    }
  });


  socket.on("sendMessage", async (data) => {
    const { email, message } = data;
    if (!email || !message) {
      console.error("Invalid message data");
      return;
    }

    const sanitizedMessage = {
      email,
      message,
      timestamp: new Date(),
    };


    try {
      // Save the sanitized message to the database
      await messagesCollection.insertOne(sanitizedMessage);

      // If the message is from a user (not admin), notify the admin
      if (data.user?.role !== 'admin') {
        // Broadcast the message to the admin (adminSocketId should be tracked)
        if (adminSocketId) {
          io.to(adminSocketId).emit("receiveMessage", sanitizedMessage);
        } else {
          console.error("Admin is not connected.");
        }
      }

       // Broadcast the message to the specific room
       io.to(email).emit("receiveMessage", sanitizedMessage);

    } catch (err) {
      console.error("Error saving or broadcasting message:", err.message);
    }
  })

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("A user disconnected");
      // Optional: Reset the adminSocketId if needed
      if (socket.id === adminSocketId) {
        adminSocketId = null;  // If admin disconnects, clear socket ID
      }
    });
});



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
        const exclusives = await exclusiveCollection.estimatedDocumentCount();

        // Count only successful orders
        const orders = await paymentCollection.countDocuments({
          status: 'success'  // Count only successful payments
        });

        const result = await paymentCollection.aggregate([
          {
            $match: {
              status: 'success'  // Only consider successful payments for revenue
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: '$amount'
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
          exclusives,
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
        projection: {  type: 1, category: 1,  price: 1,  image: 1, description: 1, specifications: 1, product: 1, documents: 1, picture: 1, records: 1, money: 1, license: 1, regular: 1, extended: 1 },
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
          image: temp.image,
          price: temp.price,
          description: temp.description,
          specifications: temp.specifications,
          product: temp.product,
          documents: temp.documents,
          picture: temp.picture,
          records: temp.records,
          money: temp.money,
          regular: temp.regular,
          extended: temp.extended,
          license: temp.license          
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
        projection: { type: 1, category: 1, price: 1, image: 1, description: 1, specifications: 1, product: 1, documents: 1, picture: 1, records: 1 },
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
          documents: temp.documents,
          picture: temp.picture,
          records: temp.records        
        }
      }

      const result = await freeCollection.updateOne(filter, updatedDoc)
      res.send(result);

    });


    // Banner Related apis

    app.get('/offer', async (req, res) => {
      const result = await offerCollection.find().toArray();
      res.send(result);
    });

    app.post('/offer', verifyToken, verifyAdmin, async (req, res) => {
      const offer = req.body;
      const result = await offerCollection.insertOne(offer);
      res.send(result);
    });

    app.get('/offer/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const options = {
        projection: { description: 1, details: 1,  text: 1, background: 1, image: 1, sub: 1 },
      };
      const result = await offerCollection.findOne(query, options);
      res.send(result);
    });

    app.patch('/offer/:id', async (req, res) => {
      const offer = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {  
          description: offer.description,  
          details: offer.details,  
          text: offer.text, 
          background: offer.background,
          image: offer.image,            
          sub: offer.sub           
        }
      }
      const result = await offerCollection.updateOne(filter, updatedDoc)
      res.send(result);
    });

    app.delete('/offer/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await offerCollection.deleteOne(query);
      res.send(result);
    });


     // Deal Related apis

     app.get('/deal', async (req, res) => {
      const result = await dealCollection.find().toArray();
      res.send(result);
    });

    app.post('/deal', verifyToken, verifyAdmin, async (req, res) => {
      const offer = req.body;
      const result = await dealCollection.insertOne(offer);
      res.send(result);
    });

    app.get('/deal/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const options = {
        projection: { description: 1, paragraph: 1, explanation: 1, representation: 1, details: 1, summary: 1, feature: 1, describe: 1, text: 1, sub: 1, shade: 1, tone: 1, color: 1, variant: 1, paint: 1, blush: 1,  background: 1, back: 1, framework: 1, frame: 1, image: 1, photo: 1 , picture: 1, figure: 1 },
      };
      const result = await dealCollection.findOne(query, options);
      res.send(result);
    });

    app.patch('/deal/:id', async (req, res) => {
      const deal = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {  
          description: deal.description,  
          paragraph: deal.paragraph,  
          explanation: deal.explanation,  
          representation: deal.representation,  
          details: deal.details,  
          summary: deal.summary,  
          feature: deal.feature,  
          describe: deal.describe,  
          text: deal.text, 
          color: deal.color,    
          shade: deal.shade,
          tone: deal.tone,
          sub: deal.sub,
          variant: deal.variant,
          paint: deal.paint,
          blush: deal.blush,
          background: deal.background,
          back: deal.back,
          framework: deal.framework,
          frame: deal.frame,
          image: deal.image,            
          photo: deal.photo,           
          picture: deal.picture,           
          figure: deal.figure                               
        }
      }
      const result = await dealCollection.updateOne(filter, updatedDoc)
      res.send(result);
    });

    app.delete('/deal/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await dealCollection.deleteOne(query);
      res.send(result);
    });



// Exclusive Template

    app.get('/exclusive', async (req, res) => {
      const result = await exclusiveCollection.find().toArray();
      res.send(result);
    });

    app.post('/exclusive', verifyToken, verifyAdmin, async (req, res) => {
      const temp = req.body;
      const result = await exclusiveCollection.insertOne(temp);
      res.send(result);
    });


    app.get('/exclusive/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const options = {
        // Include only the `title` and `imdb` fields in the returned document
        projection: { type: 1, category: 1,  price: 1,  image: 1, description: 1, specifications: 1, product: 1, documents: 1, picture: 1, records: 1, money: 1, license: 1, regular: 1, extended: 1},
      };
      const result = await exclusiveCollection.findOne(query, options);
      res.send(result);
    });

    app.delete('/exclusive/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await exclusiveCollection.deleteOne(query);
      res.send(result);
    });

    app.patch('/exclusive/:id', async (req, res) => {
      const temp = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        
        $set: {
          type: temp.type,
          category: temp.category,
          image: temp.image,
          price: temp.price,
          description: temp.description,
          specifications: temp.specifications,
          product: temp.product,
          documents: temp.documents,
          picture: temp.picture,
          records: temp.records,
          money: temp.money,
          regular: temp.regular,
          extended: temp.extended,
          license: temp.license

        }
      }

      const result = await exclusiveCollection.updateOne(filter, updatedDoc)
      res.send(result);

    });


    // testimonials related apis

    app.get('/testimonials', async (req, res) => {
      const result = await testimonialsCollection.find().toArray();
      res.send(result);
    });

    // cart collection apis

    app.get('/carts', async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};
        
        // If an email is provided, filter by email
        if (email) {
          query = { email: email };
        }
    
        // Fetch carts based on the query
        const carts = await cartCollection.find(query).toArray();
        res.send(carts); // Send the retrieved carts as a response
      } catch (error) {
        console.error('Error fetching carts:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });
    
    // Post to add a cart item
    app.post('/carts', async (req, res) => {
      try {
        const cartItem = req.body; // Expect cartItem data in the request body
        const result = await cartCollection.insertOne(cartItem);
        res.send(result); // Return the result of the insertion
      } catch (error) {
        console.error('Error adding cart item:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });
    
    // Delete a cart item by ID
    app.delete('/carts/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }; // Convert ID to ObjectId
        const result = await cartCollection.deleteOne(query);
        res.send(result); // Return the result of the deletion
      } catch (error) {
        console.error('Error deleting cart item:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });
    

    // Assuming you have an endpoint to handle payment confirmation
    app.post("/payment-confirmation", async (req, res) => {
      const paymentData = req.body; // This should include payment details

      // Example structure for paymentData
      // const { email, status } = paymentData;

      try {
        // Check payment status
        if (paymentData.status === "success") {
          // If payment is successful, clear the cart
          await cartCollection.deleteMany({ email: paymentData.email });
          console.log("Cart cleared successfully for:", paymentData.email);
        }

        // Save the payment details to the payments collection
        await paymentsCollection.insertOne(paymentData);

        res.status(200).json({ message: "Payment processed successfully" });
      } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Cart clearing endpoint
    app.post("/clear-cart", async (req, res) => {
      const { email } = req.body;
      try {
        const result = await cartCollection.deleteMany({ email: email });
        if (result.deletedCount > 0) {
          return res.json({ success: true });
        } else {
          return res.json({ success: false, message: "No items to clear" });
        }
      } catch (error) {
        console.error("Error clearing cart:", error);
        return res.status(500).send({ message: "Internal Server Error" });
      }
    });


    // monthly statistics

    app.get('/monthly-stats', verifyToken, verifyAdmin, async (req, res) => {
      const { month, year } = req.query;
    
      // Validate month and year
      if (!month || !year) {
          return res.status(400).send({ message: 'Month and year are required' });
      }
    
      // Define the start and end dates based on the selected month and year
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
    
      try {
          // Count successful orders based on `_id` timestamp
          const orders = await paymentCollection.countDocuments({
              _id: { $gte: ObjectId.createFromTime(startDate.getTime() / 1000), $lt: ObjectId.createFromTime(endDate.getTime() / 1000) },
              status: 'success' // Count only successful payments
          });
    
          // Aggregate revenue from successful payments
          const result = await paymentCollection.aggregate([
              {
                  $match: {
                      _id: { $gte: ObjectId.createFromTime(startDate.getTime() / 1000), $lt: ObjectId.createFromTime(endDate.getTime() / 1000) },
                      status: 'success' // Only consider successful payments for revenue
                  }
              },
              {
                  $group: {
                      _id: null,
                      totalRevenue: { $sum: '$amount' }
                  }
              }
          ]).toArray();
    
          const revenue = result.length > 0 ? result[0].totalRevenue : 0;
    
          // Send the data with orders and revenue
          res.send({
              orders,
              revenue
          });
    
      } catch (error) {
          console.error('Error fetching monthly stats:', error);
          res.status(500).send({ message: 'Internal Server Error', error: error.message });
      }
    });
    

    // SSLCommerz Payment Route

    app.post("/create-payment", async (req, res) => {
      try {
          const { amount, customerEmail } = req.body;
  
          // Step 1: Retrieve the cart items from the carts collection
          const cartItems = await cartCollection.find({ email: customerEmail }).toArray();
          if (cartItems.length === 0) {
              return res.status(404).send({ message: 'No cart items found for the user.' });
          }
  
          // Step 2: Extract all tempIds, types, and records, and calculate the total amount
          const tempIds = cartItems.map(item => item.tempId);
          const types = cartItems.map(item => item.type);
          const records = cartItems.map(item => item.records || []).flat();
  
          // Total amount in USD
          const totalAmountInUSD = cartItems.reduce((total, item) => total + item.price, 0);
  
          // Step 3: Fetch USD to BDT exchange rate from Open Exchange Rates API
          const exchangeRateApiUrl = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE}/latest/USD`;
          const exchangeRateResponse = await axios.get(exchangeRateApiUrl);
          
          // Get the exchange rate for USD to BDT from the API response
          const exchangeRate = exchangeRateResponse.data.conversion_rates.BDT;
          
          if (!exchangeRate) {
              return res.status(500).send({ message: 'Unable to fetch exchange rate.' });
          }
  
          // Convert the total amount from USD to BDT
          const totalAmountInBDT = totalAmountInUSD * exchangeRate;
  
          // Initialize SSLCommerz
          const sslcommerz = new SSLCommerzPayment(store_id, store_passwd, is_live);
  
          // Prepare data for the payment request
          const data = {
              store_id: process.env.STORE_ID,
              store_passwd: process.env.STORE_PASS,
              total_amount: totalAmountInBDT, // Send amount in BDT
              tran_id: new Date().getTime().toString(),
              success_url: "http://localhost:5000/success-payment",
              fail_url: "http://localhost:5000/fail-payment",
              cancel_url: "http://localhost:5000/cancel-payment",
              cus_email: customerEmail,
              cus_add1: "Dhaka",
              cus_add2: "Dhaka",
              cus_city: "Dhaka",
              cus_state: "Dhaka",
              cus_postcode: 1000,
              cus_country: "Bangladesh",
              cus_phone: "01711111111",
              cus_fax: "01711111111",
              shipping_method: "NO",
              product_name: "Template",
              product_category: "Design",
              product_profile: "general",
              multi_card_name: "mastercard,visacard,amexcard",
              value_a: "ref001_A",
              value_b: "ref002_B",
              value_c: "ref003_C",
              value_d: "ref004_D",
          };
  
          // Step 4: Initialize the payment using SSLCommerz
          const apiResponse = await sslcommerz.init(data);
  
          if (apiResponse?.GatewayPageURL) {
              const saveData = {
                  cus_email: customerEmail,
                  paymentId: data.tran_id,
                  amount: totalAmountInUSD, // Save in USD for your reference
                  status: "pending",
                  tempId: tempIds,
                  types: types,
                  records: records, // Include records here
              };
  
              // Save payment record to the database
              await paymentCollection.insertOne(saveData);
  
              return res.send({ paymentUrl: apiResponse.GatewayPageURL });
          } else {
              return res.status(500).send({ message: 'Payment initialization failed.' });
          }
      } catch (error) {
          console.error("Error creating payment:", error);
  
          if (!res.headersSent) {
              return res.status(500).send({ message: "Internal Server Error", error: error.message });
          }
      }
  });
  
  
  
  

    // Payment success route

    app.post("/success-payment", async (req, res) => {
      try {
        const successData = req.body;

        console.log("Payment success data:", successData); // Log the response data

        // Assuming successData contains `tran_id` and other fields
        const filter = { paymentId: successData.tran_id };
        const updateDoc = {
          $set: {
            status: "success",
            paymentResponse: successData, // Ensure this contains all relevant info
            // Save the customer email
          },
        };

        await paymentCollection.updateOne(filter, updateDoc);

        // Clear the user's cart after successful payment
        await cartCollection.deleteMany({ email: successData.cus_email });

        res.redirect('http://localhost:5173/dashboard/paymentHistory?fromPaymentSuccess=true');
      } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });


    app.get('/payments/:email', async (req, res) => {
      try {
        const cus_email = req.params.email;
        const payments = await paymentCollection.find({ cus_email }).toArray(); // Ensure you're querying the correct field
        res.send(payments);
      } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });


    // Payment fail route

    app.post("/fail-payment", async (req, res) => {
      try {
        const failData = req.body;

        // Assuming failData contains `tran_id` and `status`
        const filter = { paymentId: failData.tran_id };
        const updateDoc = {
          $set: {
            status: "failed",
            paymentResponse: failData,
          },
        };

        // Update the payment status in the database
        await paymentCollection.updateOne(filter, updateDoc);

        // No need to clear the user's cart in case of a failed payment

        res.redirect("http://localhost:5173/dashboard/fail-payment");
      } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });


    app.post("/cancel-payment", async (req, res) => {
      try {
        const cancelData = req.body;

        // Assuming cancelData contains `tran_id` and `status`
        const filter = { paymentId: cancelData.tran_id };
        const updateDoc = {
          $set: {
            status: "canceled",
            paymentResponse: cancelData,
          },
        };

        // Update the payment status in the database
        await paymentCollection.updateOne(filter, updateDoc);

        // No need to clear the user's cart in case of a canceled payment

        res.redirect("http://localhost:5173/dashboard/cancel-payment")
      } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });


  app.get('/payments', async (req, res) => {
    try {
      const payments = await paymentCollection.find().toArray(); // Fetch all payment documents
      res.send(payments); // Send the retrieved payments as a response
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).send({ message: 'Internal Server Error' });
    }
  });


// Route to get payment by tran_id
app.get('/payments/tran/:tranId', async (req, res) => {
  const tranId = req.params.tranId; // Get the transaction ID from the request parameters

  try {
      // Query the payments collection for the document with the specified tran_id
      const payment = await paymentCollection.findOne({ paymentId: tranId });
      
      if (!payment) {
          return res.status(404).json({ message: 'Payment not found' });
      }

      res.json(payment); // Return the found payment document
  } catch (error) {
      console.error(error); // Log the error for debugging
      res.status(500).json({ message: 'Internal server error', error });
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
            revenue: { $sum: '$templateItem.amount' }
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