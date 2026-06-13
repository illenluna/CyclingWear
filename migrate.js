// migrate.js — Script de migração única
// Lê data.json, faz upload de cada foto local para o Cloudinary
// e insere os itens no MongoDB Atlas.
//
// Como usar:
//   1. Preencha o .env com MONGODB_URI, CLOUDINARY_* (e demais variáveis)
//   2. node migrate.js
//   3. Verifique os itens no Atlas e no Cloudinary antes de deletar data.json / uploads/

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const itemSchema = new mongoose.Schema({
  tipo:         String,
  marca:        String,
  cor:          String,
  tamanho:      String,
  notas:        String,
  foto:         String,
  fotoPublicId: String,
  criadoEm:    Date
});

const Item = mongoose.model('Item', itemSchema);

function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

async function migrate() {
  const dataFile = path.join(__dirname, 'data.json');
  const uploadsDir = path.join(__dirname, 'uploads');

  if (!fs.existsSync(dataFile)) {
    console.log('data.json não encontrado — nada para migrar.');
    return;
  }

  const items = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  if (!items.length) {
    console.log('data.json está vazio — nada para migrar.');
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB conectado. Migrando ${items.length} item(ns)...\n`);

  for (const item of items) {
    const fotoPath = path.join(uploadsDir, item.foto);

    let fotoUrl = '';
    let fotoPublicId = '';

    if (fs.existsSync(fotoPath)) {
      console.log(`  Enviando foto: ${item.foto}`);
      const buffer = fs.readFileSync(fotoPath);
      const result = await uploadToCloudinary(buffer, {
        folder: 'cycling-wear',
        resource_type: 'image'
      });
      fotoUrl = result.secure_url;
      fotoPublicId = result.public_id;
      console.log(`  ✓ Cloudinary: ${fotoUrl}`);
    } else {
      console.warn(`  ⚠ Foto não encontrada localmente: ${fotoPath}`);
      console.warn(`    O item será inserido sem foto.`);
    }

    await Item.create({
      tipo:         item.tipo,
      marca:        item.marca || '',
      cor:          item.cor || '',
      tamanho:      item.tamanho || '',
      notas:        item.notas || '',
      foto:         fotoUrl,
      fotoPublicId: fotoPublicId,
      criadoEm:    new Date(item.criadoEm || Date.now())
    });

    console.log(`  ✓ MongoDB: "${item.tipo}" (${item.marca || '—'}) inserido.\n`);
  }

  console.log('Migração concluída!');
  console.log('Você pode apagar data.json e a pasta uploads/ com segurança após verificar os dados.');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
