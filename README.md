# AgroSmart CV — Guia para Executar no Seu Computador

Este projeto está 100% independente e livre de marcas de água externas quando executado localmente no seu computador.

## Pré-requisitos
1. Instale o **Node.js** (versão 20 ou superior): https://nodejs.org/

## Passo a Passo para Rodar no Computador
1. Descompacte a pasta do projeto (ZIP) no seu computador.
2. Abra o terminal (**Prompt de Comando / PowerShell** no Windows ou **Terminal** no Mac/Linux) dentro da pasta do projeto.
3. Instale as dependências:
   ```bash
   npm install
   ```
4. *(Opcional — para usar o Agrónomo IA localmente)* Crie um ficheiro chamado `.env` na raiz do projeto (copiando o `.env.example`) e adicione a sua chave Gemini:
   ```env
   GEMINI_API_KEY="SUA_CHAVE_AQUI"
   ```
5. Inicie o site:
   ```bash
   npm run dev
   ```
6. Abra o navegador em:
   ```
   http://localhost:3000
   ```

## Build para Produção (Publicar em Servidor Próprio)
Se quiser gerar os ficheiros finais e rodar em modo produção:
```bash
npm run build
```
E depois iniciar o servidor em modo produção:
- **Mac / Linux**: `NODE_ENV=production npx tsx server.ts`
- **Windows (PowerShell)**: `$env:NODE_ENV="production"; npx tsx server.ts`
