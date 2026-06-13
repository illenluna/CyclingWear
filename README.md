# Cycling Wear

Inventário visual pessoal de roupas fitness e ciclismo, protegido por login com Google (somente um e-mail autorizado).

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
     - `https://seu-app.onrender.com` (quando publicar no Render — adicione depois)
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

A primeira execução cria automaticamente o arquivo `data.json` e a pasta `uploads/`.

## 4. Deploy no Render (gratuito)

1. Faça push deste projeto para um repositório no GitHub. O `.env` **não** será enviado (está no `.gitignore`).
2. Crie uma conta em [render.com](https://render.com) e conecte ao GitHub.
3. Clique em **New → Web Service** e selecione o repositório.
4. Confirme as configurações detectadas:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Em **Environment**, adicione as três variáveis de ambiente (mesmos valores do `.env` local) mais:
   - `NODE_ENV` = `production`
6. Clique em **Create Web Service**.
7. Após o primeiro deploy, copie a URL do app (ex: `https://cycling-wear.onrender.com`) e volte ao Google Cloud Console → Credenciais → seu Client ID → adicione essa URL às **Origens JavaScript autorizadas**.

> **Nota sobre o plano gratuito do Render:** o sistema de arquivos é efêmero, então fotos e dados podem ser perdidos a cada redeploy. Para uso pessoal de teste está perfeito. Para uso permanente, considere migrar fotos para Cloudinary e dados para MongoDB Atlas (ambos com plano gratuito).

## Estrutura do projeto

```
cycling-wear/
├── package.json          dependências e scripts
├── server.js             backend Node.js + Express + Google Sign-In
├── .env.example          modelo de variáveis de ambiente
├── .env                  variáveis reais (não commitar)
├── data.json             banco de dados (gerado automaticamente)
├── uploads/              fotos dos itens (gerada automaticamente)
└── public/
    ├── index.html        página única (login + app)
    ├── style.css         visual
    └── script.js         lógica do frontend
```

## Como funciona o login

- O frontend carrega a biblioteca oficial do Google (`accounts.google.com/gsi/client`) e renderiza o botão "Entrar com Google".
- Após o login, o Google envia um **ID token** assinado para o frontend.
- O frontend manda esse token para `/auth/google` no backend.
- O backend verifica a assinatura do token usando a `google-auth-library` e confere se o e-mail do payload bate com `ALLOWED_EMAIL`. Se sim, cria uma sessão (cookie httpOnly, válido por 30 dias).
- Todas as rotas `/api/*` e `/uploads/*` exigem essa sessão. Sem login, retornam `401`.
- Logout destrói a sessão e limpa o cookie.
