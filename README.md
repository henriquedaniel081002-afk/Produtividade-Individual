# Produtividade Operacional

Dashboard web responsivo para análise da produtividade individual dos operadores.

## Funcionalidades

- filtros por mês, setor, turno, status e colaborador;
- ranking baseado na média mensal de cada operador;
- visão consolidada com média geral, faixas de desempenho e Top 3;
- tabela completa com melhor mês, pior mês, evolução e tendência;
- painel individual com comparação entre colaborador e equipe;
- leitura direta do arquivo `public/data/produtividade.json`;
- layout responsivo para computador, tablet e celular.

## Regras preservadas

- **Crítico:** produtividade menor que 80%;
- **Abaixo da Meta:** produtividade de 80% até menor que 95%;
- **Acima da Meta:** produtividade igual ou superior a 95%;
- o ranking utiliza a média das médias mensais do operador no período filtrado.

## Atualizar os dados

Substitua o arquivo `public/data/produtividade.json` por outro JSON com a mesma estrutura:

```json
[
  {
    "data": "2026-07-01",
    "nome": "NOME DO OPERADOR",
    "percentual": 95.5,
    "setor": "ALTA TENSÃO",
    "turno": "1",
    "mes": "Julho"
  }
]
```

O percentual pode estar em escala percentual (`95.5`), decimal (`0.955`) ou como texto (`"95,5%"`).

## Executar localmente

Requisitos: Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm test
```
