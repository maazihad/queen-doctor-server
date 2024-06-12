const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.71pfsan.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// MongoDB Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const logger = async (req, res, next) => {
  console.log('Called :', req.hostname, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log('Verify token : ', token);

  if (!token) {
    return res.status(401).send({ message: 'Forbidden Access' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Unauthorized Access' });
    }
    req.user = decoded;
    next();
  });
};

// const verifyToken2 = (req, res, next) => {
//   const token = req.cookies.token;
//   console.log('Token:', token);
//   if (!token) {
//     return res.sendStatus(403);
//   }

//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
//     if (err) {
//       return res.sendStatus(403);
//     }
//     req.user = user;
//     next();
//   });
// };

async function run() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const servicesCollections = client.db('queenDoctor').collection('services');
    const bookingCollections = client.db('queenDoctor').collection('bookings');

    // Auth related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '5h',
      });
      console.log('User email is ', user);
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: false,
          // maxAge: 60 * 60 * 24 * 7 * 1000, // 1 week in milliseconds
          // sameSite: 'none',
        })
        .send({ success: true });
    });

    app.get('/services', logger, async (req, res) => {
      const result = await servicesCollections.find().toArray();
      res.send(result);
    });

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, img: 1, price: 1 },
      };
      const result = await servicesCollections.findOne(query, options);
      res.send(result);
    });

    app.get('/bookings', logger, verifyToken, async (req, res) => {
      console.log('Cookies:', req.cookies.token);
      // console.log('User valid token is ', req.user);

      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: 'Forbidden Access' });
      }
      let query = {};

      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollections.find(query).toArray();
      res.send(result);
    });

    app.post('/bookings', async (req, res) => {
      const bookingData = req.body;
      console.log(bookingData);
      const result = await bookingCollections.insertOne(bookingData);
      res.send(result);
    });

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const fromBody = req.body;
      const updateDoc = {
        $set: {
          status: fromBody.status,
        },
      };
      const result = await bookingCollections.updateOne(filter, updateDoc);
      console.log(result);
      res.send(result);
    });

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollections.deleteOne(query);
      res.send(result);
    });
  } catch (error) {
    console.error(error);
  } finally {
    // Uncomment this to close the client connection when the app is terminating
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('App is running...');
});
app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
