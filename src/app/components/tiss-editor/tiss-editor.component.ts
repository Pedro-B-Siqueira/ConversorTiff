import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NfseData, TissManualData } from '../../services/nfse-parser.service';

@Component({
  selector: 'app-tiss-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tiss-editor.component.html',
  styles: []
})
export class TissEditorComponent implements OnChanges {
  @Input() data!: NfseData;
  @Output() generate = new EventEmitter<TissManualData>();
  @Output() cancel = new EventEmitter<void>();

  manualData: TissManualData = {
    codigoPrestador: '',
    numeroCarteira: '',
    tipoGuia: 'SADT',
    dataInicial: new Date().toISOString().split('T')[0], // Valor padrão (Hoje)
    dataFinal: new Date().toISOString().split('T')[0],   // Valor padrão (Hoje)
    codigoTuss: '' 
  };

  // O Segredo: Escuta quando o 'data' muda (quando o arquivo é carregado)
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data) {
      this.updateFormWithExtractedData();
    }
  }

  private updateFormWithExtractedData() {
    // Se o serviço extraiu uma data de início, usa ela no formulário
    if (this.data.dataInicio) {
      this.manualData.dataInicial = this.data.dataInicio;
    }

    // Se o serviço extraiu uma data fim, usa ela
    if (this.data.dataFim) {
      this.manualData.dataFinal = this.data.dataFim;
    }

    // Sugere o código TUSS de diária se não tiver nada preenchido
    if (!this.manualData.codigoTuss) {
      this.manualData.codigoTuss = '60000775';
    }
  }

  onGenerate() {
    this.generate.emit(this.manualData);
  }

  onlyNumbers(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '');
  }

  onCnpjInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length > 14) value = value.slice(0, 14);

    // Mask: 00.000.000/0000-00
    if (value.length > 12) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    } else if (value.length > 8) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4}).*/, '$1.$2.$3/$4');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{3})(\d{0,3}).*/, '$1.$2.$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,3}).*/, '$1.$2');
    }
    
    input.value = value;
  }

  onCurrencyInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    const numberValue = parseInt(value, 10) / 100;
    
    if (isNaN(numberValue)) {
      input.value = '';
      return;
    }

    input.value = numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}