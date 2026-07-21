# Gerador de Vídeos Publicitários com Avatar IA (HeyGen)

Aplicação Next.js que gera vídeos publicitários com avatares de IA a partir da imagem real de
um produto, uma copy e configurações de avatar/voz, usando a **API v3 da HeyGen**
(`api.heygen.com/v3/*`) — a versão atual recomendada pela própria HeyGen; os endpoints v2 usados
em uma versão anterior deste projeto serão desativados em 31/10/2026 e a API já retorna avisos
pedindo que integrações novas (inclusive feitas por agentes de IA) usem v3.

## Instalação

```bash
npm install
```

## Configuração da chave da HeyGen

1. Copie o arquivo de exemplo:
   ```bash
   cp .env.example .env.local
   ```
2. Obtenha sua chave em [app.heygen.com/settings?nav=API](https://app.heygen.com/settings?nav=API)
   e preencha `.env.local`:
   ```env
   HEYGEN_API_KEY=sua_chave_aqui
   ```

A chave só é usada no servidor (rotas em `app/api/*` e `lib/heygen/*`); ela nunca é exposta ao
frontend.

## Como iniciar o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

Para build de produção:

```bash
npm run build
npm start
```

## Como usar

### 1. Enviar a imagem do produto

No campo **"Imagem real do produto"**, envie um arquivo PNG, JPG/JPEG ou WebP (até 10MB) com a
foto real do produto. Uma prévia aparece imediatamente. A imagem é enviada para
`POST /v3/assets` (upload direto na HeyGen) e o `asset_id` retornado é usado como referência
visual real — nunca é recriada ou generalizada.

### 2. Configurar avatar e voz

- **Avatar existente**: selecione um avatar já disponível na sua conta HeyGen (lista carregada
  via `GET /v3/avatars`, paginada).
- **Criar avatar a partir de imagem**: envie uma foto de rosto nítida; ela é enviada como asset
  (`POST /v3/assets`) e referenciada como `character.type: "image"` na geração do vídeo.
- Selecione a **voz** (lista carregada via `GET /v3/voices`, paginada, filtrada pelo idioma
  escolhido no formulário).

### 3. Preencher copy, duração e demais configurações

Digite a copy completa (ela nunca é resumida ou reescrita), a duração desejada em minutos, o
idioma, o formato (9:16, 16:9 ou 1:1) e se deseja legendas. Antes de gerar, a aplicação mostra uma
**estimativa** de duração da fala com base na contagem de palavras — apenas informativa (veja
limitações abaixo sobre por que ela não pode ser ajustada automaticamente).

### 4. Gerar o vídeo

Clique em **"Gerar vídeo"**. A aplicação chama `POST /v3/videos` e faz *polling* do status
(`GET /v3/videos/{id}`) a cada poucos segundos, exibindo o progresso na tela até o vídeo ficar
`completed` (mostrando player e link de download) ou `failed` (mostrando o erro).

## Arquitetura

```
lib/heygen/        Serviço isolado de integração com a API v3 da HeyGen
  client.ts         fetch com autenticação (X-Api-Key), timeout e tratamento de erros/rate limit
  assets.ts         upload de imagens (POST /v3/assets)
  catalog.ts        listagem paginada de avatares e vozes (GET /v3/avatars/looks, /v3/voices),
                    com cache em memória de 5 min
  video.ts          criação de vídeo (POST /v3/videos) e consulta de status (GET /v3/videos/{id})
lib/script.ts       estimativa de duração da fala a partir da contagem de palavras da copy
lib/validation.ts   validação (zod) dos campos do formulário e dos arquivos de imagem
lib/server/         armazenamento temporário de arquivos (disco, em pasta temp do SO) e
                    idempotência em memória (evita vídeos duplicados em reenvios)
app/api/            rotas: avatars, voices, generate, status/[videoId]
app/page.tsx        formulário único e acompanhamento do processamento
```

Não há banco de dados nem autenticação. Os arquivos enviados são gravados em uma pasta temporária
do sistema operacional apenas durante o processamento da requisição e são apagados logo em
seguida (em bloco `finally`), com ou sem sucesso.

## Limitações reais da API da HeyGen (confirmadas testando contra a API)

Estas limitações foram verificadas na prática (chamadas reais à API v3, incluindo leitura das
mensagens de erro de validação do próprio endpoint) e moldam decisões de design desta aplicação:

- **Uma cena por vídeo**: `POST /v3/videos` gera **um único segmento** por chamada — não existe
  um array de múltiplas cenas (`video_inputs`/`scenes` são rejeitados como campos inválidos).
  Por isso a copy inteira é enviada como um único `script`, sem divisão automática em cenas; se a
  copy for muito longa, o vídeo final será proporcionalmente mais longo.
- **Sem controle de velocidade de voz**: os campos `voice_speed`, `speed` e um objeto `voice`
  aninhado com velocidade são todos rejeitados pela API (`"Extra inputs are not permitted"`). A
  duração final do vídeo depende exclusivamente do ritmo natural da voz escolhida — a aplicação
  mostra uma estimativa antes de gerar, mas não consegue ajustá-la programaticamente.
- **Composição do produto na cena**: só é possível definir um **plano de fundo** (`background`)
  por vídeo — cor sólida (`{type: "color", value: "#hex"}`) ou imagem (`{type: "image", asset_id}`
  ou `url`). Não é possível compor o produto fisicamente na mão do avatar, ao lado dele, ou
  alterná-lo em momentos específicos, já que só existe uma cena. Por isso a opção "Produto como
  plano de fundo do vídeo" usa a imagem real do produto como o próprio fundo do vídeo inteiro; a
  opção "Cenário/cor como fundo" usa o cenário enviado (ou uma cor) e o produto é mencionado
  apenas na fala do avatar. Para compor o produto diretamente com o avatar, seria necessário criar
  um avatar/template personalizado no HeyGen Studio — fora do escopo desta API de vídeo simples.
- **O `background` só substitui a cena inteira em avatares `studio_avatar`**: testado na prática
  gerando vídeos reais — em avatares `photo_avatar` (a maioria do catálogo público) e
  `digital_twin`, a foto original do avatar já vem com uma cena embutida e não removível; o
  `background` enviado só aparece nas bordas de letterbox/pillarbox quando a proporção do vídeo
  não bate com a da foto original, sem cobrir a cena atrás do avatar. Somente em avatares do tipo
  `studio_avatar` (formato clássico "green screen") o `background` realmente substitui a cena
  inteira. Por isso o catálogo de avatares desta aplicação é filtrado para
  `avatar_type=studio_avatar` — é o único conjunto em que a opção "Produto como plano de fundo do
  vídeo" funciona como esperado. Esses avatares exigem também o campo `engine: {type:
  "avatar_iii"}` na geração (sem ele a API assume `avatar_iv` por padrão e rejeita a requisição,
  pois `studio_avatar` só suporta o engine `avatar_iii`).
- **Tom de voz, expressões faciais e gestos**: são campos coletados no formulário e exibidos como
  contexto para o usuário, mas a API não expõe parâmetros para controlá-los — apenas avatar, voz
  e cenário são efetivamente configuráveis.
- **`GET /v3/avatars` não retorna IDs utilizáveis em vídeo**: esse endpoint lista *grupos* de
  avatar (ex.: "Marco", com um `looks_count`), mas o `id` do grupo é rejeitado por
  `POST /v3/videos` com `avatar_not_found`. O ID realmente utilizável é o de um "look" individual
  do grupo, listado em `GET /v3/avatars/looks` (sem filtro por grupo disponível). Por isso o
  catálogo de avatares desta aplicação usa `/v3/avatars/looks` diretamente — cada item já é
  utilizável como `avatar_id`. Como não há filtro nem forma de listar só os "melhores" looks, o
  catálogo é limitado às primeiras ~500 opções (10 páginas de 50) para manter o carregamento
  rápido, em vez do catálogo completo (que tem dezenas de milhares de looks).
- **Paginação**: `GET /v3/avatars/looks` só aceita `limit` até 50 por página (`/v3/voices` aceita
  100); a aplicação pagina automaticamente usando o parâmetro `token` (retornado como
  `next_token` na resposta — nomes diferentes, confirmado testando contra a API). O resultado é
  cacheado em memória por 5 min.
- **Erros de crédito**: um `402` com `code: "insufficient_credit"` é traduzido para uma mensagem
  clara pedindo para adicionar créditos na conta HeyGen.
- **Rate limit**: respostas HTTP 429 da HeyGen são tratadas e reportadas como "tente novamente em
  instantes".
- **Tamanho de imagem**: limite de 10MB por arquivo neste app (PNG, JPG/JPEG ou WebP); a API da
  HeyGen aceita até 32MB por upload direto.
- **Idempotência**: implementada em memória do processo (sem banco de dados) via uma chave gerada
  no navegador a cada nova tentativa de geração. Isso evita duplicar vídeos em reenvios da mesma
  requisição, mas é reiniciada se o servidor for reiniciado e não é compartilhada entre múltiplas
  instâncias do servidor.

## Armazenamento externo (opcional)

Esta aplicação **não precisa** de armazenamento externo: as imagens enviadas são repassadas
diretamente em binário para `POST /v3/assets` na HeyGen, que retorna um `asset_id`/URL próprios da
HeyGen. Não é necessário expor os arquivos temporários locais para a internet.
