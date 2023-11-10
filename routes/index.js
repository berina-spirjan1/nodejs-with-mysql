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

          responseData.CurrencyExchangeItems.map((value) => {
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
          });
          dbConnection.commit();
        }
      );
      res
        .status(200)
        .json({ message: "Successfully inserted data.", status: 200 });
    } else {
      res.status(500).json({ error: "Failed to fetch data." });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal Server Error." });
  }
  dbConnection.close();
});

router.get("/lista-zaposlenika", function (req, res, next) {
  dbConnection.connect();
  dbConnection.query(
    "SELECT * FROM zaposlenik_v2",
    function (queryErr, results) {
      if (queryErr) {
        console.error("Error executing query:", queryErr);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      dbConnection.commit();
      res.status(200).json({ status: 200, data: results });
    }
  );
  dbConnection.close();
});

router.get("/kursna-lista-sp", async (req, res, next) => {
  try {
    const response = await axios.get(
      "https://cbbh.ba/CurrencyExchange/GetJson?date=" +
        new Date().toISOString().slice(0, 10)
    );

    if (response.status === 200) {
      const { data: responseData } = response;

      dbConnection.connect();

      const date = new Date(responseData.Date.slice(0, 10));

      const data = {
        date: date,
        year: date.getFullYear(),
        number: responseData.Number,
      };

      dbConnection.query(
        "CALL proc_dodaj_kursnu_listu(?, ?, ?, @p_kod_greske, @p_kursna_lista_id)",
        [data.date, data.year, data.number, 0, 0],
        function (error, results, fields) {
          if (error) {
            console.error("Error:", error.message);
            dbConnection.rollback();
            res.status(500).json({ error: "Failed to insert data." });
            return;
          }

          dbConnection.query(
            "SELECT @p_kod_greske, @p_kursna_lista_id",
            function (selectError, selectResults) {
              if (selectError) {
                console.error("Error:", selectError.message);
                dbConnection.rollback();
                res.status(500).json({ error: "Failed to insert data." });
                return;
              }

              const statusCode = selectResults[0]["@p_kod_greske"];
              const kursnaListaId = selectResults[0]["@p_kursna_lista_id"];

              if (statusCode !== 0) {
                if (statusCode === 1) {
                  res.status(400).json({
                    message:
                      "Exchange rate list with the given number already exists in the database.",
                  });
                } else if (statusCode === 2) {
                  res.status(400).json({
                    message:
                      "Exchange rate list for the specified date already exists in the database.",
                  });
                }
                dbConnection.rollback();
                return;
              }

              responseData.CurrencyExchangeItems.map((value) => {
                dbConnection.query(
                  "INSERT INTO kurs_valute (kursna_lista_id, oznaka_valute, kod_valute, jedinica, kupovni_kurs, srednji_kurs, prodajni_kurs) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  [
                    kursnaListaId,
                    value.AlphaCode,
                    value.NumCode,
                    value.Units,
                    convertStrToNum(value.Buy),
                    convertStrToNum(value.Middle),
                    convertStrToNum(value.Sell),
                  ],
                  function (insertError) {
                    if (insertError) {
                      console.error("Error:", insertError.message);
                      dbConnection.rollback();
                      res.status(500).json({ error: "Failed to insert data." });
                      return;
                    }
                  }
                );
              });

              dbConnection.commit();
              res.status(200).json({
                message: "Successfully inserted data.",
                status: 200,
              });
            }
          );
        }
      );
    } else {
      res.status(500).json({ error: "Failed to fetch data." });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal Server Error." });
  }
  dbConnection.close();
});

router.get("/proc-vise-datasetova", (req, res) => {
  dbConnection.connect();
  dbConnection.query(
    "CALL vrati_podatke_zaposlenika(?)",
    [1],
    (error, results) => {
      if (error) {
        console.error("Error executing procedure:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      res.status(200).json({ data: results[1], employee: results[0] });
    }
  );
  dbConnection.close();
});

router.get("/proc-povratni-rezultat/:x", (req, res) => {
  const x = req.params.x;

  dbConnection.connect();
  dbConnection.query("CALL sp_kvadrat(?, @rezultat)", [x], (error, results) => {
    if (error) {
      console.error("Error executing procedure:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    dbConnection.query(
      "SELECT @rezultat as result",
      (selectError, selectResults) => {
        if (selectError) {
          console.error("Error fetching result:", selectError);
          return res.status(500).json({ error: "Internal Server Error" });
        }

        const result = selectResults[0].result;
        res.status(200).json({ result });
      }
    );
  });
  dbConnection.close();
});

module.exports = router;
