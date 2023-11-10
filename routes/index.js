const express = require("express");
const axios = require("axios");
const mysql = require("mysql2");
require("dotenv").config();

const router = express.Router();

const dbConnection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
});

function convertStrToNum(v) {
  if (v === "") {
    return null;
  }
  return v.replace(",", ".");
}

router.get("/kursna-lista", async (req, res, next) => {
  try {
    const response = await axios.get(
      "https://cbbh.ba/CurrencyExchange/GetJson?date=" +
        new Date().toISOString().slice(0, 10)
    );

    if (response.status === 200) {
      const { data: responseData } = response;
      dbConnection.connect();
      console.log("responseData", responseData);

      const date = new Date(responseData.Date.slice(0, 10));
      const data = {
        date: date,
        year: date.getFullYear(),
        number: responseData.Number,
      };

      dbConnection.query(
        "INSERT INTO kursna_lista (datum_kursne_liste, godina, broj_kursne_liste) VALUES (?, ?, ?)",
        [data.date, data.year, data.number],
        function (error, results) {
          if (error) throw error;

          const exchangeRatesId = results.insertId;

          for (const value of responseData.CurrencyExchangeItems) {
            dbConnection.query(
              "INSERT INTO kurs_valute (kursna_lista_id, oznaka_valute, kod_valute, jedinica, kupovni_kurs, srednji_kurs, prodajni_kurs) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [
                exchangeRatesId,
                value.AlphaCode,
                value.NumCode,
                value.Units,
                convertStrToNum(value.Buy),
                convertStrToNum(value.Middle),
                convertStrToNum(value.Sell),
              ],
              function (error) {
                if (error) throw error;
              }
            );
          }
          dbConnection.commit();
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
