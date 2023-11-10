const express = require("express");
const router = express.Router();
const mysql = require("mysql2");

const databaseConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
};

const pool = mysql.createPool(databaseConfig);

router.get("/", function (req, res, next) {
  pool.getConnection((err, connection) => {
    connection.query(
      "SELECT * FROM zaposlenik_v2",
      function (queryErr, results) {
        connection.release();

        if (queryErr) {
          console.error("Error executing query:", queryErr);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        console.log("Query results:", results);
      }
    );
  });
});

module.exports = router;
