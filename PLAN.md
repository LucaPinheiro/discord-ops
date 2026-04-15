# Plano de execução — discord-ops (SDK-first)

## Premissa central

O projeto deixa de ser "infra serverless com cliente acoplado" e vira **uma biblioteca `discord-ops` que funciona sozinha em qualquer backend**, com o proxy Lambda/Workers virando uma feature *opcional* documentada depois. Isso inverte a promessa: "instale um pacote e em 2 minutos você tem alertas", não "suba AWS primeiro".

---

## Fase 0 — Fundação do repo (1-2 dias)

Criar o monorepo público no GitHub com pnpm workspaces (ou npm workspaces).

Estrutura inicial enxuta:

```
discord-ops/
├── packages/node/
├── examples/express-minimal/
├── docs/
├── README.md
├── llms.txt
├── LICENSE (MIT)
├── CONTRIBUTING.md
└── .github/workflows/ci.yml
```

Configurar: TypeScript strict, tsup pra build (ESM + CJS), vitest pra teste, changesets pra versionamento, GitHub Actions rodando CI em push. Python entra na Fase 4 pra não atrasar.

**Entregável**: repo público com CI verde e um `hello world` do pacote.

---

## Fase 1 — SDK Node v0.1 (3-4 dias)

O coração do projeto. API pública minimalista:

```ts
import { createNotifier, DiscordTopic } from 'discord-ops';

const notify = createNotifier({
  mode: 'webhook',              // ou 'bot'
  webhooks: {
    login: process.env.DISCORD_WEBHOOK_LOGIN,
    errors: process.env.DISCORD_WEBHOOK_ERRORS,
  },
});

// fire-and-forget, nunca throw
notify({ topic: 'login', message: `User ${user.email} logged in` });
```

Funcionalidades obrigatórias no v0.1:

- **Dois modos**: `webhook` (recomendado, zero permissão) e `bot` (token + channelMap).
- **Fire-and-forget por default**: nunca lança erro pra fora, sempre loga internamente. Tem uma variante `notifyAsync` que retorna Promise pra quem quiser await.
- **Timeout** configurável (default 3s).
- **Retry com backoff exponencial** só em 429 e 5xx (default: 3 tentativas).
- **Drop silencioso** em `NODE_ENV !== 'production'` (configurável via `enabledIn`), espelhando o comportamento atual do clickcar — mas via flag explícita, não hardcoded.
- **Validação com Zod**: topic precisa existir no map, message não pode ser vazia/undefined.
- **Logger pluggable**: default é `console`, dá pra injetar pino/winston.

Detalhes técnicos: dependência zero idealmente (usar `fetch` nativo do Node 18+), só `zod` como peer. Build ESM + CJS + types. Tamanho alvo < 10kb minificado.

Testes: cobertura mínima em unit (mock de fetch) e um smoke test de integração contra um webhook real (via secret no CI).

**Entregável**: `npm i discord-ops` funcionando, publicado no npm como `0.1.0`.

---

## Fase 2 — Documentação + exemplos (2-3 dias)

Aqui mora o diferencial do projeto. README com:

Hero curto, GIF demo (usuário faz signup → mensagem no Discord em tempo real), **"2-minute setup"** como primeira seção (criar webhook → npm install → 5 linhas de código), depois seções expandidas.

Criar `docs/discord-setup.md` com walkthrough fotográfico de duas trilhas:
- **Trilha Webhook** (5 passos, sem bot): Server Settings → Integrations → Webhooks → New Webhook → Copy URL.
- **Trilha Bot** (10 passos): Developer Portal → New Application → Bot → intents → OAuth2 URL Generator → scopes/permissions → convidar no servidor → pegar channel IDs.

Criar `docs/getting-ids.md`: como habilitar Developer Mode e copiar guild/channel/user IDs.

Criar `docs/env-vars.md`: tabela com todas as envs suportadas, defaults, e exemplos `.env`.

Exemplos funcionais em `examples/`:
- `express-minimal/` — um endpoint POST /signup que chama `notify()`.
- `nextjs-api-route/` — route handler com notify em erro do middleware.
- `usecase-pattern/` — replica o padrão do clickcar (fire-and-forget em create_user_usecase), para gente que vem desse mundo clean arch.

**Entregável**: alguém que nunca ouviu falar do projeto consegue ir do zero a "mensagem caiu no Discord" em 5 minutos lendo só o README.

---

## Fase 3 — llms.txt + polish (1-2 dias)

Seguir o padrão llmstxt.org. Um `llms.txt` na raiz listando cada página de doc em markdown, e um `llms-full.txt` com tudo inline. Seções:

- O que é o projeto em 1 parágrafo
- Setup canônico (webhook mode)
- Integration pattern canônico (fire-and-forget em usecase)
- API reference do `createNotifier` e `notify`
- Anti-patterns (não usar await em hot path, não passar objetos não-serializáveis, não logar tokens)
- Migration guide (de `console.log` pra `notify`)

Isso faz Cursor/Claude/Copilot darem respostas corretas sobre o SDK quando alguém perguntar "como adiciono alerta de Discord no meu projeto".

Polish no repo: badges (npm version, bundle size, CI, license), issue templates, PR template, `.github/FUNDING.yml` se quiser sponsor.

**Entregável**: projeto "pronto pra trending" no GitHub.

---

## Fase 4 — SDK Python v0.1 (3-4 dias)

Paridade com o Node. Mesma API adaptada ao idioma:

```python
from discord_ops import create_notifier

notify = create_notifier(
    mode="webhook",
    webhooks={"login": os.getenv("DISCORD_WEBHOOK_LOGIN")},
)

notify(topic="login", message=f"User {user.email} logged in")
```

Stack: `httpx` pra client, `pydantic` pra validação, `pytest` pra teste, `hatch` ou `uv` pro build. Publicar no PyPI como `discord-ops`.

Fire-and-forget em Python é chatinho (precisa de thread ou `asyncio.create_task` dependendo do contexto). Oferecer ambos: `notify()` sync usa thread pool, `await notify_async()` pra quem já está em asyncio.

Exemplo em `examples/fastapi/` mostrando uso em dependency.

**Entregável**: `pip install discord-ops` funcionando.

---

## Fase 5 — Deploy opcional do proxy (2-3 dias) — só se fizer sentido

Depois que o SDK estiver maduro, aí sim empacotar o proxy Lambda atual como uma *opção avançada*, com foco em Cloudflare Workers como default (muito mais fácil que AWS). O usuário pega o Workers template, preenche env vars, `wrangler deploy`, e aponta o SDK pro URL gerado via `mode: 'proxy'`.

O que o proxy adiciona: config centralizada (um CHANNEL_MAP pra N serviços), rotação de token sem redeploy dos clients, rate limiting compartilhado.

Manter o CDK/Lambda atual em `deploy/aws-lambda/` pra quem já usa AWS.

**Entregável**: três opções de deploy documentadas, cada uma com um README próprio.

---

## Fase 6 — Features v0.2+ (backlog)

Coisas que eu NÃO faria no v0.1, mas planejaria:

- **Batching/debouncing**: acumular mensagens de mesmo topic em janela de 500ms e mandar uma só. Essencial pra não fazer flood.
- **Embeds** (mensagens ricas do Discord com cor, campos, timestamp) — útil pra distinguir info/warning/error visualmente.
- **Rate limit awareness** global (respeitar `X-RateLimit-*` headers do Discord).
- **Sampling** — `notify({ topic, message, sampleRate: 0.1 })` pra não mandar tudo.
- **Filtros por ambiente** mais granulares do que só dev/prod.
- **Integração com error middleware** (um `errorNotifier()` wrapper pronto pra Express/Fastify/Next).

---

## Cronograma agregado

Fase 0 + 1 + 2 + 3 = **~1.5 semanas de foco**, projeto já publicável e usável só com Node.
Fase 4 = **+meia semana**, cobertura Python.
Fase 5 = **+meia semana** quando fizer sentido (não precisa ser imediato).

Total pra algo "pronto pra mostrar": **2 semanas** de trabalho focado.

---

## Decisões que preciso de você antes de começar

1. **Licença** — MIT é o padrão pra adoção. Apache-2.0 tem proteção de patente. Preferência?

2. **Escopo npm** — publicar como `discord-ops` (sem escopo) ou `@seunome/discord-ops`? Sem escopo pega melhor, mas nome tem que estar livre.

3. **GitHub org ou user** — vai ficar no `github.com/LucaPinheiro` ou vai criar uma org (tipo `github.com/discord-ops`)? Org ajuda se quiser transmitir "projeto", não "projeto pessoal".

4. **Fases 4 e 5 — ordem**: quer Python logo depois do Node (fase 4 antes de deploy), ou prefere lançar o proxy Cloudflare primeiro porque é o que você já domina?
