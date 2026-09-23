// Entrada local (npm start). Na Vercel, quem serve o app é api/index.js.
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Cycling Wear rodando em http://localhost:${PORT}`);
});
