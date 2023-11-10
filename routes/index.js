const express = require("express");
const router = express.Router();
const mysql = require("mysql2");

// Database configuration
const databaseConfig = {
  host: "bazepodataka.ba",
  port: 7306,
  user: "student",
  password: "student2023",
  database: "student",
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
