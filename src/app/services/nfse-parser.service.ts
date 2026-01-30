import { Injectable } from '@angular/core';
import { create } from 'xmlbuilder2';

export interface NfseData {
  prestadorCnpj: string;
  tomadorCnpj: string;
  descricao: string;
  pacienteNome?: string;
  referencia?: string;
  valorTotal?: string;
  rawXml?: string;
}

export interface TissManualData {
  codigoPrestador: string;
  numeroCarteira: string;
  tipoGuia: 'SADT' | 'RESUMO_INTERNACAO';
}

@Injectable({
  providedIn: 'root'
})
export class NfseParserService {

  constructor() { }

  parse(xmlString: string): NfseData | null {
    // 1. Pre-process to clean namespaces: <ns1:CompNfse> -> <CompNfse>
    // This makes distinct providers' XMLs consistent for DOMParser
    const cleanXml = xmlString.replace(/<([a-zA-Z0-9]+):/g, '<').replace(/<\/([a-zA-Z0-9]+):/g, '</');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanXml, "text/xml");

    // Try to find the root generally, or fallbacks
    let compNfse = xmlDoc.getElementsByTagName("CompNfse")[0];
    
    // If we can't find CompNfse, maybe it's just the InfNfse or directly the details
    if (!compNfse) {
      console.warn("Tag <CompNfse> not found. Attempting loose extraction.");
      // Fallback: search safely within the whole doc
      compNfse = xmlDoc as any; 
    }

    // Extraction helper with case-insensitivity fallback if needed (though getElementsByTagName is versatile in HTML, validation in XML is strict)
    const getTag = (parent: Element | Document | any, tag: string) => {
      if (!parent) return '';
      const el = parent.getElementsByTagName ? parent.getElementsByTagName(tag)[0] : null;
      return el ? el.textContent?.trim() || '' : '';
    };

    // Specific Node traversal usually robust, but flattened search is often better for variation
    const prestadorNode = xmlDoc.getElementsByTagName("Prestador")[0];
    const tomadorNode = xmlDoc.getElementsByTagName("Tomador")[0];

    const pCnpj = getTag(prestadorNode, "Cnpj") || getTag(xmlDoc, "Cnpj"); // Fallback if structure varies
    const tCnpj = getTag(tomadorNode, "Cnpj");
    
    // Discriminacao usually in Servico > Discriminacao, or just distinct tag in file
    const discriminacao = getTag(xmlDoc, "Discriminacao");

    const parsedData: NfseData = {
      prestadorCnpj: pCnpj,
      tomadorCnpj: tCnpj,
      descricao: discriminacao,
      rawXml: xmlString
    };

    // Even if empty, we return the object so the user can fill it manually
    this.extractFromDescription(parsedData);
    
    return parsedData;
  }

  private extractFromDescription(data: NfseData) {
    if (!data.descricao) return;

    // Pattern: "Paciente:" (case insensitive) followed by name until newline or some delimiter
    const pacienteMatch = data.descricao.match(/Paciente:\s*([^\n\r]+)/i);
    if (pacienteMatch) {
      data.pacienteNome = pacienteMatch[1].trim();
    }

    // Pattern: Month/Year or similar reference
    // Example: "DEZEMBRO 2025" or "REF: 12/2025"
    // Let's look for common month names or MM/YYYY
    const months = "JANEIRO|FEVEREIRO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO";
    const refMatch = data.descricao.match(new RegExp(`(${months})\\s*\\d{4}`, 'i')) || 
                     data.descricao.match(/REF[:\.]?\s*(\d{2}\/\d{4})/i);
                     
    if (refMatch) {
      data.referencia = refMatch[0].toUpperCase();
    }

    // Value extraction if explicit in description, otherwise usage of total value from XML is preferred.
    // Start with XML value if available, but here we only have description regex request.
    const serviceValueMatch = data.descricao.match(/Valor\s*(Total)?\s*[:$]?\s*([\d\.,]+)/i);
    if (serviceValueMatch) {
        data.valorTotal = serviceValueMatch[2].replace(',', '.');
    }
  }

  generateTiss(data: NfseData, manual: TissManualData): string {
    // Clean data formatters (remove masks)
    const cleanDigits = (val: string | undefined) => (val || '').replace(/\D/g, '');
    const cleanCurrency = (val: string | undefined) => {
      if (!val) return '0.00';
      // If it has commas, it's likely Brazilian format "1.000,00".
      // Remove dots, replace comma with dot.
      // However, check if it is already clean "1000.00" (from original XML)
      // or formatted "1.000,00" (from input)
      if (val.includes(',')) {
        return val.replace(/\./g, '').replace(',', '.');
      }
      return val;
    };

    const prestadorCnpj = cleanDigits(data.prestadorCnpj);
    const tomadorCnpj = cleanDigits(data.tomadorCnpj); // Not used in this basic TISS struct but available
    const valorTotal = cleanCurrency(data.valorTotal);
    const carteira = cleanDigits(manual.numeroCarteira);

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
            .ele('ans:registroANS').txt('000000').up() // Placeholder or Input?
          .up()
          .ele('ans:padrao').txt('4.01.00').up()
        .up()
        .ele('ans:prestadorParaOperadora')
          .ele('ans:loteGuias')
            .ele('ans:numeroLote').txt('1').up()
            .ele('ans:guiasTISS')
              .ele('ans:guiaResumoInternacao') // Assuming Resumo Internacao based on requirements "Select Type"
                // This structure is complex and depends heavily on the specific TISS Guide Type
                // For simplified demo, we assume a basic structure.
                .ele('ans:cabecalhoGuia')
                  .ele('ans:registroANS').txt('000000').up()
                  .ele('ans:numeroGuiaPrestador').txt('12345').up()
                .up()
                .ele('ans:dadosBeneficiario')
                  .ele('ans:numeroCarteira').txt(carteira).up()
                  .ele('ans:nomeBeneficiario').txt(data.pacienteNome || 'NAO INFORMADO').up()
                .up()
                .ele('ans:dadosExecutante')
                   .ele('ans:contratadoExecutante')
                     .ele('ans:cnpjContratado').txt(prestadorCnpj).up()
                     .ele('ans:nomeContratado').txt('PRESTADOR').up() 
                   .up()
                   .ele('ans:CNES').txt('0000000').up()
                .up()
                .ele('ans:valorTotal')
                  .ele('ans:valorTotalGeral').txt(valorTotal).up()
                .up()
              .up()
            .up()
          .up()
        .up()
      .up();

    return doc.end({ prettyPrint: true });
  }
}
