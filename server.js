const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const db = require("./db"); // <-- your db.js file

const app = express();

// ✅ MySQL session store config
const sessionStore = new MySQLStore({
  host: "bcnineplj7dyjhrseuiu-mysql.services.clever-cloud.com",
  user: "uq6vpcfofhquauek",
  password: "okCTiQ7eN5BjKnz7cX96",
  database: "bcnineplj7dyjhrseuiu",
  port: 3306,
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 minutes
  expiration: 86400000, // 1 day
});

// ✅ Express-session middleware
app.use(
  session({
    key: "salon_session_id",
    secret: "mySecretKey123", // change to strong secret
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Test route
app.get("/", (req, res) => {
  if (req.session.views) {
    req.session.views++;
    res.send(`Welcome back! You visited ${req.session.views} times.`);
  } else {
    req.session.views = 1;
    res.send("Hello! First visit, session started 🎉");
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
