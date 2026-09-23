# Cycling Wear

Inventário visual pessoal de roupas fitness e ciclismo, protegido por login com Google (somente um e-mail autorizado). Instalável como app (PWA), com leitura offline.

## 1. Configurar credenciais do Google (uma vez)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e faça login.
2. Crie um projeto novo (ou use um existente). O nome não importa — algo como "Cycling Wear".
3. No menu lateral, vá em **APIs e Serviços → Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**
   - Preencha nome do app ("Cycling Wear"), seu e-mail de suporte e e-mail de contato do desenvolvedor.
   - Em **Usuários de teste**, adicione o seu próprio e-mail Google. Salve.
4. No menu lateral, vá em **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - Em **Origens JavaScript autorizadas**, adicione:
     - `http://localhost:3000` (para rodar localmente)
     - a URL de produção da Vercel (adicione depois do deploy — veja o passo 4)
   - **Não precisa preencher** "URIs de redirecionamento autorizados" — esta integração usa Google Identity Services, que não faz redirecionamento.
   - Clique em criar. Copie o **Client ID** que aparece (algo como `123456789-abc.apps.googleusercontent.com`).

## 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```
cp .env.example .env
```

No `.env`, defina:

- `GOOGLE_CLIENT_ID` — o Client ID copiado no passo anterior
- `ALLOWED_EMAIL` — seu e-mail Google (o único que poderá entrar)
- `SESSION_SECRET` — uma string longa e aleatória. Gere com:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `MONGODB_URI` — string de conexão do MongoDB Atlas (dados + sessões)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — armazenamento das fotos

## 3. Rodando localmente

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou superior).
2. Na pasta do projeto, instale as dependências:
   ```
   npm install
   ```
3. Inicie o servidor:
   ```
   npm start
   ```
4. Abra http://localhost:3000 no navegador. Faça login com a conta Google configurada em `ALLOWED_EMAIL`.

## 4. Deploy na Vercel

O projeto já está configurado para rodar como função serverless na Vercel (`api/index.js` + `vercel.json`), com o frontend estático servido de `public/`.

1. Faça push deste projeto para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com), importe o repositório (ou rode `npx vercel link` localmente para conectar).
3. Configure as variáveis de ambiente do projeto (Settings → Environment Variables), para os ambientes **Production**, **Preview** e **Development**:
   - `GOOGLE_CLIENT_ID`
   - `ALLOWED_EMAIL`
   - `SESSION_SECRET`
   - `MONGODB_URI`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

   Também dá para fazer isso via CLI: `npx vercel env add NOME_DA_VAR production` (repita para `preview` e `development`).
4. Rode `npx vercel --prod` (ou faça push para a branch conectada) para publicar.
5. Copie a URL de produção (ex: `https://cycling-wear.vercel.app`) e adicione em Google Cloud Console → Credenciais → seu Client ID → **Origens JavaScript autorizadas**.

> `NODE_ENV=production` já é definido automaticamente pela Vercel em Production/Preview — não precisa configurar.

Para rodar localmente simulando o ambiente da Vercel (funções serverless + rewrites): `npx vercel dev`.

### Sessões

Como funções serverless não mantêm estado em memória entre invocações, as sessões de login são persistidas no MongoDB (via `connect-mongo`, coleção `sessions`) em vez do `MemoryStore` padrão do Express.

## Estrutura do projeto

```
cycling-wear/
├── package.json          dependências e scripts
├── app.js                app Express (rotas, auth, Mongo, Cloudinary)
├── server.js             entrada local (npm start) — importa app.js
├── api/
│   └── index.js          função serverless da Vercel — reexporta app.js
├── vercel.json            rewrites (API + estático)
├── .env.example          modelo de variáveis de ambiente
├── .env                  variáveis reais (não commitar)
└── public/
    ├── index.html        página única (login + app)
    ├── style.css         visual
    ├── manifest.json     manifesto do PWA
    ├── sw.js             service worker (cache offline)
    ├── icons/            ícones do PWA
    └── js/               frontend em ES modules (sem build)
        ├── main.js       ponto de entrada: sessão, abas, logout
        ├── auth.js       tela de login (Google Identity Services)
        ├── api.js        chamadas ao backend
        ├── closet.js     aba Closet: vitrine, filtros, formulário, detalhes
        ├── kit.js        aba Kit Matching
        ├── pwa.js        registro do service worker e modo offline
        ├── state.js      estado compartilhado
        ├── config.js     tipos de peça e tamanhos de imagem
        └── utils.js      escape de HTML e URLs otimizadas do Cloudinary
```

Os tipos de peça ficam só em `public/js/config.js` — o formulário, o filtro e o Kit Matching leem de lá.

## Imagens

As fotos originais ficam no Cloudinary; o frontend pede versões redimensionadas por contexto (`w_…,c_limit,f_auto,q_auto`) via `imgUrl()` em `utils.js`. As larguras por contexto estão em `IMG_WIDTH` (`config.js`).

## PWA e modo offline

- No celular, use "Adicionar à tela inicial" para instalar o app.
- O service worker (`public/sw.js`) guarda o app, a lista de itens e as fotos já vistas. Sem conexão, o app abre em **modo somente leitura** (adicionar, editar e excluir ficam desativados).
- Ao sair da conta, os dados em cache da API são apagados.
- Ao alterar a lista de arquivos em `SHELL` (ex.: novo módulo em `js/`), incremente `VERSION` no `sw.js`.

## Como funciona o login

- O frontend carrega a biblioteca oficial do Google (`accounts.google.com/gsi/client`) e renderiza o botão "Entrar com Google".
- Após o login, o Google envia um **ID token** assinado para o frontend.
- O frontend manda esse token para `/auth/google` no backend.
- O backend verifica a assinatura do token usando a `google-auth-library` e confere se o e-mail do payload bate com `ALLOWED_EMAIL`. Se sim, cria uma sessão (cookie httpOnly, válido por 30 dias).
- Todas as rotas `/api/*` exigem essa sessão. Sem login, retornam `401`.
- Logout destrói a sessão e limpa o cookie.
