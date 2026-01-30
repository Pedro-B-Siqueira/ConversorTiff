# Conversor NFS-e para TISS

Aplicação web desenvolvida em Angular para facilitar o faturamento eletrônico de operadoras de saúde, convertendo arquivos XML de Nota Fiscal de Serviço Eletrônica (NFS-e) para o padrão **TISS 4.01.00** exigido pela ANS.

## 🚀 Funcionalidades

- **Upload Intuitivo**: Área de Drag & Drop para envio rápido de arquivos XML.
- **Extração Inteligente**: 
  - Leitura automática de dados da nota (CNPJ Prestador/Tomador).
  - Uso de Expressões Regulares (Regex) para identificar Paciente, Datas e Valores na descrição do serviço.
- **Edição e Validação**:
  - Interface para correção manual de dados extraídos.
  - **Máscaras de Entrada**: Formatação automática para CNPJ (`XX.XXX.XXX/XXXX-XX`) e Moeda (R$).
  - **Validação**: Bloqueio de caracteres não numéricos e limites de tamanho (MaxLength) para garantir a integridade do arquivo final.
- **Geração TISS**:
  - Criação de arquivos XML compatíveis com o padrão TISS 4.01.00 (Envio de Lote de Guias).
  - Tratamento automático de dados (remoção de pontuação/formatação) antes da geração.

## 🛠️ Tecnologias Utilizadas

- **Angular v17+**: Framework principal (Standalone Components).
- **Tailwind CSS**: Estilização moderna e responsiva (Design System "Clean/Linear").
- **xmlbuilder2**: Geração robusta de XML no cliente.
- **Heroicons**: Ícones de interface.

## 📦 Como Executar

Este projeto é uma Single Page Application (SPA) 100% client-side.

### Pré-requisitos

- Node.js (v18 ou superior recomendado)
- NPM

### Passos

1. **Instalar Dependências**:
   ```bash
   npm install
   ```

2. **Rodar Localmente**:
   ```bash
   npm start
   ```
   Acesse `http://localhost:4200/`.

3. **Build para Produção**:
   ```bash
   npm run build
   ```
   Os arquivos otimizados serão gerados na pasta `dist/conversor-tiff`.

## 🛡️ Segurança e Privacidade

Todo o processamento é feito **localmente no navegador do usuário**. Nenhum dado da nota fiscal ou do paciente é enviado para servidores externos.

---
Desenvolvido com ❤️ para agilizar faturamentos médicos.
