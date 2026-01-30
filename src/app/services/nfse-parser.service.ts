import { Injectable } from '@angular/core';
import { create } from 'xmlbuilder2';
import SparkMD5 from 'spark-md5';

export interface NfseData {
  prestadorCnpj: string;
  tomadorCnpj: string;
  descricao: string;
  pacienteNome?: string;
  referencia?: string;
  valorTotal?: string; 
  rawXml?: string;
  numeroNota?: string;
  prestadorNome?: string;
  dataEmissao?: string;
  
  // Extrações inteligentes
  quantidadeDiarias?: string;
  valorUnitarioDiaria?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface TissManualData {
  codigoPrestador: string;
  numeroCarteira: string;
  tipoGuia: 'SADT' | 'RESUMO_INTERNACAO';
  dataInicial: string; 
  dataFinal: string;   
  codigoTuss: string;
}

@Injectable({
  providedIn: 'root'
})
export class NfseParserService {

  constructor() { }

  parse(xmlString: string): NfseData | null {
    const cleanXml = xmlString.replace(/<([a-zA-Z0-9]+):/g, '<').replace(/<\/([a-zA-Z0-9]+):/g, '</');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanXml, "text/xml");

    const getTag = (parent: any, tag: string) => {
      if (!parent) return '';
      const el = parent.getElementsByTagName ? parent.getElementsByTagName(tag)[0] : null;
      return el ? el.textContent?.trim() || '' : '';
    };

    let compNfse = xmlDoc.getElementsByTagName("CompNfse")[0] || xmlDoc;
    const prestadorNode = xmlDoc.getElementsByTagName("Prestador")[0] || xmlDoc.getElementsByTagName("PrestadorServico")[0];
    const tomadorNode = xmlDoc.getElementsByTagName("Tomador")[0] || xmlDoc.getElementsByTagName("TomadorServico")[0];
    const servicoNode = xmlDoc.getElementsByTagName("Servico")[0];
    const valoresNode = xmlDoc.getElementsByTagName("valores")[0];

    const pCnpj = getTag(prestadorNode, "Cnpj") || getTag(xmlDoc, "Cnpj");
    const tCnpj = getTag(tomadorNode, "Cnpj");
    const numeroNota = getTag(compNfse, "Numero");
    const prestadorNome = getTag(prestadorNode, "RazaoSocial") || getTag(xmlDoc, "RazaoSocial");
    const discriminacao = getTag(xmlDoc, "Discriminacao") || getTag(xmlDoc, "discriminacao");
    const dataEmissao = getTag(compNfse, "DataEmissao");

    let valorServicos = getTag(valoresNode, "valorServicos");
    if (!valorServicos) valorServicos = getTag(servicoNode, "valorServicos");

    const parsedData: NfseData = {
      prestadorCnpj: pCnpj,
      tomadorCnpj: tCnpj,
      descricao: discriminacao, // Usaremos isso na observação
      rawXml: xmlString,
      numeroNota: numeroNota,
      prestadorNome: prestadorNome,
      valorTotal: valorServicos,
      dataEmissao: dataEmissao ? dataEmissao.split('T')[0] : new Date().toISOString().split('T')[0]
    };

    this.extractSmartData(parsedData);
    
    return parsedData;
  }

  private extractSmartData(data: NfseData) {
    if (!data.descricao) return;
    const desc = data.descricao;

    // Correção: Remove "Paciente:", "Paciente :", espaços e pontos do início
    const pacienteMatch = desc.match(/Paciente\s*[:.\-]+\s*([^\n\r]+)/i);
    if (pacienteMatch) {
      data.pacienteNome = pacienteMatch[1].replace(/^[:\s]+/, '').trim();
    }

    const qtdMatch = desc.match(/(\d+)\s*DI[AÁ]RIAS/i);
    if (qtdMatch) {
      data.quantidadeDiarias = qtdMatch[1];
    }

    const valorUnitMatch = desc.match(/Valor.*Di[aá]ria.*?R\$\s*([\d.,]+)/i);
    if (valorUnitMatch) {
      data.valorUnitarioDiaria = valorUnitMatch[1].replace('.', '').replace(',', '.');
    }

    const months = {
      'JANEIRO': '01', 'FEVEREIRO': '02', 'MARÇO': '03', 'ABRIL': '04', 'MAIO': '05', 'JUNHO': '06',
      'JULHO': '07', 'AGOSTO': '08', 'SETEMBRO': '09', 'OUTUBRO': '10', 'NOVEMBRO': '11', 'DEZEMBRO': '12'
    };
    
    const mesAnoMatch = desc.match(new RegExp(`(${Object.keys(months).join('|')})\\s*(?:DE)?\\s*(\\d{4})`, 'i'));
    
    if (mesAnoMatch) {
      const mesNome = mesAnoMatch[1].toUpperCase();
      const ano = mesAnoMatch[2];
      const mesNum = months[mesNome as keyof typeof months];
      data.dataInicio = `${ano}-${mesNum}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mesNum), 0).getDate();
      data.dataFim = `${ano}-${mesNum}-${ultimoDia}`;
    }
  }

  generateTiss(data: NfseData, manual: TissManualData): string {
    const cleanDigits = (val: string | undefined) => (val || '').replace(/\D/g, '');
    const formatCurrency = (val: string | undefined) => {
      if (!val) return '0.00';
      let num = parseFloat(val.toString().replace(',', '.'));
      return isNaN(num) ? '0.00' : num.toFixed(2);
    };

    const prestadorCnpj = cleanDigits(data.prestadorCnpj);
    const carteira = cleanDigits(manual.numeroCarteira);
    const numeroGuia = cleanDigits(data.numeroNota) || '000000';
    const nomeContratado = data.prestadorNome || 'PRESTADOR';
    
    const qtdExecutada = data.quantidadeDiarias || '1';
    const valorUnitario = data.valorUnitarioDiaria ? formatCurrency(data.valorUnitarioDiaria) : formatCurrency(data.valorTotal);
    const valorTotalGeral = formatCurrency(data.valorTotal);
    
    const dtInicio = data.dataInicio || manual.dataInicial;
    const dtFim = data.dataFim || manual.dataFinal;
    const registroAnsPromedica = '031193'; 

    // Limpa a descrição para usar como Observação (remove quebras de linha excessivas)
    const observacaoClinica = data.descricao 
      ? data.descricao.replace(/[\n\r]+/g, ' ').substring(0, 500) // Limite de 500 caracteres
      : 'Servicos de assistencia em saude mental';

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('ans:mensagemTISS', {
        'xmlns:ans': 'http://www.ans.gov.br/padroes/tiss/schemas',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://www.ans.gov.br/padroes/tiss/schemas http://www.ans.gov.br/padroes/tiss/schemas/tissV4_01_00.xsd'
      })
        .ele('ans:cabecalho')
          .ele('ans:identificacaoTransacao')
            .ele('ans:tipoTransacao').txt('ENVIO_LOTE_GUIAS').up()
            .ele('ans:sequencialTransacao').txt('1').up()
            .ele('ans:dataRegistroTransacao').txt(new Date().toISOString().split('T')[0]).up()
            .ele('ans:horaRegistroTransacao').txt(new Date().toTimeString().split(' ')[0]).up()
          .up()
          .ele('ans:origem')
            .ele('ans:identificacaoPrestador')
              .ele('ans:codigoPrestadorNaOperadora').txt(manual.codigoPrestador).up()
            .up()
          .up()
          .ele('ans:destino')
            .ele('ans:registroANS').txt(registroAnsPromedica).up()
          .up()
          .ele('ans:padrao').txt('4.01.00').up()
        .up()
        .ele('ans:prestadorParaOperadora')
          .ele('ans:loteGuias')
            .ele('ans:numeroLote').txt('1').up()
            .ele('ans:guiasTISS')
              .ele('ans:guiaResumoInternacao') 
                .ele('ans:cabecalhoGuia')
                  .ele('ans:registroANS').txt(registroAnsPromedica).up()
                  .ele('ans:numeroGuiaPrestador').txt(numeroGuia).up()
                .up()
                .ele('ans:dadosAutorizacao')
                    .ele('ans:numeroGuiaSolicitacaoInternacao').txt(numeroGuia).up()
                    .ele('ans:senha').txt(numeroGuia).up()
                    .ele('ans:dataAutorizacao').txt(dtInicio).up()
                .up()
                .ele('ans:dadosBeneficiario')
                  .ele('ans:numeroCarteira').txt(carteira).up()
                  .ele('ans:nomeBeneficiario').txt(data.pacienteNome || 'NAO INFORMADO').up()
                  .ele('ans:tipoInternacao').txt('1').up()
                .up()
                .ele('ans:dadosInternacao') 
                    .ele('ans:caraterAtendimento').txt('1').up()
                    .ele('ans:tipoInternacao').txt('1').up()
                    .ele('ans:regimeInternacao').txt('1').up()
                    .ele('ans:dataInicioFaturamento').txt(dtInicio).up()
                    .ele('ans:dataFimFaturamento').txt(dtFim).up()
                .up()
                .ele('ans:dadosExecutante')
                   .ele('ans:contratadoExecutante')
                     .ele('ans:cnpjContratado').txt(prestadorCnpj).up()
                     .ele('ans:nomeContratado').txt(nomeContratado).up() 
                   .up()
                   .ele('ans:CNES').txt('0000000').up()
                .up()
                .ele('ans:procedimentosExecutados')
                    .ele('ans:procedimentoExecutado')
                        .ele('ans:sequencialItem').txt('1').up()
                        .ele('ans:dataExecucao').txt(dtFim).up()
                        .ele('ans:horaInicio').txt('08:00:00').up()
                        .ele('ans:horaFim').txt('18:00:00').up()
                        .ele('ans:procedimento')
                            .ele('ans:codigoTabela').txt('22').up()
                            .ele('ans:codigoProcedimento').txt(manual.codigoTuss || '60000775').up()
                            .ele('ans:descricaoProcedimento').txt('DIARIA DE INTERNACAO').up()
                        .up()
                        .ele('ans:quantidadeExecutada').txt(qtdExecutada).up()
                        .ele('ans:valorUnitario').txt(valorUnitario).up()
                        .ele('ans:valorTotal').txt(valorTotalGeral).up()
                    .up()
                .up()
                // NOVIDADE: Campo de Observação com os dados extras da nota
                .ele('ans:observacao').txt(observacaoClinica).up() 
                .ele('ans:valorTotal')
                  .ele('ans:valorTotalGeral').txt(valorTotalGeral).up()
                .up()
              .up()
            .up()
          .up()
        .up();

    const xmlContent = doc.end({ prettyPrint: false });
    const hash = SparkMD5.hash(xmlContent);

    doc.ele('ans:epilogo')
        .ele('ans:hash').txt(hash).up()
    .up();

    return doc.end({ prettyPrint: true });
  }
}