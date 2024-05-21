const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const path = require("path");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const RECEIVER_EMAIL = "nieva.cronos@gmail.com"; // Email fijo al que se enviarán los datos

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/auth/google", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
  });
  res.redirect(authUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).json({ message: "Falta el código de autorización." });
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    process.env.ACCESS_TOKEN = tokens.access_token;
    process.env.REFRESH_TOKEN = tokens.refresh_token;

    res.redirect("/");
  } catch (error) {
    console.error("Error al obtener el token de acceso:", error);
    res.status(500).json({ message: "Error al obtener el token de acceso." });
  }
});

app.post("/send-email", async (req, res) => {
  const { email, nombre, apellido, mensaje } = req.body;

  if (!email || !nombre || !apellido || !mensaje) {
    return res.status(400).json({ message: "Faltan campos en el formulario." });
  }

  try {
    oAuth2Client.setCredentials({
      access_token: process.env.ACCESS_TOKEN,
      refresh_token: process.env.REFRESH_TOKEN,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: process.env.ACCESS_TOKEN,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: RECEIVER_EMAIL, // Email fijo
      subject: `Mensaje de ${nombre} ${apellido}`,
      text: `Nombre: ${nombre}\nApellido: ${apellido}\nEmail: ${email}\n\nMensaje:\n${mensaje}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error al enviar el correo:", error);
        res.status(500).json({ message: "Error al enviar el correo: " + error.message });
      } else {
        console.log("Correo enviado:", info.response);
        res.status(200).json({ message: "Correo enviado con éxito." });
      }
    });
  } catch (error) {
    console.error("Error al configurar el correo:", error);
    res.status(500).json({ message: "Error al configurar el correo: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
