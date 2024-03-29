const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(
  "sk_test_51NqaJaCB7ApQkP6sI5oYkTWwTBDtXiFxwoNzisLMswiSuSJ59AX23b9jrrsRwu4fmTs1XFtl4BR9QN1KpufufNgJ00JblJLtOl"
);
require("dotenv").config();
// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId, Double } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5ipn6sc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("BistroDb").collection("users");
    const menuCollection = client.db("BistroDb").collection("menus");
    const reviewCollection = client.db("BistroDb").collection("reviews");
    const cartCollection = client.db("BistroDb").collection("cart");
    const paymentsCollection = client.db("BistroDb").collection("payments");

    // JWT Authorization //
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "29 days",
      });
      res.send({ token });
    });
    // jwt token middleware //
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // VERIFYADMIN MIDDLEWARE //
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // menu all data get  collection data
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    // specific menu data load _id //
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    // ADMIN ADDED TO THE MENU ITEMS //
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    // delete item from menu collection admin //
    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    // UPDATE item from menu collection admin //

    app.patch("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          recipe: item.recipe,
          category: item.category,
          price: item.price,
          image: item.image,
        },
      };
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // review collection data
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // ADD TO CART ::  CART USER ORDER API SHOW ORDER IN NAVBAR //
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    // CART DATA GET OPERATION  USER EMAIL SPECIFICS BY USER BOOKINGS API //

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // TODO: increase product quantity //

    // app.get("/carts/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await cartCollection.findOne(query);
    //   res.send(result);
    // });
    // //

    // app.patch('/carts/:id', async (req, res) => {
    //   const item = req.body;
    //   console.log('new quantity',item)
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const updatedDoc = {
    //     $inc: {
    //     quantity: ` ${(item.quantity)}` ,
    //     },
    //   };
    //   const result = await cartCollection.updateOne(filter, updatedDoc);
    //   res.send(result);
    // })

    // USER INFORMATION SAVED TO THE DATABASE BY USER EMAIL AND NAME //

    app.post("/users", async (req, res) => {
      const users = req.body;
      const query = { email: users?.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(users);
      res.send(result);
    });
    // ALL USERS API CALLED GET METHOD API //

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    // USER ADMIN CHECK API //
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res
          .status(403)
          .send({ message: "unauthorized access to admin" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // DELETE USER API //
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    // ADMIN API CREATE //

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // payments API //

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payments information save database API //

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentsCollection.insertOne(payment);
      // carefully delete the each  item in the cart //
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });

    // stats or analytics only admin access //

    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const orders = await paymentsCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      // this is not the best way to get revenue //
      // const payments = await paymentsCollection.find().toArray();
      // const revenue = payments.reduce((total,item) => total + item.price,0)
      console.log
      const result = await paymentsCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        orders,
        menuItems,
        revenue,
      });
    });

    // order items pipelines by aggrigate //

    // app.get("/order-stats", async (req, res) => {
    //   const result = await paymentsCollection
    //     .aggregate([
    //       {
    //         $unwind: "$menuItemIds",
    //       },
    //       {
    //         $lookup: {
    //           from: "menus",
    //           localField: "menuItemIds",
    //           foreignField: "_id",
    //           as: "order",
    //         },
    //       },
    //     ])
    //     .toArray();
    //   res.send(result);
    // });

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Ping your Deployment. You successfully connected to the MongoDB Database"
    // );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World! bistro boss!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
