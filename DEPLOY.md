# Deploy Guide — Roast My Landing

> Opções de hospedagem VPS + stack necessária + custo mensal estimado para rodar o projeto em produção.

---

## 1. Stack de Produção

| Serviço | Obrigatório | Alternativa |
|---------|-------------|-------------|
| **Node.js 20+** | Sim | — |
| **PostgreSQL 15+** | Sim | SQLite local (não recomendado) |
| **Redis 7+** | Sim | Memory store (perde cache ao reiniciar) |
| **Chrome/Chromium** | Sim* | *PageSpeed Insights API* (evita instalar Chrome) |
| **OpenAI API** | Sim* | Ollama local (precisa de GPU ou CPU potente) |

### Lighthouse: local vs PageSpeed
- **Local** → precisa instalar Chrome no servidor (usa mais RAM/CPU).
- **PageSpeed** → basta uma `PAGESPEED_API_KEY` (gratuita até cota do Google Cloud). Economiza ~1 GB de RAM.

### LLM: OpenAI vs Ollama
- **OpenAI** → recomendado para produção. Custo por requisição é baixo com `gpt-5.4-nano`.
- **Ollama** → roda local. Exige no mínimo **4 vCPUs + 8 GB RAM** só para o modelo (ex: `qwen3.5:35b-a3b`).

---

## 2. Requisitos Mínimos de Hardware

### Opção A — usando APIs externas (PageSpeed + OpenAI)
- **2 vCPUs**
- **2 GB RAM**
- **40 GB SSD**
- **Tráfego:** ~100 GB/mês (depende do uso)

### Opção B — tudo local (Lighthouse + Ollama)
- **4 vCPUs**
- **8 GB RAM** (mínimo confortável)
- **80 GB SSD** (modelos de LLM ocupam ~20-40 GB)
- **GPU opcional** (acelera Ollama, mas não é obrigatória)

---

## 3. Opções de VPS / Hospedagem

### 3.1 Hetzner Cloud (Recomendado — melhor custo/benefício)
| Plano | Specs | Preço/mês* |
|-------|-------|------------|
| CPX11 | 2 vCPUs / 4 GB / 40 GB | ~€ 5,35 (~R$ 33) |
| CPX21 | 2 vCPUs / 8 GB / 80 GB | ~€ 9,50 (~R$ 59) |
| CPX31 | 4 vCPUs / 16 GB / 160 GB | ~€ 17,50 (~R$ 108) |

*Preços em Frankfurt. Armazenamento backup extra cobrado à parte.

**Ideal para:** quem quer pagar pouco e tem habilidade para gerenciar Linux.

---

### 3.2 DigitalOcean
| Plano | Specs | Preço/mês |
|-------|-------|-----------|
| Basic Droplet | 1 vCPU / 1 GB / 25 GB | $ 7 (~R$ 36) |
| Basic Droplet | 2 vCPUs / 4 GB / 80 GB | $ 24 (~R$ 122) |
| Basic Droplet | 4 vCPUs / 8 GB / 160 GB | $ 48 (~R$ 244) |

**Ideal para:** quem quer interface amigável, marketplace de 1-click apps e bons tutoriais.

---

### 3.3 Vultr
| Plano | Specs | Preço/mês |
|-------|-------|-----------|
| Cloud Compute | 1 vCPU / 1 GB / 25 GB | $ 5 (~R$ 25) |
| Cloud Compute | 2 vCPUs / 4 GB / 80 GB | $ 20 (~R$ 102) |
| Cloud Compute | 4 vCPUs / 8 GB / 160 GB | $ 40 (~R$ 203) |

**Ideal para:** preço baixo similar à Hetzner, com datacenters nos EUA, Europa e Ásia.

---

### 3.4 AWS Lightsail
| Plano | Specs | Preço/mês |
|-------|-------|-----------|
| $5/mês | 2 vCPUs / 512 MB / 20 GB | $ 5 |
| $10/mês | 1 vCPU / 1 GB / 40 GB | $ 10 |
| $20/mês | 2 vCPUs / 4 GB / 80 GB | $ 20 |
| $40/mês | 2 vCPUs / 8 GB / 160 GB | $ 40 |

> **Atenção:** os planos de entrada da Lightsail têm **CPU burst limitada**. Lighthouse local + Next.js podem travar em planos < $20/mês.

**Ideal para:** quem já usa AWS e quer tudo em uma única conta.

---

### 3.5 Railway / Render / Fly.io (PaaS)
Essas plataformas rodam containers e gerenciam deploy automático a partir do Git.

| Plataforma | Estimativa mensal (2 vCPUs / 4 GB + DB + Redis) |
|------------|-------------------------------------------------|
| **Railway** | ~$ 15-30 (~R$ 76-152) |
| **Render** | ~$ 25-50 (~R$ 127-254) |
| **Fly.io** | ~$ 10-25 (~R$ 51-127) |

**Vantagens:**
- Deploy automático via `git push`
- SSL automático
- Banco de dados e Redis gerenciados com 1 comando

**Desvantagens:**
- Lighthouse local pode falhar em containers sem Chrome instalado (solução: usar PageSpeed API)
- Ollama local geralmente não é viável (modelos grandes excedem limites de container)

---

## 4. Custo Mensal Estimado — Cenários Reais

### Cenário 1 — "Economico" (APIs externas + Hetzner CPX11)
- VPS Hetzner CPX11: **~R$ 33/mês**
- OpenAI (1.000 scans/mês com gpt-5.4-nano): **~R$ 5-15/mês**
- PageSpeed API: **grátis** (dentro da cota)
- **Total: ~R$ 40-50/mês**

### Cenário 2 — "Equilibrado" (APIs externas + DigitalOcean 2vCPU/4GB)
- VPS DigitalOcean ($24): **~R$ 122/mês**
- OpenAI: **~R$ 5-15/mês**
- **Total: ~R$ 130-140/mês**

### Cenário 3 — "Tudo Local" (Lighthouse + Ollama + Hetzner CPX31)
- VPS Hetzner CPX31 (4 vCPUs / 16 GB): **~R$ 108/mês**
- Sem custo de API externa
- **Total: ~R$ 110/mês**

> O cenário 3 é viável se o tráfego for moderado (< 5.000 scans/mês). Acima disso, Ollama local pode ficar lento e você vai precisar escalar CPU/RAM.

---

## 5. Checklist de Deploy (Ubuntu 22.04+)

```bash
# 1. Atualizar sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Instalar PostgreSQL e Redis
sudo apt install -y postgresql redis-server

# 4. Instalar Chrome (obrigatório se usar Lighthouse local)
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt update
sudo apt install -y google-chrome-stable

# 5. Criar banco de dados
sudo -u postgres createdb roast_my_landing

# 6. Configurar variáveis de ambiente (.env)
POSTGRES_URL="postgresql://postgres:senha@localhost:5432/roast_my_landing"
REDIS_URL="redis://localhost:6379"
OPENAI_API_KEY="sk-..."
# ou
# PAGESPEED_API_KEY="..."
# LIGHTHOUSE_PROVIDER="pagespeed"

# 7. Build e start
npm install
npm run build
npm start
```

### Usando PM2 para manter o app rodando
```bash
npm install -g pm2
pm2 start npm --name "roast-my-landing" -- start
pm2 save
pm2 startup
```

---

## 6. Resumo da Recomendação

| Perfil | Recomendação | Custo mensal estimado |
|--------|--------------|----------------------|
| **Iniciante / quer praticidade** | Render ou Railway (PaaS) | R$ 100-150 |
| **Custo/benefício máximo** | Hetzner CPX11 + PageSpeed + OpenAI | R$ 40-50 |
| **Privacidade total (sem APIs)** | Hetzner CPX31 + Ollama local | R$ 110 |
| **Escalabilidade / Enterprise** | AWS (EC2 t3.medium + RDS + ElastiCache) | R$ 400-800+ |

---

*Última atualização: Abril 2026. Preços podem variar conforme cotação do dólar/euro e mudanças nas plataformas.*
