import { Component, Input, Output, EventEmitter } from '@angular/core';
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
export class TissEditorComponent {
  @Input() data!: NfseData;
  @Output() generate = new EventEmitter<TissManualData>();
  @Output() cancel = new EventEmitter<void>();

  manualData: TissManualData = {
    codigoPrestador: '',
    numeroCarteira: '',
    tipoGuia: 'SADT'
  };

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
    // Trigger model update if needed, dependent on Angular version/forms setup
    // For [(ngModel)] on input, updating input.value directly usually works for visual
    // providing the event propagates.
  }

  onCurrencyInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    // Convert to currency format
    // 123456 -> 1.234,56
    const numberValue = parseInt(value, 10) / 100;
    
    if (isNaN(numberValue)) {
      input.value = '';
      return;
    }

    input.value = numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
