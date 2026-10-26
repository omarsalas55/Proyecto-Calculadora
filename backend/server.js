
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());


app.use(express.static(path.join(__dirname, "..")));

app.get("/api", (req, res) => {
  res.json({
    mensaje: "Servidor de la calculadora funcionando"
  });
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "calculadora.html"));
});
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
 