# Google Cloud — Setup para Billing via API

Guia de referência para configurar um projeto Google Cloud do zero até chamadas à API funcionando e debitando nos créditos do projeto.

---

## Mapa Mental

```
GOOGLE CLOUD — SETUP PARA BILLING VIA API
│
├── 1. PROJETO
│   ├── Criar ou identificar o projeto com créditos
│   │   └── Console → seletor de projetos → copiar o Project ID
│   └── ⚠️  O AI Studio cria projetos separados (gen-lang-client-*)
│       └── Esses projetos têm limite de spending cap próprio
│
├── 2. POLÍTICAS DE ORGANIZAÇÃO (bloqueios comuns)
│   ├── IAM & Admin → Políticas da organização
│   ├── "iam.disableServiceAccountKeyCreation" → desativar se precisar de JSON keys
│   └── "constraints/iam.allowedPolicyMemberDomains" → bloqueia API keys externas
│       └── Fix: substituir política do pai → Permitida (nível projeto)
│
├── 3. API HABILITADA
│   ├── APIs & Services → Biblioteca
│   └── Habilitar: "Gemini API" (para generativelanguage.googleapis.com)
│       └── (Vertex AI API se for usar aiplatform.googleapis.com)
│
├── 4. AUTENTICAÇÃO — escolher UMA das opções
│   │
│   ├── A) API KEY (mais simples — bloqueada em orgs com política)
│   │   └── APIs & Services → Credenciais → Criar chave de API
│   │       └── Usar: header x-goog-api-key no código
│   │
│   ├── B) SERVICE ACCOUNT JSON (recomendado para servidores)
│   │   ├── IAM & Admin → Service Accounts → Create
│   │   ├── Atribuir role: Editor ou Vertex AI User
│   │   ├── Keys → Add Key → JSON → Download
│   │   └── Usar: google-auth-library no código → Bearer token
│   │       └── ⚠️  Bloqueado se iam.disableServiceAccountKeyCreation ativo
│   │
│   └── C) ADC via gcloud (recomendado para dev local)
│       ├── Instalar Google Cloud SDK
│       ├── gcloud auth application-default login
│       └── google-auth-library detecta automaticamente
│
├── 5. IAM — PERMISSÃO DO SERVICE ACCOUNT
│   ├── IAM & Admin → IAM → Permitir acesso
│   ├── Principal: email do service account
│   └── Role: Editor / Vertex AI User / Service Usage Consumer
│
└── 6. CÓDIGO
    ├── pnpm add google-auth-library
    ├── GoogleAuth({ keyFile: SA_JSON, scopes: [
    │     'cloud-platform',
    │     'generative-language'   ← obrigatório para Gemini API
    │   ]})
    └── Trocar x-goog-api-key → Authorization: Bearer <token>
```

---

## Erros Comuns e Causas

| Erro | Causa | Fix |
|------|-------|-----|
| `429 spending cap exceeded` | Projeto do AI Studio com limite estourado | Usar projeto separado com créditos |
| `429 prepayment credits depleted` | Créditos pré-pagos do AI Studio zerados | Idem |
| `403 API keys not allowed` | Política de org bloqueia API keys | Usar Service Account ou ADC |
| `403 insufficient authentication scopes` | Scope do token não cobre a API | Adicionar `generative-language` nos scopes |
| `403 PERMISSION_DENIED` | Service account sem role no IAM | Adicionar role Editor/Vertex AI User no IAM |
| `key creation disabled` | `iam.disableServiceAccountKeyCreation` ativo | Desativar política no nível do projeto |

---

## Implementação no Código (TypeScript)

### Instalar dependência
```bash
pnpm add google-auth-library
```

### Helper de auth (`scripts/video/google-auth.ts`)
```typescript
import { GoogleAuth } from 'google-auth-library'
import * as path from 'node:path'

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/generative-language',
]

let _client: any = null

async function getClient() {
  if (_client) return _client
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const auth = new GoogleAuth({
    keyFile: path.isAbsolute(keyFile) ? keyFile : path.resolve(process.cwd(), keyFile),
    scopes: SCOPES,
  })
  _client = await auth.getClient()
  return _client
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const client = await getClient()
  const { token } = await client.getAccessToken()
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
}
```

### Variáveis de ambiente (`.env`)
```env
GOOGLE_CLOUD_PROJECT=<project-id>
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=.secrets/adcraft/my-first-project-sa.json
```

---

## Regra de Ouro

> Se uma chamada retorna `403 PERMISSION_DENIED` ou `429`, o problema é sempre uma dessas 4 coisas:
> **projeto errado · API não habilitada · scope incorreto · service account sem role no IAM**
