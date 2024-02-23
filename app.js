const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "userData.db");

let db = null;

const initializedbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running...");
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};

initializedbAndServer();

app.get("/users/", async (request, response) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(400);
    response.send("InValid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, playload) => {
      if (error) {
        response.status(400);
        response.send("InValid Access Token");
      } else {
        const getUserstQuery = `SELECT * FROM user;`;
        const getUsers = await db.all(getUserstQuery);
        response.send(getUsers);
      }
    });
  }
});

// Register user

app.post("/register/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const getUser = await db.get(getUserQuery);

  // console.log(getUser)

  if (getUser === undefined) {
    // add user into database
    if (password.length < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashPassword = await bcrypt.hash(password, 10);
      const addUserQuery = `
      INSERT INTO user 
        (username, name, password, gender, location) 
      VALUES
        ('${username}', '${name}', '${hashPassword}', '${gender}', '${location}');`;

      await db.run(addUserQuery);

      // console.log(hashPassword)
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    //user alredy exists
    response.status(400);
    response.send("User already exists");
  }
});

// Login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const getUser = await db.get(getUserQuery);
  // console.log(getUser)

  if (getUser === undefined) {
    // user not found in db
    response.status(400);
    response.send("Invalid user");
  } else {
    // comare password
    const isPasswordMatch = await bcrypt.compare(password, getUser.password);

    if (isPasswordMatch) {
      const playload = { username: username };
      const jwtToken = jwt.sign(playload, "MY_SECRET_TOKEN");

      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Change Password

app.put("/change-password/", async (request, response) => {
  try {
    const { username, oldPassword, newPassword } = request.body;
    const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const getUser = await db.get(getUserQuery);

    if (getUser === undefined) {
      // user not exists in db
      response.status(400);
      response.send("Wrong Username");
    } else {
      const isPasswordMatch = await bcrypt.compare(
        oldPassword,
        getUser.password
      );
      if (isPasswordMatch) {
        // password match
        if (newPassword.length < 5) {
          response.status(400);
          response.send("Password is too short");
        } else {
          // const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
          // const getUser = await db.get(getUserQuery)
          const newHashPassword = await bcrypt.hash(newPassword, 10);
          const updateUserQuery = `UPDATE 
          user
        SET
          password = '${newHashPassword}'
        WHERE
          username = '${username}'`;
          await db.run(updateUserQuery);

          response.status(200);
          response.send("Password updated");
        }
      } else {
        // password don't match
        response.status(400);
        response.send("Invalid current password");
      }
    }
  } catch (e) {
    console.log(`Error : ${e.message}`);
  }
});

module.exports = app;
