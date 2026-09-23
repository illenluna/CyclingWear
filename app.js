// Cycling Wear — aplicação Express
// Node.js + Express + Multer + Google Sign-In
// Armazenamento: MongoDB Atlas (dados + sessões) + Cloudinary (fotos)
// Este módulo exporta o app Express puro (sem app.listen), para poder
// rodar tanto localmente (server.js) quanto como função serverless na Vercel (api/index.js).

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { OAuth2Client } = require('google-auth-library');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const path = require('path');

const app = express();

// === Configuração de autenticação e variáveis obrigatórias ===
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ALLOWED_EMAIL    = (process.env.ALLOWED_EMAIL || '').toLowerCase();
const SESSION_SECRET   = process.env.SESSION_SECRET || 'troque-este-segredo-em-producao';
const MONGODB_URI      = process.env.MONGODB_URI;
const IS_PROD          = process.env.NODE_ENV === 'production';

const missing = [];
if (!GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
if (!ALLOWED_EMAIL) missing.push('ALLOWED_EMAIL');
if (!MONGODB_URI) missing.push('MONGODB_URI');
if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
if (missing.length) {
  throw new Error(`Faltam variáveis de ambiente: ${missing.join(', ')}`);
}

// === Cloudinary ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// === MongoDB — conexão cacheada entre invocações (necessário em ambiente serverless) ===
let mongoConnPromise = null;
function connectMongo() {
  if (!mongoConnPromise) {
    mongoose.set('strictQuery', true);
    mongoConnPromise = mongoose.connect(MONGODB_URI).catch((err) => {
      mongoConnPromise = null; // permite retry na próxima requisição
      throw err;
    });
  }
  return mongoConnPromise;
}

app.use(async (_req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    console.error('Erro ao conectar MongoDB:', err.message);
    res.status(503).json({ error: 'Serviço indisponível (banco de dados)' });
  }
});

const itemSchema = new mongoose.Schema({
  tipo:         { type: String, required: true },
  marca:        { type: String, default: '' },
  cor:          { type: String, default: '' },
  tamanho:      { type: String, default: '' },
  notas:        { type: String, default: '' },
  foto:         { type: String, default: '' },  // URL completa do Cloudinary
  fotoPublicId: { type: String, default: '' },  // public_id para deleção
  criadoEm:    { type: Date,   default: Date.now }
});

// Transforma _id em id para o frontend (compatibilidade total com o script.js existente)
itemSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.fotoPublicId; // não expor ao frontend
    return ret;
  }
});

const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// === Multer — armazena em memória, envia direto ao Cloudinary ===
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|webp|gif|heic|heif)/i.test(file.mimetype);
    cb(ok ? null : new Error('Apenas imagens são permitidas'), ok);
  }
});

// Helper: faz upload de um Buffer para o Cloudinary e retorna o resultado
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

// === Middlewares ===
if (IS_PROD) app.set('trust proxy', 1);

app.use(express.json());
app.use(session({
  name: 'cw.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions',
    ttl: 30 * 24 * 60 * 60 // 30 dias
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
  }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.email === ALLOWED_EMAIL) return next();
  return res.status(401).json({ error: 'Não autorizado' });
}

// Arquivos estáticos do frontend são públicos (usado apenas em dev local —
// na Vercel, o vercel.json serve a pasta public/ diretamente)
app.use(express.static(path.join(__dirname, 'public')));

// === Rotas de autenticação ===

app.get('/auth/config', (_req, res) => {
  res.json({ clientId: GOOGLE_CLIENT_ID });
});

app.get('/auth/me', (req, res) => {
  if (req.session && req.session.email === ALLOWED_EMAIL) {
    return res.json({ authenticated: true, email: req.session.email, name: req.session.name });
  }
  res.json({ authenticated: false });
});

app.post('/auth/google', async (req, res) => {
  const credential = req.body && req.body.credential;
  if (!credential) return res.status(400).json({ error: 'Token ausente' });

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = (payload.email || '').toLowerCase();

    if (!payload.email_verified || email !== ALLOWED_EMAIL) {
      return res.status(403).json({ error: 'Acesso restrito ao proprietário deste armário.' });
    }

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Erro de sessão' });
      req.session.email = email;
      req.session.name = payload.name || '';
      res.json({ authenticated: true, email, name: req.session.name });
    });
    return;
  } catch (err) {
    console.error('Erro ao verificar token Google:', err.message);
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('cw.sid');
    res.json({ ok: true });
  });
});

// === Rotas da API (todas protegidas) ===
app.use('/api', requireAuth);

// Listar todos os itens (mais recentes primeiro)
app.get('/api/items', async (_req, res) => {
  try {
    const items = await Item.find().sort({ criadoEm: -1 });
    res.json(items);
  } catch (err) {
    console.error('Erro ao listar:', err.message);
    res.status(500).json({ error: 'Erro ao listar itens' });
  }
});

// Adicionar novo item (foto obrigatória → Cloudinary)
app.post('/api/items', upload.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Foto é obrigatória' });
  const { tipo, marca, cor, tamanho, notas } = req.body;
  if (!tipo) return res.status(400).json({ error: 'Tipo é obrigatório' });

  try {
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'cycling-wear',
      resource_type: 'image'
    });

    const item = await Item.create({
      tipo,
      marca:        (marca   || '').trim(),
      cor:          (cor     || '').trim(),
      tamanho:      (tamanho || '').trim(),
      notas:        (notas   || '').trim(),
      foto:         result.secure_url,
      fotoPublicId: result.public_id
    });

    res.status(201).json(item);
  } catch (err) {
    console.error('Erro ao criar item:', err.message);
    res.status(500).json({ error: 'Erro ao salvar item' });
  }
});

// Editar item (foto opcional — se enviada, substitui a anterior no Cloudinary)
app.put('/api/items/:id', upload.single('foto'), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    const { tipo, marca, cor, tamanho, notas } = req.body;
    if (tipo    !== undefined) item.tipo    = tipo;
    if (marca   !== undefined) item.marca   = marca.trim();
    if (cor     !== undefined) item.cor     = cor.trim();
    if (tamanho !== undefined) item.tamanho = tamanho.trim();
    if (notas   !== undefined) item.notas   = notas.trim();

    if (req.file) {
      // Remove a foto antiga do Cloudinary (sem bloquear em caso de falha)
      if (item.fotoPublicId) {
        await cloudinary.uploader.destroy(item.fotoPublicId).catch(() => {});
      }
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'cycling-wear',
        resource_type: 'image'
      });
      item.foto         = result.secure_url;
      item.fotoPublicId = result.public_id;
    }

    await item.save();
    res.json(item);
  } catch (err) {
    console.error('Erro ao editar item:', err.message);
    res.status(500).json({ error: 'Erro ao editar item' });
  }
});

// Excluir item (e remover a foto do Cloudinary)
app.delete('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    if (item.fotoPublicId) {
      await cloudinary.uploader.destroy(item.fotoPublicId).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir:', err.message);
    res.status(500).json({ error: 'Erro ao excluir item' });
  }
});

// Tratamento de erros do multer
app.use((err, _req, res, _next) => {
  if (err) return res.status(400).json({ error: err.message });
});

module.exports = app;
