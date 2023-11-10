const express = require("express");
const axios = require("axios");
const mysql = require("mysql2");
require("dotenv").config();

const router = express.Router();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
});

router.get("/", async (req, res, next) => {
  try {
    const response = await axios.get(
      "https://cbbh.ba/CurrencyExchange/GetJson?date=" +
        new Date().toISOString().slice(0, 10)
    );

    if (response.status === 200) {
      const { data: responseData } = response;
      connection.connect();

      const date = new Date(responseData.Date.slice(0, 10));
      const data = {
        date: date,
        year: date.getFullYear(),
        number: responseData.Number,
      };

      connection.query(
        "INSERT INTO kursna_lista (datum_kursne_liste, godina, broj_kursne_liste) VALUES (?, ?, ?)",
        [data.date, data.year, data.number],
        function (error, results) {
          if (error) throw error;

          const exchangeRatesId = results.insertId;

          for (const value of responseData.CurrencyExchangeItems) {
            connection.query(
              "INSERT INTO kurs_valute (kursna_lista_id, oznaka_valute, kod_valute, jedinica, kupovni_kurs, srednji_kurs, prodajni_kurs) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [
                exchangeRatesId,
                value.AlphaCode,
                value.NumCode,
                value.Units,
                Number(value.Buy),
                Number(value.Middle),
                Number(value.Sell),
              ],
              function (error) {
                if (error) throw error;
              }
            );
          }

          connection.end();
        }
      );
      res.status(200).json({ message: "Successfully inserted data." });
    } else {
      res.status(500).json({ error: "Failed to fetch data." });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal Server Error." });
  }
});

module.exports = router;
