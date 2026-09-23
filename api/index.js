// Função serverless da Vercel — reexporta o app Express.
// Todas as rotas (/auth/*, /api/*) chegam aqui via rewrites do vercel.json.
module.exports = require('../app');
